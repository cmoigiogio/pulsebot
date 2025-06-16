
require('dotenv').config();
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const Parser = require('rss-parser');
const { Configuration, OpenAIApi } = require('openai');

puppeteer.use(StealthPlugin());

const parser = new Parser();

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

const RSS_SOURCES = [
  'https://www.coindesk.com/arc/outboundfeeds/rss/',
  'https://cointelegraph.com/rss',
  'https://decrypt.co/feed',
  'https://foreignpolicy.com/feed/',
  'https://www.reuters.com/tools/rss',
  'https://www.economist.com/the-world-this-week/rss.xml',
  'https://www.france24.com/fr/rss',
  'https://www.bfmtv.com/rss/news-24-7/',
  'https://www.lemonde.fr/rss/une.xml'
];

async function fetchArticles() {
  const articles = [];
  for (const url of RSS_SOURCES) {
    try {
      const feed = await parser.parseURL(url);
      articles.push(...feed.items.slice(0, 5));
    } catch (err) {
      console.error(`❌ Erreur parsing RSS ${url} ${err.message}`);
    }
  }
  return articles;
}

function createPrompt(title, content) {
  return `Résume cet article en une seule phrase percutante, avec un ton putaclic. Mets des emojis uniquement au début et à la fin du message. Rends le tout très court.

Titre : ${title}
Contenu : ${content}`;
}

async function generateTweet(title, content) {
  const prompt = createPrompt(title, content);
  try {
    const response = await openai.createChatCompletion({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 100
    });
    return response.data.choices[0].message.content;
  } catch (err) {
    console.error(`❌ Erreur OpenAI : ${err.message}`);
    return null;
  }
}

async function tweetOnX(content) {
  console.log(`📢 Tweet : ${content}`);
  // Fonction de simulation ou envoi via Puppeteer/X
}

function randomDelay(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min) * 1000;
}

async function main() {
  const articles = await fetchArticles();
  while (true) {
    const article = articles[Math.floor(Math.random() * articles.length)];
    const tweet = await generateTweet(article.title, article.contentSnippet || article.content || '');
    if (tweet) {
      await tweetOnX(tweet);
    }
    const delay = randomDelay(300, 600); // 5 à 10 minutes
    console.log(`⏳ Attente ${delay / 1000}s avant le prochain tweet...`);
    await new Promise(r => setTimeout(r, delay));
  }
}

main();
