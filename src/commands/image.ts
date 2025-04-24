import type { CommandInteraction } from "discord.js";
import { ApplicationCommandOptionType, AttachmentBuilder } from "discord.js";

import { xai } from "@ai-sdk/xai";
import { experimental_generateImage as generateImage } from "ai";

export default {
    name: "image",
    description: "Generate an Image",
    cooldown: 0,
    botPermissions: [],
    userPermissions: [],
    validations: [],
    slashCommand: {
        enabled: true,
        options: [
            {
                name: "prompt",
                description: "The prompt to give the model",
                type: ApplicationCommandOptionType.String,
                required: true,
            },
            {
                name: "count",
                description: "Number of images to generate",
                type: ApplicationCommandOptionType.Number,
                required: false,
            },
        ],
    },
    interactionRun: async (interaction: CommandInteraction) => {
        const prompt = interaction.options.get("prompt")?.value as string;
        const count = (interaction.options.get("count")?.value as number) || 1;

        if (count > 9) {
            return interaction.reply({
                content: "You can only generate up to 9 images at a time.",
                flags: "Ephemeral",
            });
        }

        if (count < 1) {
            return interaction.reply({
                content: "You must generate at least 1 image.",
                flags: "Ephemeral",
            });
        }

        const timer = Date.now();

        await interaction.reply(process.env.LOADING_EMOJI || "Loading...");
        const { images } = await generateImage({
            model: xai.image("grok-2-image", {
                maxImagesPerCall: 9,
            }),
            prompt: prompt,
            n: count,
        });

        const generationTime = Date.now() - timer;

        const attachments = images.map((image) => {
            const buffer = Buffer.from(image.base64, "base64");
            return new AttachmentBuilder(buffer, { name: "image.png" });
        });
        await interaction.editReply({
            content: `**Prompt:** ${prompt} \n**Count:** ${count} \n**Took:** ${generationTime / 1000} seconds`,
            files: attachments,
        });
    },
};
