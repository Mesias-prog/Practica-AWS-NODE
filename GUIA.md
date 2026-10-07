# Práctica 06 — Despliegue Node.js en AWS con Nginx y PM2

Proyecto listo para desplegar. Incluye lo que piden **PW15 (EC2 + GitHub)** y **PDA06 (Nginx + PM2 + CI/CD + Webhooks)**.

```
index.js                     API Express (puerto 3000) + /health + página principal
src/                         rutas y controlador REST /api/empleados (CRUD)
public/index.html            interfaz visible en http://TU_IP_ELASTICA
ecosystem.config.js          PM2: clúster, logs, variables de entorno y deploy
notifier/webhook-notifier.js alertas PM2 -> Slack/Discord
deploy/setup-server.sh       instala Node, Git, build-essential, Nginx, PM2 en EC2
deploy/nginx-default.conf    proxy inverso 80 -> 3000
test/api.test.js             pruebas (npm test)
```

---

## Fase 0 — Crear la instancia EC2 (PW15, pasos 1–14)

1. Consola AWS → **EC2 → Lanzar instancia**.
2. Nombre: `Servidor`. AMI: **Ubuntu Server 24.04 LTS**. Tipo: **t2.micro / t3.micro** (capa gratuita).
3. **Par de claves → Crear nuevo**: nombre `node`, tipo RSA, formato **.pem**. Se descarga `node.pem`.
4. Red: crear grupo de seguridad con **SSH, HTTP y HTTPS**. ⚠️ **No** agregues el puerto 3000:
   PDA06 indica que el 3000 no debe abrirse al público, porque Nginx atiende en el 80.
5. Almacenamiento 8 GiB gp3 → **Lanzar instancia**.

Guarda la llave en tu PC y restringe sus permisos (PowerShell):

```powershell
mkdir $HOME\.ssh -Force; Move-Item $HOME\Downloads\node.pem $HOME\.ssh\node.pem
icacls $HOME\.ssh\node.pem /inheritance:r /grant:r "$($env:USERNAME):R"
```

## Fase 1 — Red segura

**1.1 Grupo de seguridad**: EC2 → Instancia → Seguridad → Grupo → *Editar reglas de entrada*:

| Tipo  | Puerto | Origen        |
|-------|--------|---------------|
| HTTP  | 80     | 0.0.0.0/0     |
| HTTPS | 443    | 0.0.0.0/0     |
| SSH   | 22     | **Mi IP**     |

Si tienes una regla para el puerto 3000, elimínala.

**1.2 IP elástica**: Red y seguridad → IP elásticas → *Asignar* → Acciones → *Asociar* a tu instancia. Anota la IP.

## Fase 2–3 — Preparar el servidor (un solo script)

Desde tu PC (en la carpeta del proyecto):

```bash
scp -i ~/.ssh/node.pem deploy/setup-server.sh deploy/nginx-default.conf ubuntu@TU_IP_ELASTICA:~
ssh -i ~/.ssh/node.pem ubuntu@TU_IP_ELASTICA "bash ~/setup-server.sh"
```

El script hace los pasos 2.1–2.5 y 4.1 de la guía: Node LTS, Git, build-essential, Nginx con
proxy inverso, PM2 global con arranque automático, `pm2-logrotate` (6.3), la carpeta
`/var/www/tu-app` con dueño `ubuntu`, y la llave `ed25519` para GitHub.

Al terminar, muestra una **llave pública**. En GitHub → tu repo → **Settings → Deploy keys → Add deploy key**,
pégala sin marcar *Allow write access*. Después, en el servidor:

```bash
ssh -T git@github.com          # escribe "yes"; debe saludar con el nombre del repo
nano /var/www/tu-app/shared/.env   # pega WEBHOOK_URL (y DB_* si usas base de datos)
```

> Los secretos viven solo en el servidor (`shared/.env`). `ecosystem.config.js` los lee al
> recargar, así que **no** se suben a GitHub (la guía original los dejaba en el repo).

## Fase 4 — Configurar PM2 (local)

Edita las 3 constantes al inicio de `ecosystem.config.js`:

```js
const IP_ELASTICA = '54.x.x.x';
const REPO = 'git@github.com:TU_USUARIO/TU_REPO.git';
const LLAVE_PEM = '~/.ssh/node.pem';
```

Haz commit y push a `main`.

## Fase 5 — Despliegue CI/CD (desde tu PC, en **Git Bash**)

`pm2 deploy` usa `sh`, así que en Windows ejecútalo desde **Git Bash** (no CMD/PowerShell):

```bash
npx pm2 deploy ecosystem.config.js production setup   # primera vez: clona en /var/www/tu-app/source
npx pm2 deploy ecosystem.config.js production         # despliega, instala y recarga sin caída
```

(Atajos: `npm run deploy:setup` y `npm run deploy`.)

## Fase 6 — Alertas con Webhook

