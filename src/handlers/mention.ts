import type { Message } from "discord.js";
import { xai } from "@ai-sdk/xai";
import { generateText } from "ai";

export async function createMessageHistoryJSON(
    message: Message,
): Promise<object> {
    const MAX_MESSAGES = 50; // Maximum number of messages to fetch including replies
    const MAX_FETCHES = 25; // Maximum number of messages to fetch excluding replies
    const history: { content: string; author: string }[] = [];

    async function followReplyChain(msg: Message) {
        while (msg.reference?.messageId) {
            const repliedMessage = await msg.channel.messages
                .fetch(msg.reference.messageId)
                .catch(() => null);
            if (!repliedMessage) break;

            if (!repliedMessage.author.bot) {
                history.unshift({
                    content: repliedMessage.content,
                    author: repliedMessage.author.username,
                });
            }

            msg = repliedMessage;
        }
    }

    await followReplyChain(message);

    let lastMessageId = message.id;
    while (history.length < MAX_FETCHES) {
        const messages = await message.channel.messages.fetch({
            before: lastMessageId,
            limit: MAX_FETCHES,
        });
        if (messages.size === 0) break;

        for (const msg of messages.values()) {
            lastMessageId = msg.id;
            if (history.length >= MAX_MESSAGES) break;
            if (msg.author.bot) continue;

            history.push({
                content: msg.content,
                author: msg.author.username,
            });

            await followReplyChain(msg);
        }
    }

    return { messages: history.slice(0, MAX_MESSAGES) };
}

export async function handleMention(message: Message) {
    const prompt = message.content
        .replace(`<@${process.env.BOT_ID}>`, "")
        .trim();
    if (!prompt) return;
    const reply = await message.reply({
        content: process.env.LOADING_EMOJI,
        allowedMentions: { repliedUser: false },
    });
    const history = await createMessageHistoryJSON(message);

    const { text } = await generateText({
        model: xai("grok-3-mini"),
        prompt: `You have been asked a question within a Discord server. With this context in mind, answer the question as if you were a human. Answer using the language the prompt was written in. Do not show your own character, just reply to the prompt. Users may also be asking you a general question unrelated to the chat, in that case you may ignore the context provided. However, whenever possible take the chat context into consideration. Here is the context: ${JSON.stringify(history)}. Here is the question: ${prompt}`,
    });

    await reply.edit({ content: text });
}
