const { Client, GatewayIntentBits } = require("discord.js");
const express = require("express");
const fs = require("fs");
const path = require("path");

// =============================================
//   CONFIG — remplace ces valeurs dans Railway
//   Variables d'environnement à définir :
//   DISCORD_TOKEN, VOUCH_CHANNEL_ID, PORT
// =============================================
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const VOUCH_CHANNEL_ID = process.env.VOUCH_CHANNEL_ID; // ID du channel où MyVouch poste
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, "vouches.json");

// ── Helpers DB ──────────────────────────────
function loadVouches() {
  if (!fs.existsSync(DB_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(DB_FILE, "utf8")); }
  catch { return []; }
}

function saveVouches(vouches) {
  fs.writeFileSync(DB_FILE, JSON.stringify(vouches, null, 2));
}

// ── Discord Client ───────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once("ready", () => {
  console.log(`✅ Bot connecté : ${client.user.tag}`);
});

client.on("messageCreate", (message) => {
  // Seulement le channel de vouches
  if (message.channel.id !== VOUCH_CHANNEL_ID) return;

  // Venom Vouches poste via embeds avec le titre "New vouch created!"
  let text = "";
  let author = "";
  let stars = 5; // Par défaut 5 étoiles

  if (message.embeds && message.embeds.length > 0) {
    const embed = message.embeds[0];

    // Vérifie que c'est bien un embed Venom Vouches
    if (!embed.title?.includes("New vouch created")) return;

    // Parse les fields : "Vouch:", "Vouched by:", "Vouched at:"
    if (embed.fields && embed.fields.length > 0) {
      for (const field of embed.fields) {
        const name = field.name?.toLowerCase() || "";
        const value = field.value || "";

        if (name.includes("vouch") && !name.includes("by") && !name.includes("at")) {
          // C'est le texte du vouch
          text = value.trim();
        }
        if (name.includes("vouched by") || name.includes("by")) {
          // Auteur — retire les mentions Discord <@123> si présentes
          author = value.replace(/<@!?(\d+)>/g, "").trim() || "Anonyme";
          // Retire le @ si présent au début
          author = author.replace(/^@/, "").trim();
        }
        if (name.includes("rating") || name.includes("stars") || name.includes("étoile")) {
          const starMatch = value.match(/[⭐★✨]{1,5}/);
          if (starMatch) stars = starMatch[0].length;
        }
      }
    }

    // Fallback : description de l'embed
    if (!text) {
      text = embed.description || "";
      // Retire les étoiles de la description si présentes
      const starMatch = text.match(/[⭐★✨]{1,5}/);
      if (starMatch) stars = starMatch[0].length;
      text = text.replace(/[⭐★✨]/g, "").trim();
    }

    // Auteur fallback
    if (!author) {
      author = embed.author?.name || "Anonyme";
    }

  } else if (message.content) {
    // Fallback : message texte simple
    text = message.content;
    author = message.author.username;
  }

  if (!text) return;

  const vouches = loadVouches();
  vouches.unshift({
    id: message.id,
    text,
    author,
    stars,
    date: new Date().toISOString(),
  });

  // Garde les 50 derniers vouches max
  const trimmed = vouches.slice(0, 50);
  saveVouches(trimmed);

  console.log(`✅ Vouch ajouté : "${text}" — ${author}`);
});

// ── Express API ──────────────────────────────
const app = express();

// CORS ouvert pour que ton site SellAuth puisse fetch
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  next();
});

// Endpoint principal — retourne les vouches en JSON
app.get("/vouches", (req, res) => {
  const vouches = loadVouches();
  res.json({ success: true, count: vouches.length, vouches });
});

// Health check pour Railway
app.get("/", (req, res) => res.send("Vouch Bot API is running ✅"));

app.listen(PORT, () => {
  console.log(`🌐 API démarrée sur le port ${PORT}`);
});

client.login(DISCORD_TOKEN);
