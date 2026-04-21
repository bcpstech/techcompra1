/**
 * scraper/base-scraper.js
 * Clase base que maneja Puppeteer, reintentos, delays y guardado en DB.
 * Cada tienda extiende esta clase e implementa `scrapeCategory(page, url)`.
 */

require('dotenv').config();
const puppeteer = require('puppeteer');
const { upsertProduct, upsertPrice, logScrape } = require('../db/database');
const logger = require('./logger');

const TIMEOUT    = parseInt(process.env.SCRAPE_TIMEOUT   || 30000);
const DELAY_MIN  = parseInt(process.env.SCRAPE_DELAY_MIN || 1500);
const DELAY_MAX  = parseInt(process.env.SCRAPE_DELAY_MAX || 4000);
const MAX_RETRY  = parseInt(process.env.SCRAPE_MAX_RETRIES || 3);

class BaseScraper {
  /**
   * @param {string} storeId  - ID en DB (ej: 'n1g')
   * @param {string} storeName - Nombre legible
   */
  constructor(storeId, storeName) {
    this.storeId   = storeId;
    this.storeName = storeName;
    this.browser   = null;
    this.stats     = { found: 0, updated: 0, errors: 0 };
  }

  // ── Utilidades ──────────────────────────────────────────────────────────

  delay(min = DELAY_MIN, max = DELAY_MAX) {
    const ms = Math.floor(Math.random() * (max - min + 1)) + min;
    return new Promise(r => setTimeout(r, ms));
  }

  log(level, msg, extra = {}) {
    logger[level](msg, { store: this.storeId, ...extra });
  }

  /** Limpia un precio chileno: "$ 1.299.990" → 1299990 */
  parsePrice(raw) {
    if (!raw) return null;
    const cleaned = String(raw).replace(/[^\d]/g, '');
    const num = parseInt(cleaned, 10);
    return isNaN(num) ? null : num;
  }

  /** Genera un slug URL-friendly */
  slugify(text) {
    return text
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /** Detecta categoría por nombre de producto */
  detectCategory(name) {
    const n = name.toLowerCase();
    if (/rtx|radeon|geforce|gpu|tarjeta (gráfica|de video)/i.test(n)) return 'gpu';
    if (/ryzen|core (ultra|i[3579])|procesador|cpu/i.test(n))          return 'cpu';
    if (/ddr[45]|ram|memoria/i.test(n))                                  return 'ram';
    if (/nvme|ssd|m\.2|disco (sólido|duro)|hdd/i.test(n))              return 'storage';
    if (/refriger|cooling|disipador|aio|cooler/i.test(n))               return 'cooling';
    if (/placa madre|motherboard|mainboard/i.test(n))                   return 'mobo';
    if (/fuente (de poder|de alimentación)|psu/i.test(n))               return 'psu';
    if (/gabinete|case|torre/i.test(n))                                  return 'case';
    if (/monitor|pantalla/i.test(n))                                     return 'monitor';
    if (/teclado|mouse|headset|audifonos|auricular/i.test(n))           return 'periph';
    return 'other';
  }

  // ── Puppeteer ───────────────────────────────────────────────────────────

  async launchBrowser() {
    this.browser = await puppeteer.launch({
      headless: process.env.PUPPETEER_HEADLESS !== 'false',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1366,768',
        '--disable-blink-features=AutomationControlled',
      ],
      defaultViewport: { width: 1366, height: 768 },
    });
    this.log('info', 'Browser iniciado');
  }

  async newPage() {
    const page = await this.browser.newPage();

    // Evitar detección de bot
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
    });

    // Headers realistas
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'es-CL,es;q=0.9,en;q=0.8',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    });
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    page.setDefaultTimeout(TIMEOUT);
    page.setDefaultNavigationTimeout(TIMEOUT);
    return page;
  }

  async closeBrowser() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.log('info', 'Browser cerrado');
    }
  }

  // ── Navegar con reintentos ───────────────────────────────────────────────

  async navigateWithRetry(page, url, retries = MAX_RETRY) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
        return true;
      } catch (err) {
        this.log('warn', `Intento ${attempt}/${retries} fallido: ${err.message}`, { url });
        if (attempt < retries) await this.delay(2000, 5000);
      }
    }
    return false;
  }

  // ── Guardar producto + precio en DB ─────────────────────────────────────

  saveProduct(product, price) {
    try {
      const external_id = `${this.storeId}_${this.slugify(product.name)}`;
      const row = upsertProduct({
        external_id,
        category_id: product.category || this.detectCategory(product.name),
        brand:       product.brand || 'Desconocido',
        name:        product.name,
        slug:        this.slugify(product.name),
        image_url:   product.imageUrl || null,
        specs:       product.specs ? JSON.stringify(product.specs) : null,
        tags:        product.tags  ? JSON.stringify(product.tags)  : null,
      });

      if (!row || !row.id) return;

      upsertPrice({
        product_id:   row.id,
        store_id:     this.storeId,
        price:        price.current,
        price_normal: price.normal || null,
        discount_pct: price.discount || null,
        stock:        price.stock || 'unknown',
        product_url:  price.url || null,
      });

      this.stats.updated++;
    } catch (err) {
      this.stats.errors++;
      this.log('error', `Error guardando producto: ${err.message}`, { product: product.name });
    }
  }

  // ── Método principal — ejecuta el scraping completo de la tienda ────────

  async run() {
    const startTime = Date.now();
    const logId = logScrape(this.storeId, 'running');
    this.log('info', `⬇️  Iniciando scraping`);

    try {
      await this.launchBrowser();
      await this.scrapeAll();

      const duration = Date.now() - startTime;
      logScrape(this.storeId, 'success', { ...this.stats, duration, logId });
      this.log('info', `✅ Completado en ${(duration/1000).toFixed(1)}s — ${this.stats.updated} productos actualizados`);
      return { success: true, ...this.stats, duration };

    } catch (err) {
      const duration = Date.now() - startTime;
      logScrape(this.storeId, 'failed', { ...this.stats, errors: this.stats.errors + 1, errorDetail: err.message, duration, logId });
      this.log('error', `❌ Error fatal: ${err.message}`);
      return { success: false, error: err.message, ...this.stats };

    } finally {
      await this.closeBrowser();
    }
  }

  /**
   * IMPLEMENTAR EN CADA SUBCLASE
   * Debe llamar a `this.saveProduct(product, price)` por cada item encontrado
   */
  async scrapeAll() {
    throw new Error(`scrapeAll() debe implementarse en ${this.constructor.name}`);
  }
}

module.exports = BaseScraper;
