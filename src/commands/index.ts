import credits from "./credits.ts";
import ping from "./ping.ts";
export const commands: Record<string, typeof ping> = {
    ping,
    credits,
};
