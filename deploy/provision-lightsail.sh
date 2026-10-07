#!/usr/bin/env bash
# Alternativa a EC2 cuando la cuenta lo tiene bloqueado (p. ej. SCP de AWS Organizations):
# crea una instancia Amazon Lightsail Ubuntu 24.04 con IP estática y firewall equivalente.
# Requiere: aws login y la llave ~/.ssh/practica-cloud(.pub).
set -euo pipefail

export AWS_DEFAULT_REGION=${AWS_REGION:-us-east-1} AWS_PAGER=""
AZ=${AWS_DEFAULT_REGION}a
NAME=Practica-AWS-NODE
IP_NAME=Practica-AWS-NODE-ip
KEY_NAME=practica-cloud
BUNDLE=${LIGHTSAIL_BUNDLE:-micro_3_0}   # 1 GB RAM, 2 vCPU, 40 GB SSD, IPv4 (~7 USD/mes)
PUB_KEY=${PUB_KEY:-$HOME/.ssh/practica-cloud.pub}
MY_IP=$(curl -s https://checkip.amazonaws.com)/32

echo "==> Par de claves"
if ! aws lightsail get-key-pair --key-pair-name $KEY_NAME >/dev/null 2>&1; then
  aws lightsail import-key-pair --key-pair-name $KEY_NAME --public-key-base64 "$(cat "$PUB_KEY")" >/dev/null
fi

echo "==> Instancia Lightsail ($BUNDLE, Ubuntu 24.04, $AZ)"
if ! aws lightsail get-instance --instance-name $NAME >/dev/null 2>&1; then
  aws lightsail create-instances --instance-names $NAME --availability-zone "$AZ" \
    --blueprint-id ubuntu_24_04 --bundle-id "$BUNDLE" --key-pair-name $KEY_NAME \
    --tags key=Name,value=$NAME >/dev/null
fi
until [ "$(aws lightsail get-instance-state --instance-name $NAME --query state.name --output text)" = "running" ]; do
  echo "    esperando a que arranque..."; sleep 10
done

echo "==> IP estática (equivalente a la IP elástica)"
if ! aws lightsail get-static-ip --static-ip-name $IP_NAME >/dev/null 2>&1; then
  aws lightsail allocate-static-ip --static-ip-name $IP_NAME >/dev/null
fi
if [ "$(aws lightsail get-static-ip --static-ip-name $IP_NAME --query staticIp.isAttached --output text)" != "True" ]; then
  aws lightsail attach-static-ip --static-ip-name $IP_NAME --instance-name $NAME >/dev/null
fi

echo "==> Firewall (80/443 público, 22 solo $MY_IP, 3000 cerrado)"
aws lightsail put-instance-public-ports --instance-name $NAME --port-infos \
  "fromPort=80,toPort=80,protocol=tcp,cidrs=0.0.0.0/0" \
  "fromPort=443,toPort=443,protocol=tcp,cidrs=0.0.0.0/0" \
  "fromPort=22,toPort=22,protocol=tcp,cidrs=$MY_IP" >/dev/null

echo "IP_AWS=$(aws lightsail get-static-ip --static-ip-name $IP_NAME --query staticIp.ipAddress --output text)"
