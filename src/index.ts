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

export async function dmUser(id: string, provider: string, message: string) {
    const user = client.users.cache.get(id);
    if (!user) return;

    const embed = new EmbedBuilder()
        .setTitle(`System Message from ${provider}`)
        .setDescription(message)
        .setColor("#FF7700")
        .setTimestamp();

    try {
        await user.send({ embeds: [embed] });
    } catch (e) {
        return e;
    }
}

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
