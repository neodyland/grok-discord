import { setPresence } from "./presence";
import { handleCommand } from "./handlers/command";
import { Client, GatewayIntentBits, EmbedBuilder } from "discord.js";

import { handleMention } from "./handlers/mention.ts";

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildMessages,
    ],
});

client.on("ready", () => {
    console.log(`Logged in as ${client.user?.tag}!`);
    setPresence(client);
});

client.on("interactionCreate", async (interaction) => {
    if (interaction.isCommand()) {
        console.log(`Received command: ${interaction.commandName}`);
        try {
            await handleCommand(interaction);
        } catch (e) {
            console.error(e);
        }
    }
    if (interaction.isButton()) {
        console.log(`Received button: ${interaction.customId}`);
    }
});

client.on("messageCreate", async (message) => {
    if (message.author.bot) return;
    if (message.content.startsWith(`<@${client.user?.id}>`)) {
        await handleMention(message);
    }
});

client.on("guildCreate", async (guild) => {});

client.login(process.env.BOT_TOKEN);
