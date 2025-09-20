import type { Message } from "discord.js";
import { xai } from "@ai-sdk/xai";
import { generateText, ModelMessage } from "ai";

async function createMessageHistory(message: Message): Promise<Message[]> {
    const history: Message[] = [];

    async function followReplyChain(msg: Message) {
        while (msg.reference?.messageId) {
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
        model: "xai/grok-4-fast-non-reasoning",
        system: 'You have been asked a question within a Discord server. With this context in mind, answer the question as if you were a human. Answer using the language the prompt was written in. Do not show your own character, just reply to the prompt. Users may also be asking you a general question unrelated to the chat, in that case you may ignore the context provided. However, whenever possible take the chat context into consideration. Users may also ask questions such as "factcheck" ans "is this true" and if that hapens, it is most likely that you have been tasked to evaluate a stetement made by a user in the chat. Find the statement, and see if it is true or not, giving reasons why.',
        messages: [
            ...history.map((message) => ({
                role:
                    message.author.id === process.env.BOT_ID
                        ? "assistant"
                        : "user",
                content: message.content,
                name: message.author,
            })),
            {
                role: "user",
                content: prompt,
            },
        ] as ModelMessage[],
    });

    await reply.edit({ content: text });
}
