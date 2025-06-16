require('dotenv').config();
const OpenAI = require('openai');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const chromium = require('@sparticuz/chromium');
const Parser = require('rss-parser');

puppeteer.use(StealthPlugin());
const parser = new Parser();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const MAX_TWEETS = 60;
const RSS_FEEDS = [
  // 🔹 CRYPTO
  "https://www.coindesk.com/arc/outboundfeeds/rss/",
  "https://cointelegraph.com/rss",
  "https://decrypt.co/feed",
  "https://www.theblock.co/rss.xml",

  // 🔹 POLITIQUE / GÉOPOLITIQUE
  "https://www.lemonde.fr/international/rss_full.xml",
  "https://www.lemonde.fr/politique/rss_full.xml",
  "https://www.lefigaro.fr/rss/figaro_international.xml",
  "https://foreignpolicy.com/feed/",
  "https://www.economist.com/latest/rss.xml",

  // 🔹 ÉCONOMIE
  "https://www.lemonde.fr/economie/rss_full.xml",
  "https://www.lefigaro.fr/rss/figaro_economie.xml",
  "https://www.challenges.fr/rss.xml",
  "https://www.latribune.fr/rss/economie.xml",

  // 🔹 SOCIÉTÉ
  "https://www.lemonde.fr/societe/rss_full.xml",
  "https://www.francetvinfo.fr/titres.rss",
  "https://www.slate.fr/rss.xml",
  "https://www.vice.com/fr/rss",
  "https://www.mediapart.fr/articles/feed",
  "https://reporterre.net/spip.php?page=backend",

  // 🔹 ENVIRONNEMENT
  "https://www.goodplanet.info/feed/",
  "https://www.theguardian.com/environment/rss",

  // 🔹 SPORT (hors L'Équipe)
  "https://www.eurosport.fr/rss.xml",
  "https://www.skysports.com/rss/12040"
];


function waitRandom(min = 20, max = 80) {
  const ms = Math.floor(Math.random() * (max - min + 1) + min) * 1000;
  console.log(`⏳ Attente ${ms / 1000}s avant le prochain tweet...`);
  return new Promise(res => setTimeout(res, ms));
}

async function getTrendingNews() {
  let items = [];
  for (const feed of RSS_FEEDS) {
    try {
      const parsed = await parser.parseURL(feed);
      items = items.concat(parsed.items || []);
    } catch (e) {
      console.error(`❌ Erreur parsing RSS ${feed}`, e.message);
    }
  }
  return items.slice(0, MAX_TWEETS);
}

async function main() {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: await chromium.executablePath(),
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
  });

  const page = await browser.newPage();
  const items = await getTrendingNews();

  for (const item of items) {
    try {
      const summaryResponse = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{
          role: 'user',
          content: `Fais un résumé putaclic et polémique de cette actu pour X : "${item.title}". Ne dépasse pas 280 caractères. Mets des emojis.`
        }],
        max_tokens: 100
      });

      const content = summaryResponse.choices[0].message.content.trim();
      const source = item.link.split('/')[2];
      const tweet = `${item.title} — ${content} (${source})`;

      console.log("🔁 Simulation tweet:", tweet);
      await waitRandom();
    } catch (e) {
      console.error(`❌ Erreur OpenAI : ${e.message}`);
    }
  }

  await browser.close();
}

main();
