require('dotenv').config();
const { OpenAI } = require('openai');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const Parser = require('rss-parser');
const parser = new Parser();
const fs = require('fs');

puppeteer.use(StealthPlugin());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

async function tweetOnX(tweet) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();

  await page.goto('https://x.com/login', { waitUntil: 'networkidle2' });
  await page.waitForSelector('input[name="text"]');
  await page.type('input[name="text"]', process.env.X_USERNAME);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2000);
  await page.type('input[name="password"]', process.env.X_PASSWORD);
  await page.keyboard.press('Enter');
  await page.waitForNavigation({ waitUntil: 'networkidle2' });

  await page.goto('https://x.com/compose/tweet', { waitUntil: 'networkidle2' });
  await page.waitForSelector('[data-testid="tweetTextarea_0"]');
  await page.type('[data-testid="tweetTextarea_0"]', tweet);
  await page.click('[data-testid="tweetButtonInline"]');

  console.log("✅ Tweet posté :", tweet);
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
      const delay = 5 + Math.floor(Math.random() * 6); // 5-10 min
      console.log(`⏳ Attente ${delay} min avant le prochain tweet...`);
      await new Promise(r => setTimeout(r, delay * 60 * 1000));
    } catch (err) {
      console.error("❌ Erreur OpenAI ou tweet:", err.message);
    }
  }
}

main();
