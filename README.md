# PulseBot

Ce bot publie automatiquement des tweets en extrayant des titres via des flux RSS, les résume avec OpenAI, et les publie via une simulation navigateur avec Puppeteer.

## Configuration

1. Remplir le fichier `.env` à partir de `.env.example`
2. Lancer l’installation des dépendances :  
   ```bash
   npm install
   ```
3. Lancer le bot :  
   ```bash
   npm start
   ```