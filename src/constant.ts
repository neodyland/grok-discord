const LOADING_EMOJI = process.env.LOADING_EMOJI || "⏳";

function getBotToken() {
    const token = process.env.BOT_TOKEN;
    if (!token) {
        throw new Error("BOT_TOKEN is not defined in environment variables");
    }
    return token;
}
const BOT_TOKEN = getBotToken();

const botTokenZero = BOT_TOKEN.split(".")[0];
if (!botTokenZero) {
    throw new Error("Invalid BOT_TOKEN format");
}
const BOT_ID = Buffer.from(botTokenZero, "base64").toString("ascii");

function getEnvNumberWithLimits(
    envVar: string,
    defaultValue: number,
    min: number,
    max: number,
): number {
    const valueStr = process.env[envVar];
    if (!valueStr) {
        return defaultValue;
    }
    const value = Number(valueStr);
    if (Number.isNaN(value)) {
        console.warn(
            `Environment variable ${envVar} is not a valid number. Using default value ${defaultValue}.`,
        );
        return defaultValue;
    }
    if (value < min || value > max) {
        console.warn(
            `Environment variable ${envVar} is out of bounds (${min}-${max}). Using default value ${defaultValue}.`,
        );
        return defaultValue;
    }
    return value;
}

const MENTION_MAX_FETCHES = getEnvNumberWithLimits(
    "MENTION_MAX_FETCHES",
    7,
    1,
    100,
);
const MENTION_MAX_MESSAGES = getEnvNumberWithLimits(
    "MENTION_MAX_MESSAGES",
    15,
    1,
    100,
);
const REPLY_MAX_FETCHES = getEnvNumberWithLimits(
    "REPLY_MAX_FETCHES",
    15,
    1,
    100,
);

export {
    LOADING_EMOJI,
    BOT_TOKEN,
    BOT_ID,
    MENTION_MAX_FETCHES,
    MENTION_MAX_MESSAGES,
    REPLY_MAX_FETCHES,
};
