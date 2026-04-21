/**
 * scraper/stores/centralgamer.js
 * Scraper para www.centralgamer.cl
 */

const BaseScraper = require('../base-scraper');

const CATEGORY_URLS = [
  { url: 'https://www.centralgamer.cl/categoria-producto/tarjetas-de-video/', catId: 'gpu'     },
  { url: 'https://www.centralgamer.cl/categoria-producto/procesadores/',      catId: 'cpu'     },
  { url: 'https://www.centralgamer.cl/categoria-producto/memorias/',          catId: 'ram'     },
  { url: 'https://www.centralgamer.cl/categoria-producto/almacenamiento/',    catId: 'storage' },
  { url: 'https://www.centralgamer.cl/categoria-producto/refrigeracion/',     catId: 'cooling' },
  { url: 'https://www.centralgamer.cl/categoria-producto/placas-madre/',      catId: 'mobo'    },
  { url: 'https://www.centralgamer.cl/categoria-producto/fuentes/',           catId: 'psu'     },
  { url: 'https://www.centralgamer.cl/categoria-producto/monitores/',         catId: 'monitor' },
  { url: 'https://www.centralgamer.cl/categoria-producto/perifericos/',       catId: 'periph'  },
];

class CentralGamerScraper extends BaseScraper {
  constructor() {
    super('cg', 'CentralGamer');
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
      const url = pageNum === 1 ? baseUrl : `${baseUrl}page/${pageNum}/`;
      const ok = await this.navigateWithRetry(page, url);
      if (!ok) break;

      try {
        await page.waitForSelector('.products .product, ul.products li.product', { timeout: 10000 });
      } catch { break; }

      const products = await page.evaluate((catId) => {
        const items = [];
        document.querySelectorAll('ul.products li.product, .products .product').forEach(el => {
          const nameEl  = el.querySelector('.woocommerce-loop-product__title, h2');
          const priceEl = el.querySelector('.price ins .amount, .price .amount, .woocommerce-Price-amount');
          const normalEl = el.querySelector('.price del .amount');
          const linkEl  = el.querySelector('a.woocommerce-loop-product__link, a');
          const imgEl   = el.querySelector('img');

          const name  = nameEl?.textContent?.trim();
          const price = priceEl?.textContent?.trim();
          if (name && price) {
            items.push({
              name,
              price,
              normal: normalEl?.textContent?.trim(),
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
        if (!current) continue;
        const normal = this.parsePrice(item.normal);
        this.stats.found++;
        this.saveProduct(
          { name: item.name, category: item.catId, imageUrl: item.imgSrc },
          { current, normal, discount: normal ? Math.round((1 - current / normal) * 100) : null, stock: 'in_stock', url: item.href }
        );
      }

      const next = await page.$('.woocommerce-pagination .next, .next.page-numbers');
      hasMore = !!next;
      pageNum++;
      await this.delay();
    }
  }
}

if (require.main === module) {
  new CentralGamerScraper().run().then(r => { console.log('Resultado CentralGamer:', r); process.exit(r.success ? 0 : 1); });
}

module.exports = CentralGamerScraper;
