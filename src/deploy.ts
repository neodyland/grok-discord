import { REST, Routes } from "discord.js";
import { commands } from "./commands";
import { BOT_ID, BOT_TOKEN } from "./constant";

const rest = new REST({ version: "10" }).setToken(BOT_TOKEN);

export function deployCommands() {
    (async () => {
        try {
            console.log("Started refreshing application (/) commands.");

            const commandDataArray = [];

            for (const [_, command] of Object.entries(commands)) {
                if (command.slashCommand.enabled) {
                    console.log(
                        `Preparing ${command.name} command for registration`,
                    );

                    const commandData = {
                        name: command.name,
                        description: command.description,
                        options: command.slashCommand.options,
                    };

                    commandDataArray.push(commandData);
                }
            }

            console.log(`Registering all commands`);

            await rest.put(Routes.applicationCommands(BOT_ID), {
                body: commandDataArray,
            });
            console.log(
                `Successfully reloaded ${commandDataArray.length} application (/) commands.`,
            );
        } catch (error) {
            console.error(
                "An error occurred while refreshing application commands:",
                error,
            );
        }
    })();
}

deployCommands();
