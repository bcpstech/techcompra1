# TechCompara.cl 🖥️

> Comparador de precios de hardware en Chile — actualización automática diaria a las 00:00 hrs.

[![Scraping Diario](https://github.com/TU_USUARIO/techcompara/actions/workflows/scraping-diario.yml/badge.svg)](https://github.com/TU_USUARIO/techcompara/actions)

**🌐 Demo en vivo:** `https://TU_USUARIO.github.io/techcompara`

---

## ¿Cómo funciona?

Cada noche a las **00:00 hora de Chile**, GitHub Actions ejecuta el scraper automáticamente, exporta los precios a archivos JSON en `docs/data/`, hace commit y GitHub Pages sirve la web actualizada. **Costo: $0**.

```
GitHub Actions (00:00 CLT)
  → Puppeteer scrapa 5 tiendas
  → SQLite → JSON en docs/data/
  → git commit + push automático
  → GitHub Pages muestra precios actualizados
```

---

## 🚀 Configuración en 4 pasos

### 1. Fork del repositorio
En GitHub: botón **Fork** arriba a la derecha.

### 2. Activar GitHub Pages
Settings → Pages → Source: **main** / carpeta **`/docs`** → Save.
Tu sitio quedará en `https://TU_USUARIO.github.io/techcompara`

### 3. Dar permisos de escritura a Actions
Settings → Actions → General → **Read and write permissions** → Save.

### 4. Primer scraping manual
Actions → **Scraping Diario** → **Run workflow** → espera ~30 min → listo.

---

## 📁 Estructura

```
techcompara/
├── .github/workflows/
│   └── scraping-diario.yml   ← Corre cada noche a las 00:00 CLT
├── docs/                     ← GitHub Pages sirve esta carpeta
│   ├── index.html            ← Frontend completo
│   └── data/                 ← JSONs generados automáticamente
│       ├── meta.json
│       ├── products.json
│       ├── stores.json
│       ├── categories.json
│       └── products/{id}.json
├── scraper/
│   ├── base-scraper.js       ← Puppeteer + reintentos + anti-bot
│   └── stores/
│       ├── n1g.js
│       ├── alltec.js
│       ├── centralgamer.js
│       ├── centrale.js
│       └── pcexpress.js
├── scripts/
│   └── export-json.js        ← DB SQLite → JSON para GitHub Pages
├── db/
│   ├── init.js
│   └── database.js
├── api/server.js             ← API REST (opcional, desarrollo local)
└── scheduler/cron.js         ← Cron para servidor propio (opcional)
```

---

## 🛠️ Desarrollo local

```bash
npm install
cp .env.example .env
node db/init.js
npm run scrape      # Scrapea todas las tiendas
npm run export      # Genera docs/data/*.json
# Abrir docs/index.html en el navegador
```

---

## ⚙️ Si el scraping de una tienda falla

Los selectores CSS pueden cambiar cuando la tienda actualiza su diseño.

1. Abre DevTools (F12) en la página de la tienda
2. Inspecciona el nombre y precio de un producto
3. Actualiza el selector en `scraper/stores/TIENDA.js`

---

## 🏪 Tiendas

| Tienda | URL | CMS detectado |
|--------|-----|---------------|
| N1G | www.n1g.cl | WooCommerce |
| Alltec | www.alltec.cl | PrestaShop |
| CentralGamer | www.centralgamer.cl | WooCommerce |
| Centrale | www.centrale.cl | Custom/React |
| PC-Express | tienda.pc-express.cl | OpenCart |

---

MIT License
