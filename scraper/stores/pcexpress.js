/**
 * scraper/stores/pcexpress.js
 * Scraper para tienda.pc-express.cl
 *
 * PC-Express usa OpenCart — URLs con route=product/category&path=XX
 */

const BaseScraper = require('../base-scraper');

const CATEGORY_URLS = [
  { url: 'https://tienda.pc-express.cl/index.php?route=product/category&path=24',   catId: 'gpu'     },
  { url: 'https://tienda.pc-express.cl/index.php?route=product/category&path=20',   catId: 'cpu'     },
  { url: 'https://tienda.pc-express.cl/index.php?route=product/category&path=26',   catId: 'ram'     },
  { url: 'https://tienda.pc-express.cl/index.php?route=product/category&path=27',   catId: 'storage' },
  { url: 'https://tienda.pc-express.cl/index.php?route=product/category&path=36',   catId: 'cooling' },
  { url: 'https://tienda.pc-express.cl/index.php?route=product/category&path=21',   catId: 'mobo'    },
  { url: 'https://tienda.pc-express.cl/index.php?route=product/category&path=29',   catId: 'psu'     },
  { url: 'https://tienda.pc-express.cl/index.php?route=product/category&path=30',   catId: 'case'    },
  { url: 'https://tienda.pc-express.cl/index.php?route=product/category&path=45',   catId: 'monitor' },
  { url: 'https://tienda.pc-express.cl/index.php?route=product/category&path=46',   catId: 'periph'  },
];

class PCExpressScraper extends BaseScraper {
  constructor() {
    super('pcexpress', 'PC-Express');
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
    let pageNum = 0; // OpenCart empieza en &page=0
    let hasMore = true;
    const MAX_PAGES = 20;

    while (hasMore && pageNum <= MAX_PAGES) {
      const url = pageNum === 0 ? baseUrl : `${baseUrl}&page=${pageNum + 1}`;
      const ok = await this.navigateWithRetry(page, url);
      if (!ok) break;

      try {
        await page.waitForSelector('.product-layout, .product-grid', { timeout: 10000 });
      } catch { break; }

      const products = await page.evaluate((catId) => {
        const items = [];
        // Selectores OpenCart 3.x
        document.querySelectorAll('.product-layout').forEach(el => {
          const nameEl  = el.querySelector('.caption h4 a, .product-name a');
          const priceEl = el.querySelector('.price-new, .price');
          const normalEl = el.querySelector('.price-old');
          const linkEl  = el.querySelector('a.product-img, .caption h4 a');
          const imgEl   = el.querySelector('img');

          const name  = nameEl?.textContent?.trim();
          const price = priceEl?.textContent?.trim();
          if (name && price) {
            items.push({
              name, price,
              normal: normalEl?.textContent?.trim(),
              href:   nameEl?.href || linkEl?.href,
              imgSrc: imgEl?.src,
              catId
            });
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
          { current, normal, discount: normal ? Math.round((1 - current / normal) * 100) : null, stock: 'in_stock', url: item.href }
        );
      }

      const nextBtn = await page.$('.pagination li a[rel="next"], .pagination .next a');
      hasMore = !!nextBtn;
      pageNum++;
      await this.delay();
    }
  }
}

if (require.main === module) {
  new PCExpressScraper().run().then(r => { console.log('Resultado PC-Express:', r); process.exit(r.success ? 0 : 1); });
}

module.exports = PCExpressScraper;
