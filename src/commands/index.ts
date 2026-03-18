import ping from "./ping.ts";
export const commands: Record<string, typeof ping> = {
    ping,
};
