const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const os = require('os');
const path = require('path');

const db = require('./src/db');
const empleadosRouter = require('./src/routes/empleados.routes');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const VERSION = require('./package.json').version;

// Nginx actúa como proxy inverso: confiar en X-Forwarded-For / X-Forwarded-Proto
app.set('trust proxy', 1);

app.use(cors());
app.use(express.json());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    version: VERSION,
    env: process.env.NODE_ENV || 'development',
    pid: process.pid,
    instancia: process.env.NODE_APP_INSTANCE ?? null,
    host: os.hostname(),
    uptime: Math.round(process.uptime()),
    ipCliente: req.ip,
    baseDeDatos: db.estado()
  });
});

app.use('/api/empleados', empleadosRouter);

app.use((req, res) => {
  res.status(404).json({ error: 'Recurso no encontrado', ruta: req.originalUrl });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Error interno del servidor' });
});

async function iniciar() {
  await db.conectar();
  const server = app.listen(PORT, () => {
    console.log(`Servidor escuchando en http://localhost:${PORT} (pid ${process.pid})`);
    // Avisar a PM2 que la instancia está lista (wait_ready en ecosystem.config.js)
    if (process.send) process.send('ready');
  });

  // Apagado ordenado para que "pm2 reload" no corte peticiones en curso
  const shutdown = (signal) => {
    console.log(`${signal} recibido, cerrando servidor...`);
    server.close(async () => {
      await db.desconectar();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 5000).unref();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

if (require.main === module || process.env.pm_id !== undefined) {
  iniciar().catch((err) => {
    console.error('No se pudo iniciar la aplicación:', err.message);
    process.exit(1);
  });
}

module.exports = app;
