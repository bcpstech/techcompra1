/**
 * db/init.js
 * Inicializa la base de datos SQLite con todas las tablas necesarias.
 * Ejecutar: node db/init.js
 */

require('dotenv').config();
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || './db/techcompara.db';

// Crear carpeta si no existe
const dir = path.dirname(DB_PATH);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const db = new Database(DB_PATH);

// â”€â”€ Activar WAL para mejor rendimiento en lecturas concurrentes
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  -- â”€â”€ TIENDAS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  CREATE TABLE IF NOT EXISTS stores (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    url         TEXT NOT NULL,
    full_url    TEXT NOT NULL,
    logo_url    TEXT,
    rating      REAL DEFAULT 0,
    review_count INTEGER DEFAULT 0,
    description TEXT,
    shipping    TEXT,
    payment     TEXT,
    founded     TEXT,
    active      INTEGER DEFAULT 1,
    created_at  TEXT DEFAULT (datetime('now')),
    updated_at  TEXT DEFAULT (datetime('now'))
  );

  -- â”€â”€ CATEGORÃAS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  CREATE TABLE IF NOT EXISTS categories (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    icon        TEXT,
    parent_id   TEXT REFERENCES categories(id),
    sort_order  INTEGER DEFAULT 0
  );

  -- â”€â”€ PRODUCTOS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  CREATE TABLE IF NOT EXISTS products (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    external_id   TEXT UNIQUE,        -- ID del producto en la tienda origen
    category_id   TEXT REFERENCES categories(id),
    brand         TEXT NOT NULL,
    name          TEXT NOT NULL,
    slug          TEXT UNIQUE,
    image_url     TEXT,
    description   TEXT,
    specs         TEXT,               -- JSON con especificaciones tÃ©cnicas
    tags          TEXT,               -- JSON array de etiquetas
    created_at    TEXT DEFAULT (datetime('now')),
    updated_at    TEXT DEFAULT (datetime('now'))
  );

  -- â”€â”€ PRECIOS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  -- Un registro por producto/tienda/fecha (histÃ³rico completo)
  CREATE TABLE IF NOT EXISTS prices (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id    INTEGER REFERENCES products(id) ON DELETE CASCADE,
    store_id      TEXT REFERENCES stores(id),
    price         INTEGER NOT NULL,   -- Precio en CLP (sin decimales)
    price_normal  INTEGER,            -- Precio normal si hay oferta
    discount_pct  INTEGER,            -- % descuento calculado
    currency      TEXT DEFAULT 'CLP',
    stock         TEXT DEFAULT 'unknown', -- 'in_stock','low_stock','out_of_stock','unknown'
    product_url   TEXT,               -- URL directa al producto en la tienda
    price_date    TEXT,
    scraped_at    TEXT DEFAULT (datetime('now')),
    UNIQUE(product_id, store_id, price_date)  -- Un precio por dÃ­a por tienda
  );

  -- â”€â”€ SCRAPING LOGS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  CREATE TABLE IF NOT EXISTS scrape_logs (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    store_id      TEXT REFERENCES stores(id),
    status        TEXT NOT NULL,      -- 'running','success','partial','failed'
    products_found  INTEGER DEFAULT 0,
    products_updated INTEGER DEFAULT 0,
    errors_count  INTEGER DEFAULT 0,
    error_detail  TEXT,
    duration_ms   INTEGER,
    started_at    TEXT DEFAULT (datetime('now')),
    finished_at   TEXT
  );

  -- â”€â”€ ÃNDICES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  CREATE INDEX IF NOT EXISTS idx_prices_product ON prices(product_id);
  CREATE INDEX IF NOT EXISTS idx_prices_store ON prices(store_id);
  CREATE INDEX IF NOT EXISTS idx_prices_date ON prices(date(scraped_at));
  CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
  CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand);
`);

// â”€â”€ INSERTAR DATOS INICIALES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const insertStore = db.prepare(`
  INSERT OR REPLACE INTO stores (id, name, url, full_url, rating, review_count, description, shipping, payment, founded)
  VALUES (@id, @name, @url, @full_url, @rating, @review_count, @description, @shipping, @payment, @founded)
