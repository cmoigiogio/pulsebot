require('dotenv').config();
const { OpenAI } = require('openai');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const Parser = require('rss-parser');
const fs = require('fs');
const parser = new Parser();

puppeteer.use(StealthPlugin());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const COOKIE_PATH = './cookies.json';

async function fetchRSSFeeds(urls) {
  const items = [];
  for (const url of urls) {
    try {
      const feed = await parser.parseURL(url);
      items.push(...feed.items.slice(0, 2));
    } catch (err) {
      console.error(`❌ Erreur parsing RSS ${url}`, err.message);
    }
  }
  return items;
}

function randomEmoji() {
  const emojis = ['🚨', '🔥', '💥', '💸', '📉', '🚀', '🤯', '😱', '💎', '🎯'];
  return emojis[Math.floor(Math.random() * emojis.length)];
}

function truncate(text, maxLen) {
  return text.length > maxLen ? text.slice(0, maxLen - 3) + '...' : text;
}

async function generateTweet(title, summary) {
  const prompt = `Fais un tweet PUTACLIC et percutant (max 200 caractères), avec uniquement des emojis AU DÉBUT et à la FIN, en français, à partir de ce résumé : "${summary}".`;
  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 100
  });
  const tweet = completion.choices[0].message.content.trim();
  return `${randomEmoji()} ${truncate(tweet, 250)} ${randomEmoji()}`;
}

async function loginToX(page) {
  await page.goto('https://x.com/login', { waitUntil: 'networkidle2' });

  await page.waitForSelector('input[name="text"]');
  await page.type('input[name="text"]', process.env.X_USERNAME);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2000);

  try {
    await page.waitForSelector('input[name="password"]', { timeout: 5000 });
    await page.type('input[name="password"]', process.env.X_PASSWORD);
    await page.keyboard.press('Enter');
    await page.waitForNavigation({ waitUntil: 'networkidle2' });
  } catch (err) {
    console.error("⚠️ Erreur login :", err.message);
  }

  const cookies = await page.cookies();
  fs.writeFileSync(COOKIE_PATH, JSON.stringify(cookies, null, 2));
  console.log("💾 Cookies enregistrés !");
}

async function tweetOnX(tweet) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox']
  });
  const page = await browser.newPage();

  if (fs.existsSync(COOKIE_PATH)) {
    const cookies = JSON.parse(fs.readFileSync(COOKIE_PATH));
    await page.setCookie(...cookies);
    console.log("🍪 Cookies chargés");
  }

  await page.goto('https://x.com/home', { waitUntil: 'networkidle2' });

  if (page.url().includes('/login')) {
    console.log("🔐 Session expirée, reconnexion...");
    await loginToX(page);
  }

  await page.goto('https://x.com/compose/tweet', { waitUntil: 'networkidle2' });
  await page.waitForSelector('[aria-label="Tweet text"]', { timeout: 10000 });
  await page.type('[aria-label="Tweet text"]', tweet);
  await page.waitForTimeout(1000);

  const tweetBtn = await page.$('div[data-testid="tweetButtonInline"]');
  if (tweetBtn) {
    await tweetBtn.click();
    console.log('✅ Tweet posté !');
  } else {
    console.log('❌ Bouton tweet introuvable');
  }

  await browser.close();
}

async function main() {
  const rssUrls = [
    "https://www.coindesk.com/arc/outboundfeeds/rss/",
    "https://cointelegraph.com/rss",
    "https://decrypt.co/feed"
  ];
  const articles = await fetchRSSFeeds(rssUrls);
  for (const article of articles) {
    try {
      const tweet = await generateTweet(article.title, article.contentSnippet || article.content || article.title);
      await tweetOnX(tweet);
      const delay = 5 + Math.floor(Math.random() * 6);
      console.log(`⏳ Attente ${delay} min avant le prochain tweet...`);
      await new Promise(r => setTimeout(r, delay * 60 * 1000));
    } catch (err) {
      console.error("❌ Erreur OpenAI ou tweet:", err.message);
    }
  }
}

main();