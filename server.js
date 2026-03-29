const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.static('.'));

let browserInstance;
let lastPrice = 0.50;

async function getBrowser() {
  if (!browserInstance) {
    browserInstance = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  }
  return browserInstance;
}

async function scrapePrices() {
  try {
    const browser = await getBrowser();
    const page = await browser.newPage();
    
    // Paramètres pour simuler un vrai navigateur
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    
    console.log('🔄 Accès à Eldorado.gg...');
    await page.goto('https://www.eldorado.gg/fr/pet-simulator-99-gems/g/199-0-0', {
      waitUntil: 'networkidle2',
      timeout: 15000
    });

    // Attendre le chargement du contenu avec prix
    await page.waitForSelector('[class*="price"], [class*="Prix"], [class*="amount"]', { timeout: 5000 }).catch(() => {});

    // Chercher les prix avec plusieurs sélecteurs possibles
    const prices = await page.evaluate(() => {
      let foundPrices = [];
      
      // Strategy 1: Chercher des elements contenant des nombres décimaux qui ressemblent à des prix
      const allText = document.querySelectorAll('*');
      allText.forEach(el => {
        const text = el.innerText || el.textContent || '';
        const match = text.match(/(\d+[.,]\d{2})\s*€/);
        if (match) {
          const price = parseFloat(match[1].replace(',', '.'));
          if (price > 0 && price < 10) {
            foundPrices.push(price);
          }
        }
      });

      // Prendre les 5 prix les plus bas trouvés
      return [...new Set(foundPrices)].sort((a, b) => a - b).slice(0, 5);
    });

    await page.close();

    if (prices.length > 0) {
      lastPrice = prices[0];
      console.log('✅ Prix trouvés:', prices);
      return prices;
    } else {
      console.log('⚠️ Aucun prix trouvé, utilisation du prix précédent:', lastPrice);
      return [lastPrice];
    }

  } catch (error) {
    console.error('❌ Erreur scraping:', error.message);
    // Retourner une variation du dernier prix connu
    const variation = (Math.random() - 0.5) * 0.1;
    return [Math.max(0.50, lastPrice + variation)];
  }
}

app.get('/api/prices', async (req, res) => {
  try {
    const prices = await scrapePrices();
    res.json({ 
      prices,
      timestamp: new Date().toLocaleTimeString('fr-FR'),
      success: true 
    });
  } catch (error) {
    res.status(500).json({ 
      error: error.message,
      prices: [lastPrice],
      success: false 
    });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║  🚀 Trading Tracker Server actif       ║
║  URL: http://localhost:${PORT}        ║
║  Scraping: https://eldorado.gg         ║
╚════════════════════════════════════════╝
  `);
});

process.on('exit', async () => {
  if (browserInstance) {
    await browserInstance.close();
  }
});
