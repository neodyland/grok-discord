class RateLimiter {
    private executions: Map<string, number[]> = new Map();

    constructor(
        private limitPerUser: number,
        private limitPerGuild: number,
        private wideWaitTime: number,
    ) {}
    wipe(now: number) {
        for (const [key, timestamps] of this.executions.entries()) {
            const newTimestamps = timestamps.filter(
                (timestamp) => now - timestamp < this.wideWaitTime,
            );
            if (newTimestamps.length > 0) {
                this.executions.set(key, newTimestamps);
            } else {
                this.executions.delete(key);
            }
        }
    }

    check(userId: string, guildId: string): boolean {
        const now = Date.now();
        this.wipe(now);
        const userExecutions = this.executions.get(`user-${userId}`) || [];
        const guildExecutions = this.executions.get(`guild-${guildId}`) || [];
        if (userExecutions.length >= this.limitPerUser) {
            return false;
        }
        if (guildExecutions.length >= this.limitPerGuild) {
            return false;
        }
        userExecutions.push(now);
        guildExecutions.push(now);
        this.executions.set(`user-${userId}`, userExecutions);
        this.executions.set(`guild-${guildId}`, guildExecutions);
        return true;
    }
}

const hourlyRateLimiter = new RateLimiter(20, 100, 60 * 60 * 1000);
const shortTermRateLimiter = new RateLimiter(5, 30, 5 * 60 * 1000);

export function checkExecute(userId: string, guildId: string) {
    return (
        hourlyRateLimiter.check(userId, guildId) &&
        shortTermRateLimiter.check(userId, guildId)
    );
}
