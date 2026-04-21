/**
 * scraper/stores/centrale.js
 * Scraper para www.centrale.cl
 */

const BaseScraper = require('../base-scraper');

const CATEGORY_URLS = [
  { url: 'https://www.centrale.cl/componentes/tarjetas-de-video', catId: 'gpu'     },
  { url: 'https://www.centrale.cl/componentes/procesadores',      catId: 'cpu'     },
  { url: 'https://www.centrale.cl/componentes/memorias-ram',      catId: 'ram'     },
  { url: 'https://www.centrale.cl/componentes/almacenamiento',    catId: 'storage' },
  { url: 'https://www.centrale.cl/componentes/refrigeracion',     catId: 'cooling' },
  { url: 'https://www.centrale.cl/componentes/placas-madre',      catId: 'mobo'    },
  { url: 'https://www.centrale.cl/componentes/fuentes-de-poder',  catId: 'psu'     },
  { url: 'https://www.centrale.cl/componentes/gabinetes',         catId: 'case'    },
  { url: 'https://www.centrale.cl/monitores',                     catId: 'monitor' },
  { url: 'https://www.centrale.cl/perifericos',                   catId: 'periph'  },
];

class CentraleScraper extends BaseScraper {
  constructor() {
    super('centrale', 'Centrale');
  }

  async scrapeAll() {
    const page = await this.newPage();
    for (const { url, catId } of CATEGORY_URLS) {
      try {
        await this.scrapeCategory(page, url, catId);
        await this.delay();
      } catch (err) {
        this.stats.errors++;
        this.log('warn', `Error en categoría ${catId}: ${err.message}`);
      }
    }
    await page.close();
  }

  async scrapeCategory(page, baseUrl, catId) {
    let pageNum = 1;
    let hasMore = true;
    const MAX_PAGES = 15;

    while (hasMore && pageNum <= MAX_PAGES) {
      // Centrale puede usar ?page= o /page/ según plataforma
      const url = pageNum === 1 ? baseUrl : `${baseUrl}?page=${pageNum}`;
      const ok = await this.navigateWithRetry(page, url);
      if (!ok) break;

      // Esperar contenido — Centrale puede ser SPA con React/Vue
      try {
        await page.waitForSelector(
          '.product-card, .product-item, [class*="product"], .card-product',
          { timeout: 12000 }
        );
      } catch { break; }

      // Pequeña espera adicional para SPAs
      await this.delay(800, 1200);

      const products = await page.evaluate((catId) => {
        const items = [];
        const selectors = [
          '.product-card', '.product-item',
          '[class*="ProductCard"]', '[class*="product-card"]',
          '.card-product', '.item-product'
        ];
        let found = null;
        for (const sel of selectors) {
          const els = document.querySelectorAll(sel);
          if (els.length > 0) { found = els; break; }
        }
        if (!found) return items;

        found.forEach(el => {
          // Buscar nombre con varios selectores posibles
          const nameEl = el.querySelector(
            'h2, h3, .product-name, .product-title, [class*="name"], [class*="title"]'
          );
          // Buscar precio
          const priceEl = el.querySelector(
            '.price, [class*="price"], .product-price, span[class*="Price"]'
          );
          const linkEl  = el.querySelector('a');
          const imgEl   = el.querySelector('img');

          const name  = nameEl?.textContent?.trim();
          const price = priceEl?.textContent?.trim();

          if (name && price && name.length > 3) {
            items.push({
              name, price,
              href:   linkEl?.href,
              imgSrc: imgEl?.dataset?.src || imgEl?.src,
              catId
            });
          }
        });
        return items;
      }, catId);

      if (!products.length) { hasMore = false; break; }

      for (const item of products) {
        const current = this.parsePrice(item.price);
        if (!current || current < 1000) continue; // Filtrar precios inválidos
        this.stats.found++;
        this.saveProduct(
          { name: item.name, category: item.catId, imageUrl: item.imgSrc },
          { current, stock: 'in_stock', url: item.href }
        );
      }

      // Detectar paginación
      const nextBtn = await page.$(
        'a[aria-label="Next"], .pagination .next, button[aria-label="siguiente"], [class*="next-page"]'
      );
      hasMore = !!nextBtn;
      pageNum++;
      await this.delay();
    }
  }
}

if (require.main === module) {
  new CentraleScraper().run().then(r => { console.log('Resultado Centrale:', r); process.exit(r.success ? 0 : 1); });
}

module.exports = CentraleScraper;