1. Slack → App Directory → **Incoming WebHooks** → *Añadir a Slack* → canal `#alertas-servidor`
   → copia la URL `https://hooks.slack.com/services/...` (en Discord: Canal → Integraciones → Webhooks).
2. Pégala en `WEBHOOK_URL=` de `/var/www/tu-app/shared/.env`.
3. Aplica el cambio: `npx pm2 deploy ecosystem.config.js production` (o en el servidor
   `cd /var/www/tu-app/current && pm2 reload ecosystem.config.js --env production --update-env`).

El proceso `pm2-webhook-notifier` (incluido en el ecosistema) reemplaza a `pm2-notify` de la guía:
envía una alerta cuando `mi-node-app` se **detiene** (STOP), **se cae** (EXIT) o lanza una **excepción**.
Detecta automáticamente si la URL es de Slack o de Discord.

## Pruebas de verificación

1. **Red**: abre `http://TU_IP_ELASTICA` → se ve la app **sin** `:3000`. `http://TU_IP_ELASTICA:3000` **no** debe responder.
2. **Resiliencia**: en el servidor ejecuta `pm2 stop mi-node-app` → llega alerta 🛑 a Slack. Luego `pm2 start mi-node-app`.
3. **CI/CD**: cambia el título en `public/index.html`, haz `git push` y luego `npx pm2 deploy ecosystem.config.js production` → refresca el navegador.

Comandos útiles en el servidor: `pm2 list`, `pm2 logs`, `pm2 monit`, `sudo nginx -t`, `sudo systemctl reload nginx`.

## Despliegue en Azure (VM equivalente)

Misma arquitectura (Ubuntu 24.04 + Nginx + PM2) en una VM de **Azure for Students**:

```bash
az account set --subscription "Azure for Students"
bash deploy/provision-azure.sh          # grupo de recursos, VM, IP estática y reglas de red
scp -P 2222 -i ~/.ssh/practica-cloud deploy/setup-server.sh deploy/nginx-default.conf ubuntu@IP_AZURE:~
ssh -p 2222 -i ~/.ssh/practica-cloud ubuntu@IP_AZURE "bash ~/setup-server.sh"
npm run deploy:azure:setup && npm run deploy:azure
```

- Azure for Students solo permite las regiones westus, francecentral, northcentralus, chilecentral y spaincentral.
- Desde la red local, el puerto 22 hacia Azure llega bloqueado (los paquetes nunca alcanzan la VM).
  Por eso SSH escucha también en **2222**, abierto solo para la IP del administrador, y el destino `azure` del ecosistema usa `Port=2222`.
- Para borrar todo: `az group delete -n practica-aws-node-rg --yes`.

## Base de datos: MongoDB Atlas

La app usa el **patrón Repositorio** (`src/db.js`): con `MONGODB_URI` guarda en MongoDB Atlas;
sin ella usa memoria (solo para desarrollo y `npm test`).

1. Atlas → clúster **M0 (Free)** → *Security → Database Access*: usuario `appuser` con rol *Read and write to any database*.
2. *Security → Network Access*: agregar la IP pública del servidor (`130.131.46.243` en Azure).
3. En Git Bash, sin escribir la contraseña en ningún archivo:

```bash
read -rsp "Contraseña de appuser: " PASS; echo
URI="mongodb+srv://appuser:${PASS}@cluster0.ihko6ln.mongodb.net/practica"
ssh -p 2222 -i ~/.ssh/practica-cloud ubuntu@130.131.46.243 "sed -i 's|^MONGODB_URI=.*|MONGODB_URI=$URI|' /var/www/tu-app/shared/.env"
npm run deploy:azure
```

4. Verificar: `curl http://130.131.46.243/health` → `"baseDeDatos":{"tipo":"mongodb","conectado":true}`.

## Correcciones respecto a los PDF

| Guía original | Problema | En este proyecto |
|---|---|---|
| `curl -fsSL https://nodesource.com \| sudo -E bash -` | URL incorrecta | `https://deb.nodesource.com/setup_lts.x` |
| `sudo apt install npm -y` tras NodeSource | conflicto: nodejs ya trae npm | se omite |
| PW15: abrir puerto 3000 | contradice PDA06 (seguridad) | puerto 3000 cerrado; acceso solo por Nginx |
| `DB_PASS` dentro de `ecosystem.config.js` | secretos en GitHub | `shared/.env` solo en el servidor |
| `mkdir -p logs` en post-deploy | crea `current/logs`, pero los logs apuntan a `/var/www/tu-app/logs` | `mkdir -p /var/www/tu-app/logs` |
| `pm2 set pm2-notify:apps "mi-node-app-Alumno"` | no coincide con el nombre `mi-node-app` | `NOTIFY_APPS=mi-node-app` |
| `pm2 save –force` | guion largo (–) en lugar de `--` | `pm2 save` |
| `sudo npm install pm2-notify -g` | los módulos PM2 van con `pm2 install` y no es oficial | notificador propio probado |
| Sin `pm2 startup` | PM2 no arranca si se reinicia la instancia | `pm2 startup systemd` en el script |
