import type { CommandInteraction } from "discord.js";
import { commands } from "../commands";

export async function handleCommand(interaction: CommandInteraction) {
    try {
        const command = commands[interaction.commandName];
        if (!command || !command.slashCommand.enabled)
            return interaction.reply("This command is not enabled!");
        if (command.slashCommand.enabled) command.interactionRun(interaction);
    } catch (error) {
        console.error(error);
        interaction.reply({
            content: "There was an error while executing this command!",
            flags: "Ephemeral",
        });
    }
}
