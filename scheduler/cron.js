/**
 * scheduler/cron.js
 * Ejecuta el scraping automáticamente cada día a las 00:00 horas (Chile).
 * Uso: node scheduler/cron.js   (proceso permanente en segundo plano)
 *
 * Para producción usar PM2:
 *   pm2 start scheduler/cron.js --name techcompara-scheduler
 *   pm2 save && pm2 startup
 */

require('dotenv').config();
const cron    = require('node-cron');
const logger  = require('../scraper/logger');
const runAll  = require('../scraper/run-all');

const SCHEDULE = process.env.CRON_SCHEDULE || '0 0 * * *'; // Medianoche

// ── Validar expresión cron ────────────────────────────────────────────────
if (!cron.validate(SCHEDULE)) {
  logger.error(`Expresión cron inválida: ${SCHEDULE}`);
  process.exit(1);
}

let isRunning = false;

async function executeScraping() {
  if (isRunning) {
    logger.warn('⚠️  Scraping ya en ejecución, saltando esta vez');
    return;
  }
  isRunning = true;
  const now = new Date().toLocaleString('es-CL', { timeZone: 'America/Santiago' });
  logger.info(`⏰ Scraping programado iniciado — ${now}`);

  try {
    const result = await runAll();
    logger.info(`⏰ Scraping programado completado`, result);
  } catch (err) {
    logger.error(`⏰ Error en scraping programado: ${err.message}`);
  } finally {
    isRunning = false;
  }
}

// ── Programar tarea ───────────────────────────────────────────────────────
const task = cron.schedule(SCHEDULE, executeScraping, {
  timezone: 'America/Santiago'
});

logger.info(`✅ Scheduler iniciado — ejecutará scraping con: "${SCHEDULE}" (América/Santiago)`);
logger.info('   Para ejecutar manualmente ahora: enviar señal SIGUSR1');
logger.info('   Equivale a: cada día a las 00:00 hora de Chile');

// ── Ejecución manual via señal ────────────────────────────────────────────
process.on('SIGUSR1', () => {
  logger.info('📡 Señal SIGUSR1 recibida — ejecutando scraping manual');
  executeScraping();
});

// ── Ejecución inmediata opcional con --now ────────────────────────────────
if (process.argv.includes('--now')) {
  logger.info('▶️  --now detectado: ejecutando scraping inmediatamente');
  executeScraping();
}

// ── Manejo de cierre limpio ───────────────────────────────────────────────
process.on('SIGTERM', () => {
  logger.info('SIGTERM recibido — deteniendo scheduler');
  task.stop();
  process.exit(0);
});
process.on('SIGINT', () => {
  logger.info('SIGINT recibido — deteniendo scheduler');
  task.stop();
  process.exit(0);
});

// ── Status cada hora ──────────────────────────────────────────────────────
setInterval(() => {
  const next = new Date();
  next.setDate(next.getDate() + 1);
  next.setHours(0, 0, 0, 0);
  const diff = Math.round((next - Date.now()) / 3600000 * 10) / 10;
  logger.info(`⏱️  Scheduler activo — próximo scraping en ~${diff}h`, {
    schedule: SCHEDULE,
    isRunning
  });
}, 60 * 60 * 1000);
