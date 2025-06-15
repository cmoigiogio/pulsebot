require('dotenv').config();
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const Parser = require('rss-parser');
const { Configuration, OpenAIApi } = require("openai");

const parser = new Parser();
puppeteer.use(StealthPlugin());

const MAX_TWEETS = 60;
const credentials = {
  username: process.env.TWITTER_USERNAME,
  password: process.env.TWITTER_PASSWORD,
};

async function getNewsFromFeeds() {
  const feeds = [
    "https://www.coindesk.com/arc/outboundfeeds/rss/",
    "https://cointelegraph.com/rss",
    "https://decrypt.co/feed",
    "https://www.theblock.co/rss",
    "https://cryptoslate.com/feed/",
    "https://www.lemonde.fr/rss/une.xml",
    "https://www.lequipe.fr/rss/actu_rss.xml",
    "https://www.francetvinfo.fr/titres.rss",
    "https://rss.nytimes.com/services/xml/rss/nyt/World.xml"
  ];
  let allItems = [];

  for (let url of feeds) {
    try {
      const feed = await parser.parseURL(url);
      allItems.push(...feed.items);
    } catch (e) {
      console.warn("Erreur de parsing RSS:", url);
    }
  }

  return allItems.slice(0, MAX_TWEETS);
}

async function summarize(title, link, openai) {
  try {
    const completion = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: [{
        role: "user",
        content: `Fais un résumé putaclic, jeune et adapté à X/Twitter pour cet article : "${title}" (${link}). Format max 280 caractères, avec emojis.`
      }],
      max_tokens: 100
    });

    return completion.data.choices[0].message.content.trim();
  } catch {
    return `${title} (${new URL(link).hostname})`;
  }
}

function waitRandom(min = 20, max = 60) {
  const ms = Math.floor(Math.random() * (max - min + 1) + min) * 1000;
  return new Promise(res => setTimeout(res, ms));
}

async function tweetWithPuppeteer(tweet) {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.goto("https://twitter.com/login");
    await page.type('input[name="text"]', credentials.username, { delay: 30 });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);
    await page.type('input[name="password"]', credentials.password, { delay: 30 });
    await page.keyboard.press('Enter');
    await page.waitForNavigation();

    await page.goto("https://twitter.com/compose/tweet");
    await page.waitForSelector('[data-testid="tweetTextarea_0"]', { timeout: 10000 });
    await page.type('[data-testid="tweetTextarea_0"]', tweet, { delay: 30 });
    await page.click('[data-testid="tweetButtonInline"]');

    console.log("✅ Tweet posté :", tweet);
  } catch (e) {
    console.error("❌ Échec du tweet :", tweet);
  } finally {
    await browser.close();
  }
}

async function main() {
  const openai = new OpenAIApi(new Configuration({ apiKey: process.env.OPENAI_API_KEY }));
  const newsItems = await getNewsFromFeeds();

  for (let item of newsItems) {
    const tweet = await summarize(item.title, item.link, openai);
    await tweetWithPuppeteer(tweet);
    await waitRandom();
  }
}

main();