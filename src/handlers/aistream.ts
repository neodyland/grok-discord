import {
    streamText,
    type ImagePart,
    type ModelMessage,
    type TextPart,
} from "ai";
import { AttachmentBuilder, MessageFlags, type Message } from "discord.js";
import { BOT_ID, LOADING_EMOJI } from "../constant";
import {
    openai,
    type OpenAILanguageModelResponsesOptions,
} from "@ai-sdk/openai";
import AsyncLock from "async-lock";

const openaiOptions: OpenAILanguageModelResponsesOptions = {
    reasoningSummary: "auto",
    reasoningEffort: "medium",
    maxToolCalls: 7,
};

const globalLock = new AsyncLock();

function removeLast(text: string, phrase: string) {
    if (!text.includes(phrase)) return text;
    return text.split(phrase).slice(0, -1).join(phrase);
}

function processFinalText(text: string) {
    for (const phrase of ["必要なら", "提案でき", "案内でき"]) {
        if (text.includes(phrase)) {
            const before = text.split(phrase)[0];
            if (before) {
                text = `${removeLast(before, "。")}。` || text;
            }
        }
    }
    return text.trim();
}

const basicPrompt = `<instruction-per-language>
<language>Japanese</language>
<important>美しくて正しい言葉、丁寧な言葉を使い、誠実さを感じさせる日本語を話すこと</important>
<not-allowed-phrases>
ユーザーはLLMの言葉遣いが大嫌いである。
ありのままの言葉遣いではユーザーを非常に不快にさせるので、以下の原則を厳守すること。

- 無意味な短縮語やカタカナ表現、自己啓発的・情報商材屋・Xに生息する驚き屋、セミナー講師的な、軽薄で浅薄な胡散臭い言葉遣いは絶対禁止
- 感嘆符/絵文字/煽り/比喩/称賛/共感の常用は禁止
- 前置き・感想・社交辞令は不要。クッション言葉のような軽薄な同調や賛同は禁止
- 結論だけ言います/最小限で書きます、などの前置きは一切禁止
- 以下の意識高い系の単語・表現は原則として使用禁止
</not-allowed-phrases>
<not-allowed-vocab>
本質/重要/最大化/最適化/していきましょう/〜すべき/必須/欠かせません/結論から言うと/まずは/念のため/一般的に/要するに/つまり/〜ということですね/〜ですよね/いかがでしょうか/いい質問ですね/さすがです/素晴らしい/鋭い/安心してください/誰でも簡単に/今すぐ/たった○○で/完全版/完全攻略/保存版/決定版/最適解/勝ち筋/刺さる/効く/伸びる/爆伸び/バズる/神/コスパ/丸投げ/テンプレ/鉄板/王道/エモい/伸びしろ/圧倒的/一撃で/秒で/ガチで/間違いない/激アツ/確実に/必ず/これだけでOK/このままコピペでOK/気づき/マインドセット/ゴール設定/ビジョン/ミッション/自己投資/ブレークスルー/限界を超える/可能性を広げる/一歩踏み出す/行動変容/エンパワーメント/共創/シナジー/ウィンウィン/ゲームチェンジャー/パラダイムシフト/レバレッジ/ポテンシャル/コンフォートゾーン/なりたい自分/ベストバージョン/腹落ち/フック/抑えるべき点/必要なら/まとめ/絞る/整理する/短く
</not-allowed-vocab>
</instruction-per-language>`;

function messageToModelMessage(message: Message): ModelMessage {
    const cleanContent = message.cleanContent.trim();
    if (message.author.id === BOT_ID) {
        return {
            role: "assistant",
            content:
                cleanContent && cleanContent.length > 0
                    ? cleanContent
                    : "(empty message)",
        };
    } else {
        const attachments = message.attachments
            .filter(
                (att) =>
                    att.contentType &&
                    [
                        "image/png",
                        "image/jpeg",
                        "image/gif",
                        "image/webp",
                    ].includes(att.contentType),
            )
            .map((att) => att.proxyURL)
            .slice(0, 4);
        const text = `${
            message.author.displayName
        }(${message.author.username}) ${
            cleanContent.length > 0
                ? cleanContent
                : attachments.length > 0
                  ? `(empty message with ${attachments.length}image)`
                  : "(empty message)"
        }`;
        const content =
            attachments.length > 0
                ? [
                      {
                          type: "text",
                          text,
                      } as TextPart,
                      ...attachments.map(
                          (url) =>
                              ({
                                  type: "image",
                                  image: url,
                              }) as ImagePart,
                      ),
                  ]
                : text;
        return {
            role: "user",
            content,
        };
    }
}

