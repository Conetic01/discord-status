const Discord = require("discord.js");
const client = new Discord.Client({
	intents: [
		Discord.Intents.FLAGS.GUILDS,
		Discord.Intents.FLAGS.GUILD_MESSAGES,
		Discord.Intents.FLAGS.GUILD_PRESENCES,
		Discord.Intents.FLAGS.GUILD_MEMBERS,
	],
});

let config = require("./config.json");
const db = require("quick.db");
const fs = require("fs");

client.on("guildMemberUpdate", async (oldMember, newMember) => {
	if (newMember.guild.id !== config.server) return;
	if (!oldMember.premiumSince && newMember.premiumSince) {
		newMember.roles.add(config.role);
		db.set(newMember.id, Date.now());
	}

	if (oldMember.premiumSince && !newMember.premiumSince) {
		newMember.roles.remove(config.role);
		db.delete(newMember.id);
	}
});

client.on("ready", async () => {
	const guild = client.guilds.cache.get(config.server);
	setInterval(async () => {
		const results = (await db.fetchAll()).filter(({ data }) => Date.now() >= data + config.time * 8.64e7);
		for (const result of results) {
			const member = guild.members.cache.get(result.ID) || (await guild.members.fetch(result.ID));
			await member.roles.remove(config.role);
			db.delete(member.id);
		}
	}, 60000); // Check every minute (adjust the interval as needed)
});

client.on("messageCreate", (message) => {
	const prefix = "?";
	let [command, ...args] = message.content.split(" ");
	if (message.author.bot) return;
	if (!command.startsWith(prefix)) return;
	command = command.slice(prefix.length);
	if (command === "status") {
		if (message.author.id !== config.owner) return message.channel.send("You are not the bot owner.");
		const status = args.join(" ");
		if (!status) return message.channel.send("Please specify a status.");
		fs.writeFile("config.json", JSON.stringify({ ...config, text: status }, null, 4), "utf8", (err) => {
			if (err) return message.channel.send(`${err}`);
			console.log(`Status text updated by ${message.author.tag} (${message.author.id}) to ${status}.`);
			config = require("./config.json");
		});
	}
});

client.on("presenceUpdate", async (oldPresence, newPresence) => {
	const { guild, member } = newPresence;
	if (guild.id !== config.server) return;
	const { role, text } = config;

	const oldText = (oldPresence.activities.find((activity) => activity.type === "CUSTOM") || {}).state || "";
	const newText = (newPresence.activities.find((activity) => activity.type === "CUSTOM") || {}).state || "";

	const isStatusExactMatch = newText.toLowerCase() === text.toLowerCase();

	if (isStatusExactMatch) {
		// If the new status is an exact match to the specified text, add the role
		if (!member.roles.cache.has(role)) await member.roles.add(role);
	} else {
		// If the new status is not an exact match to the specified text, remove the role
		if (member.roles.cache.has(role)) await member.roles.remove(role);
	}
});

client.login(config.token).then(() => console.log("Logged in."));
