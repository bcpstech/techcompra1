/**
 * scraper/stores/n1g.js
 * Scraper para www.n1g.cl
 *
 * Estrategia: itera por categoría de hardware, carga paginación,
 * extrae nombre, precio y URL de cada producto.
 *
 * NOTA: Los selectores CSS deben revisarse si el sitio cambia su diseño.
 * Para inspeccionarlos: DevTools → Elements → copiar selector del precio/nombre.
 */

const BaseScraper = require('../base-scraper');

// URLs de categorías de hardware en n1g.cl
// Ajustar si el sitio cambia la estructura de URLs
const CATEGORY_URLS = [
  { url: 'https://www.n1g.cl/categoria/tarjetas-de-video/',   catId: 'gpu'     },
  { url: 'https://www.n1g.cl/categoria/procesadores/',        catId: 'cpu'     },
  { url: 'https://www.n1g.cl/categoria/memorias-ram/',        catId: 'ram'     },
  { url: 'https://www.n1g.cl/categoria/almacenamiento/',      catId: 'storage' },
  { url: 'https://www.n1g.cl/categoria/refrigeracion/',       catId: 'cooling' },
  { url: 'https://www.n1g.cl/categoria/placas-madre/',        catId: 'mobo'    },
  { url: 'https://www.n1g.cl/categoria/fuentes-de-poder/',    catId: 'psu'     },
  { url: 'https://www.n1g.cl/categoria/gabinetes/',           catId: 'case'    },
  { url: 'https://www.n1g.cl/categoria/monitores/',           catId: 'monitor' },
  { url: 'https://www.n1g.cl/categoria/perifericos/',         catId: 'periph'  },
];

class N1GScraper extends BaseScraper {
  constructor() {
    super('n1g', 'N1G');
  }

  async scrapeAll() {
    const page = await this.newPage();

    for (const { url, catId } of CATEGORY_URLS) {
      try {
        await this.scrapeCategory(page, url, catId);
        await this.delay();
      } catch (err) {
        this.stats.errors++;
        this.log('warn', `Error en categoría ${catId}: ${err.message}`, { url });
      }
    }

    await page.close();
  }

  async scrapeCategory(page, baseUrl, catId) {
    let pageNum = 1;
    let hasMore = true;

    while (hasMore) {
      const url = pageNum === 1 ? baseUrl : `${baseUrl}page/${pageNum}/`;
      this.log('info', `Scraping pág ${pageNum}`, { url });

      const ok = await this.navigateWithRetry(page, url);
      if (!ok) { this.stats.errors++; break; }

      // ── Esperar productos ──────────────────────────────────────────────
      try {
        await page.waitForSelector('.product', { timeout: 10000 });
      } catch {
        this.log('info', `No hay más productos en pág ${pageNum}`);
        break;
      }

      // ── Extraer productos ──────────────────────────────────────────────
      const products = await page.evaluate((catId) => {
        const items = [];
        // Selectores típicos de WooCommerce (que usan muchas tiendas chilenas)
        document.querySelectorAll('li.product, .product-item, .woocommerce-loop-product').forEach(el => {
          const nameEl    = el.querySelector('.woocommerce-loop-product__title, h2.product-name, .product-title, h2');
          const priceEl   = el.querySelector('.price ins .amount, .price .amount, .price bdi, [class*="price"]');
          const normalEl  = el.querySelector('.price del .amount, .price del bdi');
          const linkEl    = el.querySelector('a');
          const imgEl     = el.querySelector('img');
          const stockEl   = el.querySelector('.stock, [class*="stock"]');

          const name    = nameEl?.textContent?.trim();
          const price   = priceEl?.textContent?.trim();
          const normal  = normalEl?.textContent?.trim();
          const href    = linkEl?.href;
          const imgSrc  = imgEl?.dataset?.src || imgEl?.src;
          const stock   = stockEl?.textContent?.includes('Agotado') ? 'out_of_stock' : 'in_stock';

          if (name && price) {
            items.push({ name, price, normal, href, imgSrc, stock, catId });
          }
        });
        return items;
      }, catId);

      if (!products.length) {
        hasMore = false;
        break;
      }

      // ── Guardar en DB ──────────────────────────────────────────────────
      for (const item of products) {
        const current = this.parsePrice(item.price);
        const normal  = this.parsePrice(item.normal);
        if (!current) continue;

        this.stats.found++;
        this.saveProduct(
          {
            name:     item.name,
            category: item.catId,
            imageUrl: item.imgSrc,
          },
          {
            current,
            normal,
            discount: normal ? Math.round((1 - current / normal) * 100) : null,
            stock:    item.stock,
            url:      item.href,
          }
        );
      }

      // ── ¿Hay página siguiente? ─────────────────────────────────────────
      const nextExists = await page.$('.next.page-numbers, a.next, [aria-label="Siguiente"]');
      if (!nextExists || products.length < 4) {
        hasMore = false;
      } else {
        pageNum++;
        await this.delay(1000, 2500);
      }
    }
  }
}

// Ejecutar directamente si se llama como script
if (require.main === module) {
  const scraper = new N1GScraper();
  scraper.run().then(result => {
    console.log('Resultado N1G:', result);
    process.exit(result.success ? 0 : 1);
  });
}

module.exports = N1GScraper;
