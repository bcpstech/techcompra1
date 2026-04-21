/**
 * scraper/stores/alltec.js
 * Scraper para www.alltec.cl
 *
 * Alltec usa PrestaShop — la paginación es por query string (?p=2)
 * y los selectores son distintos a WooCommerce.
 */

const BaseScraper = require('../base-scraper');

const CATEGORY_URLS = [
  { url: 'https://www.alltec.cl/106-tarjetas-de-video',  catId: 'gpu'     },
  { url: 'https://www.alltec.cl/109-procesadores',       catId: 'cpu'     },
  { url: 'https://www.alltec.cl/110-memorias-ram',       catId: 'ram'     },
  { url: 'https://www.alltec.cl/113-almacenamiento',     catId: 'storage' },
  { url: 'https://www.alltec.cl/refrigeracion',          catId: 'cooling' },
  { url: 'https://www.alltec.cl/placas-madre',           catId: 'mobo'    },
  { url: 'https://www.alltec.cl/fuentes-de-poder',       catId: 'psu'     },
  { url: 'https://www.alltec.cl/gabinetes',              catId: 'case'    },
  { url: 'https://www.alltec.cl/monitores',              catId: 'monitor' },
  { url: 'https://www.alltec.cl/perifericos',            catId: 'periph'  },
];

class AlltecScraper extends BaseScraper {
  constructor() {
    super('alltec', 'Alltec');
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
    const MAX_PAGES = 20;

    while (hasMore && pageNum <= MAX_PAGES) {
      const url = pageNum === 1 ? baseUrl : `${baseUrl}?p=${pageNum}`;
      this.log('info', `Scraping pág ${pageNum}`, { url });

      const ok = await this.navigateWithRetry(page, url);
      if (!ok) { this.stats.errors++; break; }

      try {
        await page.waitForSelector('.product-miniature, .js-product', { timeout: 10000 });
      } catch {
        break;
      }

      const products = await page.evaluate((catId) => {
        const items = [];
        // Selectores PrestaShop 1.7+
        document.querySelectorAll('.product-miniature, .js-product').forEach(el => {
          const nameEl   = el.querySelector('.product-title a, h3.product-title, .product-name a');
          const priceEl  = el.querySelector('.price, .product-price-and-shipping .price');
          const normalEl = el.querySelector('.regular-price, s.regular-price');
          const linkEl   = el.querySelector('a.thumbnail, .product-title a');
          const imgEl    = el.querySelector('img.product-img, img');

          const name   = nameEl?.textContent?.trim();
          const price  = priceEl?.textContent?.trim();
          const normal = normalEl?.textContent?.trim();
          const href   = linkEl?.href || nameEl?.href;
          const imgSrc = imgEl?.dataset?.src || imgEl?.src;

          if (name && price) {
            items.push({ name, price, normal, href, imgSrc, catId });
          }
        });
        return items;
      }, catId);

      if (!products.length) { hasMore = false; break; }

      for (const item of products) {
        const current = this.parsePrice(item.price);
        if (!current) continue;
        const normal = this.parsePrice(item.normal);
        this.stats.found++;
        this.saveProduct(
          { name: item.name, category: item.catId, imageUrl: item.imgSrc },
          {
            current,
            normal,
            discount: normal ? Math.round((1 - current / normal) * 100) : null,
            stock: 'in_stock',
            url: item.href,
          }
        );
      }

      const nextExists = await page.$('.pagination .next, a[rel="next"], li.next a');
      hasMore = !!nextExists;
      pageNum++;
      await this.delay(800, 2000);
    }
  }
}

if (require.main === module) {
  new AlltecScraper().run().then(r => { console.log('Resultado Alltec:', r); process.exit(r.success ? 0 : 1); });
}

module.exports = AlltecScraper;