`);

const stores = [
  { id:'n1g',       name:'N1G',          url:'www.n1g.cl',               full_url:'https://www.n1g.cl',              rating:4.3, review_count:1280, description:'Tienda especializada en componentes gaming y hardware de alto rendimiento.',       shipping:'24-48 hrs', payment:'DÃ©bito, CrÃ©dito, Transferencia', founded:'2015' },
  { id:'alltec',    name:'Alltec',        url:'www.alltec.cl',            full_url:'https://www.alltec.cl',           rating:4.5, review_count:2340, description:'Una de las tiendas con mayor variedad de componentes y precios competitivos.',       shipping:'24-72 hrs', payment:'Todos los medios',                founded:'2010' },
  { id:'cg',        name:'CentralGamer', url:'www.centralgamer.cl',      full_url:'https://www.centralgamer.cl',     rating:4.1, review_count:890,  description:'Especialistas en gaming, perifÃ©ricos y PCs armadas de alto rendimiento.',           shipping:'48-72 hrs', payment:'DÃ©bito, CrÃ©dito, WebPay',        founded:'2017' },
  { id:'centrale',  name:'Centrale',     url:'www.centrale.cl',          full_url:'https://www.centrale.cl',         rating:4.4, review_count:1650, description:'Gran variedad de productos tecnolÃ³gicos con buenos precios en RAM y almacenamiento.', shipping:'24-48 hrs', payment:'Todos los medios',                founded:'2012' },
  { id:'pcexpress', name:'PC-Express',   url:'tienda.pc-express.cl',     full_url:'https://tienda.pc-express.cl',    rating:4.2, review_count:760,  description:'Especialistas en armado de PCs a medida con buena relaciÃ³n calidad-precio.',         shipping:'48-96 hrs', payment:'Transferencia, DÃ©bito, CrÃ©dito',  founded:'2014' }
];

const insertCategory = db.prepare(`
  INSERT OR REPLACE INTO categories (id, name, icon, parent_id, sort_order)
  VALUES (@id, @name, @icon, @parent_id, @sort_order)
`);

const categories = [
  { id:'gpu',      name:'Tarjetas GrÃ¡ficas', icon:'ðŸŽ®', parent_id:null, sort_order:1 },
  { id:'cpu',      name:'Procesadores',      icon:'âš¡', parent_id:null, sort_order:2 },
  { id:'ram',      name:'Memorias RAM',      icon:'ðŸ’¾', parent_id:null, sort_order:3 },
  { id:'storage',  name:'Almacenamiento',    icon:'ðŸ’¿', parent_id:null, sort_order:4 },
  { id:'cooling',  name:'RefrigeraciÃ³n',     icon:'â„ï¸', parent_id:null, sort_order:5 },
  { id:'mobo',     name:'Placas Madre',      icon:'ðŸ”Œ', parent_id:null, sort_order:6 },
  { id:'psu',      name:'Fuentes de Poder',  icon:'âš™ï¸', parent_id:null, sort_order:7 },
  { id:'case',     name:'Gabinetes',         icon:'ðŸ–¥ï¸', parent_id:null, sort_order:8 },
  { id:'monitor',  name:'Monitores',         icon:'ðŸ–±ï¸', parent_id:null, sort_order:9 },
  { id:'periph',   name:'PerifÃ©ricos',       icon:'âŒ¨ï¸', parent_id:null, sort_order:10 },
  // SubcategorÃ­as GPU
  { id:'gpu-nvidia', name:'NVIDIA GeForce RTX', icon:'ðŸŽ®', parent_id:'gpu', sort_order:1 },
  { id:'gpu-amd',    name:'AMD Radeon RX',       icon:'ðŸŽ®', parent_id:'gpu', sort_order:2 },
  // SubcategorÃ­as CPU
  { id:'cpu-intel',  name:'Intel Core Ultra',    icon:'âš¡', parent_id:'cpu', sort_order:1 },
  { id:'cpu-amd',    name:'AMD Ryzen',            icon:'âš¡', parent_id:'cpu', sort_order:2 },
  // SubcategorÃ­as RAM
  { id:'ram-ddr5',   name:'DDR5',                icon:'ðŸ’¾', parent_id:'ram', sort_order:1 },
  { id:'ram-ddr4',   name:'DDR4',                icon:'ðŸ’¾', parent_id:'ram', sort_order:2 },
  // SubcategorÃ­as Storage
  { id:'ssd-nvme',   name:'NVMe M.2 PCIe 5.0/4.0', icon:'ðŸ’¿', parent_id:'storage', sort_order:1 },
  { id:'ssd-sata',   name:'SSD SATA',            icon:'ðŸ’¿', parent_id:'storage', sort_order:2 },
  { id:'hdd',        name:'HDD',                 icon:'ðŸ’¿', parent_id:'storage', sort_order:3 },
];

const runInserts = db.transaction(() => {
  stores.forEach(s => insertStore.run(s));
  categories.forEach(c => insertCategory.run(c));
});

runInserts();

console.log('âœ… Base de datos inicializada correctamente en:', DB_PATH);
console.log('   Tablas: stores, categories, products, prices, scrape_logs');
console.log('   Tiendas insertadas:', stores.length);
console.log('   CategorÃ­as insertadas:', categories.length);

db.close();
