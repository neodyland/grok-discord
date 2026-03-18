import type { Message } from "discord.js";
import {
    LOADING_EMOJI,
    MENTION_MAX_FETCHES,
    MENTION_MAX_MESSAGES,
} from "../constant";
import { streamingReponse } from "./aistream";
import { isOlderThanTimestamp } from "./reply";

async function createMessageHistory(message: Message): Promise<Message[]> {
    const history: Message[] = [];
    const oldestAllowedTimestamp = Date.now() - 2 * 24 * 60 * 60 * 1000;

    async function followReplyChain(msg: Message) {
        while (msg.reference?.messageId) {
            if (
                isOlderThanTimestamp(
                    msg.reference.messageId,
                    oldestAllowedTimestamp,
                )
            ) {
                break;
            }
            const repliedMessage = await msg.channel.messages
                .fetch(msg.reference.messageId)
                .catch(() => null);
            if (!repliedMessage) break;

            if (!repliedMessage.author.bot) {
                history.unshift(repliedMessage);
            }

            msg = repliedMessage;
        }
    }

    await followReplyChain(message);

    let lastMessageId = message.id;
    while (history.length < MENTION_MAX_FETCHES) {
        const messages = await message.channel.messages.fetch({
            before: lastMessageId,
            limit: MENTION_MAX_FETCHES,
        });
        if (messages.size === 0) break;
        let isAllOlder = true;

        for (const msg of messages.values()) {
            if (isOlderThanTimestamp(msg.id, oldestAllowedTimestamp)) {
                continue;
            } else {
                isAllOlder = false;
            }
            lastMessageId = msg.id;
            if (history.length >= MENTION_MAX_MESSAGES) break;
            if (msg.author.bot) continue;

            history.push(msg);

            await followReplyChain(msg);
        }
        if (isAllOlder) break;
    }

    return history;
}

export async function handleMention(message: Message) {
    const prompt = message.cleanContent.trim();
    if (!prompt) return;
    const reply = await message.reply({
        content: `${LOADING_EMOJI}Fetching context...`,
    });
    const history = await createMessageHistory(message);
    await reply.edit({
        content: `${LOADING_EMOJI}Generating response with ${history.length} messages in context...`,
    });
    await streamingReponse(
        reply,
        `You have been asked a question within a Discord server. With this context in mind, answer the question as if you were a human.
Answer using the language the prompt was written in.
Do not show your own character, just reply to the prompt.
Users may also be asking you a general question unrelated to the chat, in that case you may ignore the context provided.
However, whenever possible take the chat context into consideration.
Users may also ask questions such as "factcheck" ans "is this true" and if that happens, it is most likely that you have been tasked to evaluate a stetement made by a user in the chat.
Find the statement, and see if it is true or not, giving reasons why.
Use the Search tool to search for up-to-date information when needed.`,
        prompt,
        history,
    );
}
