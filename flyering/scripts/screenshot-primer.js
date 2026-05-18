import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function takeScreenshots() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // Desktop screenshot - app home
  await page.setViewportSize({ width: 1200, height: 800 });
  await page.goto('https://letters-cambridge.web.app/stories/flyering/', { waitUntil: 'networkidle' });
  await page.waitForSelector('.leaflet-container', { timeout: 10000 });
  await page.screenshot({ 
    path: path.join(__dirname, 'figures/app-desktop.png'),
    fullPage: false
  });
  
  // Mobile screenshot
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('https://letters-cambridge.web.app/stories/flyering/', { waitUntil: 'networkidle' });
  await page.screenshot({ 
    path: path.join(__dirname, 'figures/app-mobile.png'),
    fullPage: false
  });
  
  // Algorithm panel screenshot
  await page.click('button:has-text("Nearest Neighbor")');
  await page.click('#runBtn');
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ 
    path: path.join(__dirname, 'figures/app-desktop-2.png'),
    fullPage: false
  });
  
  await browser.close();
  
  console.log('Screenshots taken successfully');
}

takeScreenshots().catch(console.error);