export async function streamingReponse(
    message: Message,
    systemPrompt: string,
    promptMessage: Message,
    history: Message[],
) {
    await globalLock.acquire("streamingResponse", async () => {
        console.log(
            `Trigger response generation with ${history.length} messages in context via ${
                promptMessage.author.username
            }(${promptMessage.author.id})'s request`,
        );
        let webSearchTriggered = 0;
        let allowedStepsLeft = 20;
        const messages: ModelMessage[] = [];
        for (const entry of history.toSorted(
            (a, b) => a.createdTimestamp - b.createdTimestamp,
        )) {
            if (entry.cleanContent.trim().startsWith("!")) {
                continue;
            }
            messages.push(messageToModelMessage(entry));
        }
        messages.push(messageToModelMessage(promptMessage));
        const result = streamText({
            model: "openai/gpt-5.4-mini",
            system: `${basicPrompt}\n\n<system>${systemPrompt}</system>`,
            messages,
            tools: {
                web_search: openai.tools.webSearch(),
            },
            providerOptions: {
                openai: openaiOptions,
            },
            onFinish: async ({ text, sources, totalUsage }) => {
                const sourceTexts = [];
                const uniqueUrls = new Set<string>();
                for (const source of sources) {
                    if (
                        source.sourceType === "url" &&
                        !uniqueUrls.has(source.url)
                    ) {
                        uniqueUrls.add(source.url);
                        sourceTexts.push(
                            `- ${source.title ?? "No Title"}: ${source.url}`,
                        );
                    }
                }
                const attachments = [];
                let finalText = "";
                text = processFinalText(text);
                const noCacheInput = totalUsage.inputTokenDetails.noCacheTokens;
                const cacheReadInput =
                    totalUsage.inputTokenDetails.cacheReadTokens;
                const output = totalUsage.outputTokens;
                if (!noCacheInput) {
                    console.warn(
                        "No no-cache input tokens? This might be an error in usage tracking.",
                    );
                }
                if (!output) {
                    console.warn(
                        "No output tokens? This might be an error in usage tracking.",
                    );
                }
                if (!cacheReadInput) {
                    console.warn(
                        "No cache read input tokens? This might be an error in usage tracking.",
                    );
                }
                const tokenCost =
                    (((noCacheInput || 0) * 0.2 +
                        (cacheReadInput || 0) * 0.02 +
                        (output || 0) * 1.25) *
                        100 *
                        10000) /
                    1_000_000;
                const toolCost =
                    (webSearchTriggered * 10.0 * 100 * 10000) / 1000;
                const costText = `Model: ${Math.round(tokenCost) / 10000}cents | Tools: ${Math.round(toolCost) / 10000}cents | Total: ${Math.round(tokenCost + toolCost) / 10000}cents`;
                const cachedRatio =
                    cacheReadInput !== undefined && noCacheInput !== undefined
                        ? Math.round(
                              (cacheReadInput /
                                  (cacheReadInput + noCacheInput)) *
                                  10000,
                          ) / 100
                        : 0;
                console.log(
                    `${
                        promptMessage.author.username
                    }(${promptMessage.author.id})'s request finished | ${costText}`,
                );
                text = `${text}\n-# ${costText}`;
                if (cachedRatio !== undefined) {
                    text += ` | ${cachedRatio}% cached`;
                }
                text = `${text} | ${messages.length + 1} messages in context`;
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
                                name: "references.txt",
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
            if (allowedStepsLeft <= 0) {
                console.log(
                    `${
                        promptMessage.author.username
                    }(${promptMessage.author.id})'s request aborted due to reaching maximum reasoning/tool steps`,
                );
                await updateTrace(
                    "Reached maximum number of reasoning/tool steps. Finishing up...",
                );
                break;
            }
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
                    allowedStepsLeft--;
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
                    allowedStepsLeft--;
                    let text = `Doing ${chunk.toolName}`;
                    if (chunk.toolName === "web_search") {
                        text = "Searching the web";
                        webSearchTriggered++;
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
    });
}
