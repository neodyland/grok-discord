import type { Message } from "discord.js";
import { xai } from "@ai-sdk/xai";
import { generateText } from "ai";

async function createMessageHistory(
    message: Message,
): Promise<Message[]> {
    const MAX_MESSAGES = 50; // Maximum number of messages to fetch including replies
    const MAX_FETCHES = 25; // Maximum number of messages to fetch excluding replies
    const history: Message[] = [];

    async function followReplyChain(msg: Message) {
        while (msg.reference?.messageId) {
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

            history.push(msg);

            await followReplyChain(msg);
        }
    }

    return history;
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
    const history = await createMessageHistory(message);

    const { text } = await generateText({
        model: xai("grok-3-mini"),
        prompt: `You have been asked a question within a Discord server. With this context in mind, answer the question as if you were a human. Answer using the language the prompt was written in. Do not show your own character, just reply to the prompt. Users may also be asking you a general question unrelated to the chat, in that case you may ignore the context provided. However, whenever possible take the chat context into consideration. Users may also ask questions such as "factcheck" ans "is this true" and if that hapens, it is most likely that you have been tasked to evaluate a stetement made by a user in the chat. Find the statement, and see if it is true or not, giving reasons why. Here is the question: ${prompt}`,
        messages: history.map((message) => ({
            role: message.author.id === process.env.BOT_ID ? "assistant" : "user",
            content: message.content,
            name: message.author,
        })),
    });

    await reply.edit({ content: text });
}
