import type { Message } from "discord.js";
import { xai } from "@ai-sdk/xai";
import { generateText } from "ai";

export async function createMessageHistoryJSON(
    message: Message,
): Promise<object> {
    const MAX_MESSAGES = 50;
    const history: { content: string; author: string }[] = [];

    // Helper function to follow the reply chain
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

    // Follow the reply chain for the initial message
    await followReplyChain(message);

    // Fetch messages until we have 10 valid human messages or hit the limit
    let lastMessageId = message.id;
    while (history.length < 10) {
        const messages = await message.channel.messages.fetch({
            before: lastMessageId,
            limit: 10,
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

            // Follow the reply chain for each message
            await followReplyChain(msg);
        }
    }

    // Limit the history to the maximum allowed messages
    return { messages: history.slice(0, MAX_MESSAGES) };
}

export async function handleMention(message: Message) {
    const prompt = message.content
        .replace(`<@${process.env.BOT_ID}>`, "")
        .trim();
    if (!prompt) return;
    const reply = await message.reply({
        content: "<a:GrokLoad:1364952552973664257>",
        allowedMentions: { repliedUser: false },
    });
    const history = await createMessageHistoryJSON(message);

    const { text } = await generateText({
        model: xai("grok-3-mini"),
        prompt: `You have been asked a question within a Discord server. With this context in mind, answer the question as if you were a human. Answer using the language the prompt was written in. Do not show your own character, just reply to the prompt. Users may also be asking you a general question unrelated to the chat, in that case you may ignore the context provided. Here is the context: ${JSON.stringify(history)}. Here is the question: ${prompt}`,
    });

    await reply.edit({ content: text });
}
