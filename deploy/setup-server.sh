#!/usr/bin/env bash
# Prepara una instancia EC2 Ubuntu 22.04/24.04 para la Práctica 06.
# Uso (en el servidor):  bash setup-server.sh
set -euo pipefail

APP_DIR=/var/www/tu-app

echo "==> 1. Actualizando el sistema"
sudo apt-get update -y
sudo DEBIAN_FRONTEND=noninteractive apt-get upgrade -y

echo "==> 2. Node.js LTS + npm (NodeSource)"
# La guía usa 'curl https://nodesource.com', la URL correcta es deb.nodesource.com/setup_lts.x.
# El paquete nodejs de NodeSource YA incluye npm: no instalar 'npm' de apt (provoca conflictos).
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v && npm -v

echo "==> 3. Git y herramientas de compilación"
sudo apt-get install -y git build-essential

echo "==> 4. Nginx"
sudo apt-get install -y nginx
if sudo ufw status | grep -q "Status: active"; then
  sudo ufw allow 'Nginx Full'
  sudo ufw allow OpenSSH
fi

echo "==> 5. Proxy inverso (sitio por defecto -> localhost:3000)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SCRIPT_DIR/nginx-default.conf" ]; then
  sudo cp /etc/nginx/sites-available/default /etc/nginx/sites-available/default.bak 2>/dev/null || true
  sudo cp "$SCRIPT_DIR/nginx-default.conf" /etc/nginx/sites-available/default
fi
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl reload nginx

echo "==> 6. PM2 global, arranque automático y rotación de logs"
sudo npm install -g pm2
sudo env PATH="$PATH" pm2 startup systemd -u ubuntu --hp /home/ubuntu
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7

echo "==> 7. Carpeta de despliegue"
sudo mkdir -p "$APP_DIR/shared" "$APP_DIR/logs"
sudo chown -R ubuntu:ubuntu "$APP_DIR"
if [ ! -f "$APP_DIR/shared/.env" ]; then
  cat > "$APP_DIR/shared/.env" <<'EOF'
# Secretos de producción (no se suben a GitHub)
DB_HOST=
DB_USER=
DB_PASS=
# URL del Incoming Webhook de Slack (https://hooks.slack.com/...) o Discord
WEBHOOK_URL=
EOF
  chmod 600 "$APP_DIR/shared/.env"
fi

echo "==> 8. Llave SSH para GitHub (Deploy key)"
if [ ! -f ~/.ssh/id_ed25519 ]; then
  ssh-keygen -t ed25519 -C "servidor-produccion" -f ~/.ssh/id_ed25519 -N ""
fi
ssh-keyscan -H github.com >> ~/.ssh/known_hosts 2>/dev/null

echo
echo "================================================================"
echo " Listo. Copia esta llave pública en GitHub:"
echo "   Repo > Settings > Deploy keys > Add deploy key (sin permisos de escritura)"
echo
cat ~/.ssh/id_ed25519.pub
echo
echo " Luego edita los secretos:  nano $APP_DIR/shared/.env"
echo " Y valida GitHub con:        ssh -T git@github.com"
echo "================================================================"
