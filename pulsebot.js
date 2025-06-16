require('dotenv').config();
const OpenAI = require('openai');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const Parser = require('rss-parser');
const parser = new Parser();

puppeteer.use(StealthPlugin());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const credentials = {
  username: process.env.X_USERNAME,
  password: process.env.X_PASSWORD,
};

const RSS_SOURCES = [
  'https://www.coindesk.com/arc/outboundfeeds/rss/',
  'https://cointelegraph.com/rss',
  'https://decrypt.co/feed',
  'https://www.theguardian.com/world/rss',
  'https://www.france24.com/fr/rss',
  'https://www.aljazeera.com/xml/rss/all.xml',
  'https://www.politico.eu/feed/',
  'https://www.liberation.fr/rss/',
  'https://www.reutersagency.com/feed/?best-topics=politics',
  'https://www.bloomberg.com/feed/podcast/bloomberg-daybreak-europe.xml',
  'https://www.mediapart.fr/articles/feed',
  'https://www.lemonde.fr/rss/une.xml',
];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchHeadlines() {
  const items = [];
  for (const url of RSS_SOURCES) {
    try {
      const feed = await parser.parseURL(url);
      if (feed.items?.length) {
        items.push(...feed.items.slice(0, 3));
      }
    } catch (err) {
      console.error(`❌ Erreur parsing RSS ${url}`, err.message);
    }
  }
  return items;
}

async function generateTweet(title, summary) {
  try {
    const prompt = `Fais un tweet court (max 280 caractères) avec seulement des emojis au début et à la fin. Sois putaclic mais crédible. Résume ça : "${title}" - ${summary}`;
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 1,
    });
    return completion.choices[0].message.content.trim();
  } catch (err) {
    console.error("❌ Erreur OpenAI :", err.message);
    return null;
  }
}

async function tweetOnX(page, content) {
  try {
    await page.goto('https://x.com/compose/tweet', { waitUntil: 'networkidle2' });
    await page.waitForSelector('div[aria-label="Tweet text"]', { timeout: 10000 });
    await page.type('div[aria-label="Tweet text"]', content);
    await sleep(1000);
    await page.keyboard.press('Meta+Enter');
    console.log("✅ Tweet envoyé :", content);
  } catch (err) {
    console.error("❌ Erreur tweetOnX:", err.message);
  }
}

async function loginToX() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.goto('https://x.com/login');
    await page.type('input[name="text"]', credentials.username);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);
    await page.type('input[name="password"]', credentials.password);
    await page.keyboard.press('Enter');
    await page.waitForNavigation({ waitUntil: 'networkidle2' });
    console.log("✅ Connexion réussie");
    return { browser, page };
  } catch (err) {
    console.error("❌ Erreur de connexion :", err.message);
    await browser.close();
    return null;
  }
}

async function main() {
  const session = await loginToX();
  if (!session) return;
  const { browser, page } = session;

  const headlines = await fetchHeadlines();
  const shuffled = headlines.sort(() => 0.5 - Math.random());

  for (let item of shuffled.slice(0, 60)) {
    const tweet = await generateTweet(item.title, item.contentSnippet || item.content || "");
    if (tweet) {
      await tweetOnX(page, tweet);
      const delay = Math.floor(Math.random() * (10 - 5 + 1) + 5) * 60 * 1000;
      console.log(`⏳ Attente ${delay / 60000} minutes avant le prochain tweet...`);
      await sleep(delay);
    }
  }

  await browser.close();
}

main();
