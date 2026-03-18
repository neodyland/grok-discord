import { SnowflakeUtil, type Message } from "discord.js";
import { LOADING_EMOJI, REPLY_MAX_FETCHES } from "../constant";
import { streamingReponse } from "./aistream";

export function isOlderThanTimestamp(
    snowflakeId: string,
    timestamp: number,
): boolean {
    return SnowflakeUtil.deconstruct(snowflakeId).timestamp < timestamp;
}

async function createMessageHistory(message: Message): Promise<Message[]> {
    const history: Message[] = [];
    const oldestAllowedTimestamp = Date.now() - 2 * 24 * 60 * 60 * 1000;

    async function followReplyChain(msg: Message) {
        let followCount = REPLY_MAX_FETCHES;
        while (msg.reference?.messageId) {
            if (
                isOlderThanTimestamp(
                    msg.reference.messageId,
                    oldestAllowedTimestamp,
                )
            ) {
                break;
            }
            followCount--;
            if (followCount <= 0) break;
            const repliedMessage = await msg.channel.messages
                .fetch(msg.reference.messageId)
                .catch(() => null);
            if (!repliedMessage) break;

            history.unshift(repliedMessage);
            msg = repliedMessage;
        }
    }

    await followReplyChain(message);

    return history;
}

export async function handleReply(message: Message) {
    if (!message.cleanContent.trim() && message.attachments.size === 0) return;
    const reply = await message.reply({
        content: `${LOADING_EMOJI}Fetching context...`,
    });
    const history = await createMessageHistory(message);
    await reply.edit({
        content: `${LOADING_EMOJI}Generating response with ${history.length + 1} messages in context...`,
    });
    await streamingReponse(
        reply,
        `You have been asked a question within a Discord server.
With this context in mind, answer the question as if you were a human.
Answer using the language the prompt was written in.
Do not show your own character, just reply to the prompt.
Users may also be asking you a general question unrelated to the chat, in that case you may ignore the context provided.
However, whenever possible take the chat context into consideration.
Users may also ask questions such as "factcheck" ans "is this true" and if that happens, it is most likely that you have been tasked to evaluate a stetement made by a user in the chat.
Find the statement, and see if it is true or not, giving reasons why. Use the Search tool to search for up-to-date information when needed.`,
        message,
        history,
    );
}
