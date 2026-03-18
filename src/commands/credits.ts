import { gateway } from "ai";
import type { CommandInteraction } from "discord.js";
import { OWNERS } from "../constant";

export default {
    name: "credits",
    description: "For admins",
    slashCommand: {
        enabled: true,
        options: [],
    },
    interactionRun: async (interaction: CommandInteraction) => {
        if (!OWNERS.includes(interaction.user.id)) {
            await interaction.reply(
                "You don't have permission to use this command.",
            );
            return;
        }
        await interaction.deferReply();
        const credits = await gateway.getCredits();
        await interaction.editReply(
            `Balance: ${Math.round(Number(credits.balance) * 100) / 100}USD\nTotal Used: ${Math.round(Number(credits.totalUsed) * 100) / 100}USD`,
        );
    },
};
