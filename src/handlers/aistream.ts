import { streamText, type ModelMessage } from "ai";
import { AttachmentBuilder, type Message } from "discord.js";
import { BOT_ID } from "../constant";
import { openai } from "@ai-sdk/openai";

export async function streamingReponse(
    message: Message,
    systemPrompt: string,
    prompt: string,
    history: Message[],
) {
    streamText({
        model: "openai/gpt-5.4-nano",
        system: systemPrompt,
        messages: [
            ...history.map((message) => ({
                role: message.author.id === BOT_ID ? "assistant" : "user",
                content: message.cleanContent,
                name: message.author,
            })),
            {
                role: "user",
                content: prompt,
            },
        ] as ModelMessage[],
        tools: {
            web_search: openai.tools.webSearch({}),
        },
        providerOptions: {
            openai: {
                reasoningEffort: "medium",
            },
        },
        onFinish: async ({ text }) => {
            if (text.length > 2000) {
                const attachment = new AttachmentBuilder(
                    Buffer.from(text, "utf-8"),
                    {
                        name: "response.txt",
                    },
                );
                await message.edit({ content: "", files: [attachment] });
            } else {
                await message.edit({
                    content: text,
                });
            }
        },
        onError: async (error) => {
            console.error("Error in streaming response:", error);
            await message.edit({
                content: `Error while generating response`,
            });
        },
        experimental_onToolCallStart: async ({ toolCall }) => {
            await message.edit({
                content: `Calling tool: ${toolCall.toolName}...`,
            });
        },
    });
}
