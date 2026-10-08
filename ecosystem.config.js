const fs = require('fs');
const path = require('path');

// ─── Datos a completar ─────────────────────────────────────────────
const IP_ELASTICA = '3.138.218.34';                           // IP elástica de AWS EC2
const IP_AZURE = '130.131.46.243';                              // IP pública estática de la VM de Azure
const REPO = 'git@github.com:Mesias-prog/Practica-AWS-NODE.git';    // URL SSH del repo
const LLAVE_PEM = '~/.ssh/practica-cloud';                       // llave privada en tu PC
// ───────────────────────────────────────────────────────────────────

const APP_DIR = '/var/www/tu-app';
const LOG_DIR = `${APP_DIR}/logs`;

// Los secretos (MONGODB_URI, WEBHOOK_URL...) NO se suben a GitHub: viven en
// /var/www/tu-app/shared/.env dentro del servidor y se leen aquí al recargar.
function leerEnv(archivo) {
  if (!fs.existsSync(archivo)) return {};
  return Object.fromEntries(
    fs.readFileSync(archivo, 'utf8')
      .split(/\r?\n/)
      .filter((l) => l.trim() && !l.trim().startsWith('#') && l.includes('='))
      .map((l) => {
        const i = l.indexOf('=');
        return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
      })
  );
}
const secretos = leerEnv(path.join(APP_DIR, 'shared', '.env'));

module.exports = {
  apps: [
    {
      name: 'mi-node-app',
      script: './index.js',
      instances: 'max',      // Modo Cluster: usa todos los núcleos de la CPU
      exec_mode: 'cluster',
      wait_ready: true,      // index.js envía 'ready' al empezar a escuchar
      listen_timeout: 10000,
      kill_timeout: 6000,
      max_memory_restart: '300M',

      env: {
        NODE_ENV: 'development',
        PORT: 3000
      },
      // Producción: variables de entorno (los secretos se inyectan desde shared/.env)
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        MONGODB_URI: secretos.MONGODB_URI   // MongoDB Atlas
      },

      // Logs y monitoreo del servidor
      error_file: `${LOG_DIR}/err.log`,
      out_file: `${LOG_DIR}/out.log`,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true
    },
    {
      // Alertas en tiempo real a Slack/Discord cuando mi-node-app se cae o se detiene
      name: 'pm2-webhook-notifier',
      script: './notifier/webhook-notifier.js',
      instances: 1,
      exec_mode: 'fork',
      env_production: {
        NODE_ENV: 'production',
        WEBHOOK_URL: secretos.WEBHOOK_URL,
        NOTIFY_APPS: 'mi-node-app',
        NOTIFY_EVENTS: 'exit,stop,restart,exception'
      },
      error_file: `${LOG_DIR}/notifier-err.log`,
      out_file: `${LOG_DIR}/notifier-out.log`,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true
    }
  ],

  // Automatización del despliegue desde tu PC local (ejecutar en Git Bash)
  //   AWS:   pm2 deploy ecosystem.config.js production
  //   Azure: pm2 deploy ecosystem.config.js azure
  deploy: {
    production: destino(IP_ELASTICA, 2222),
    // Desde la red local el puerto 22 llega bloqueado: en ambas nubes SSH escucha también en 2222
    azure: destino(IP_AZURE, 2222)
  }
};

function destino(host, puerto = 22) {
  return {
    user: 'ubuntu',
    host,
    ref: 'origin/main',
    repo: REPO,
    path: APP_DIR,
    'pre-setup': `mkdir -p ${APP_DIR}/shared ${LOG_DIR}`,
    'post-deploy':
      `mkdir -p ${LOG_DIR} && npm ci --omit=dev && ` +
      'pm2 reload ecosystem.config.js --env production --update-env && pm2 save',
    ssh_options: [`IdentityFile=${LLAVE_PEM}`, `Port=${puerto}`, 'StrictHostKeyChecking=accept-new']
  };
}
