import type { Client } from "discord.js";

export function setPresence(client: Client) {
    const setActivity = () => {
        client.user?.setPresence({
            activities: [],
            status: "idle",
        });
    };
    setActivity();
    setInterval(setActivity, 1000 * 60 * 60);
}
