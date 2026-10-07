// Escucha el bus de eventos de PM2 y envía alertas a un Webhook de Slack o Discord.
// Variables: WEBHOOK_URL (obligatoria), NOTIFY_APPS, NOTIFY_EVENTS.
const pm2 = require('pm2');
const os = require('os');

const WEBHOOK_URL = process.env.WEBHOOK_URL;
const APPS = (process.env.NOTIFY_APPS || 'mi-node-app').split(',').map((s) => s.trim());
const EVENTS = (process.env.NOTIFY_EVENTS || 'exit,stop,restart,exception').split(',').map((s) => s.trim());
const ES_DISCORD = /discord(app)?\.com\/api\/webhooks/.test(WEBHOOK_URL || '');

const ICONOS = { exit: '🔴', stop: '🛑', restart: '🔄', exception: '💥', online: '🟢' };

async function enviar(texto) {
  if (!WEBHOOK_URL) {
    console.warn('[notifier] WEBHOOK_URL no configurada, mensaje no enviado:', texto);
    return;
  }
  try {
    const res = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ES_DISCORD ? { content: texto } : { text: texto })
    });
    if (!res.ok) console.error(`[notifier] Webhook respondió ${res.status}: ${await res.text()}`);
    else console.log('[notifier] Alerta enviada:', texto);
  } catch (err) {
    console.error('[notifier] Error enviando webhook:', err.message);
  }
}

function formatear(evento, proc, detalle) {
  const hora = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  const lineas = [
    `${ICONOS[evento] || '⚠️'} *PM2 · ${evento.toUpperCase()}* en \`${proc.name}\` (id ${proc.pm_id})`,
    `Servidor: ${os.hostname()} · ${hora}`
  ];
  if (detalle) lineas.push('```' + String(detalle).slice(0, 1500) + '```');
  return lineas.join('\n');
}

pm2.connect((err) => {
  if (err) {
    console.error('[notifier] No se pudo conectar a PM2:', err);
    process.exit(1);
  }
  pm2.launchBus((err, bus) => {
    if (err) {
      console.error('[notifier] No se pudo abrir el bus de PM2:', err);
      process.exit(1);
    }
    console.log(`[notifier] Escuchando eventos [${EVENTS}] de [${APPS}] (${ES_DISCORD ? 'Discord' : 'Slack'})`);

    // PM2 emite varios eventos por una misma acción (ej. "pm2 stop" => exit + exit + stop).
    // Se agrupan por proceso durante 1.5 s y se envía uno solo: stop > restart > exit.
    const pendientes = new Map();
    const PRIORIDAD = ['stop', 'restart', 'exit'];

    bus.on('process:event', ({ event, process: proc }) => {
      if (!APPS.includes(proc.name) || !EVENTS.includes(event)) return;
      const clave = proc.pm_id;
      if (!pendientes.has(clave)) {
        pendientes.set(clave, { proc, eventos: new Set() });
        setTimeout(() => {
          const { proc: p, eventos } = pendientes.get(clave);
          pendientes.delete(clave);
          const evento = PRIORIDAD.find((e) => eventos.has(e)) || [...eventos][0];
          const detalle = evento === 'exit' ? 'El proceso terminó inesperadamente (posible caída).' : null;
          enviar(formatear(evento, p, detalle));
        }, 1500);
      }
      pendientes.get(clave).eventos.add(event);
    });

    bus.on('process:exception', ({ data, process: proc }) => {
      if (!APPS.includes(proc.name) || !EVENTS.includes('exception')) return;
      enviar(formatear('exception', proc, data && (data.stack || data.message)));
    });
  });
});
