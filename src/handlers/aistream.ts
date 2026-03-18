import { streamText, type ModelMessage } from "ai";
import { AttachmentBuilder, MessageFlags, type Message } from "discord.js";
import { BOT_ID, LOADING_EMOJI } from "../constant";
import {
    openai,
    type OpenAILanguageModelResponsesOptions,
} from "@ai-sdk/openai";

const openaiOptions: OpenAILanguageModelResponsesOptions = {
    reasoningSummary: "auto",
    reasoningEffort: "low",
};

export async function streamingReponse(
    message: Message,
    systemPrompt: string,
    prompt: string,
    history: Message[],
) {
    const result = streamText({
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
            openai: openaiOptions,
        },
        onFinish: async ({ text, sources }) => {
            const sourceTexts = [];
            for (const source of sources) {
                if (source.sourceType === "url") {
                    sourceTexts.push(
                        `[${source.title ?? source.url}](${source.url})`,
                    );
                }
            }
            const attachments = [];
            let finalText = "";
            if (text.length > 2000) {
                attachments.push(
                    new AttachmentBuilder(Buffer.from(text, "utf-8"), {
                        name: "response.md",
                    }),
                );
            } else {
                finalText = text;
            }
            if (sourceTexts.length > 0) {
                attachments.push(
                    new AttachmentBuilder(
                        Buffer.from(sourceTexts.join("\n"), "utf-8"),
                        {
                            name: "sources.md",
                        },
                    ),
                );
            }
            await message.edit({
                content: finalText,
                files: attachments,
                flags: MessageFlags.SuppressEmbeds,
            });
        },
        onError: async (error) => {
            console.error("Error in streaming response:", error);
            await message.edit({
                content: `Error while generating response`,
            });
        },
    });
    let reasoningText = "";
    const keepedTraces: string[] = [];
    async function updateTrace(newTrace: string) {
        if (newTrace.trim().length === 0) return;
        keepedTraces.push(newTrace);
        if (keepedTraces.length > 5) {
            keepedTraces.shift();
        }
        return message.edit({
            content: keepedTraces
                .map((trace) =>
                    trace.includes("\n")
                        ? `\`\`\`\n${trace.slice(0, 300)}\n\`\`\``
                        : trace.slice(0, 300),
                )
                .join("\n\n"),
            flags: MessageFlags.SuppressEmbeds,
        });
    }
    for await (const chunk of result.fullStream) {
        switch (chunk.type) {
            case "reasoning-start": {
                reasoningText = "";
                break;
            }
            case "reasoning-delta": {
                reasoningText += chunk.text;
                break;
            }
            case "reasoning-end": {
                reasoningText = reasoningText.trim();
                await updateTrace(
                    reasoningText.length > 0
                        ? reasoningText
                        : "Thought for a brief moment",
                );
                break;
            }
            case "tool-result": {
                let text = `Got result from ${chunk.toolName}`;
                if (chunk.toolName === "web_search") {
                    text = "Done searching the web";
                }
                await updateTrace(`${LOADING_EMOJI} ${text}`);
                break;
            }
            case "tool-call": {
                let text = `Doing ${chunk.toolName}`;
                if (chunk.toolName === "web_search") {
                    text = "Searching the web";
                }
                await updateTrace(`${LOADING_EMOJI} ${text}`);
                break;
            }
            default: {
                if (
                    ![
                        "tool-input-start",
                        "tool-input-delta",
                        "tool-input-end",
                        "finish",
                        "start",
                        "start-step",
                        "finish-step",
                        "text-start",
                        "text-delta",
                        "text-end",
                        "source",
                    ].includes(chunk.type)
                ) {
                    console.log("Other chunk:", chunk);
                }
                break;
            }
        }
    }
}
