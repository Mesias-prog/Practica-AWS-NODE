#!/usr/bin/env bash
# Crea una VM Ubuntu en Azure equivalente a la EC2 de la práctica, con Azure CLI.
# Requiere: az login y la llave ~/.ssh/practica-cloud(.pub).
set -euo pipefail

# Azure for Students solo permite: westus, francecentral, northcentralus, chilecentral, spaincentral
LOCATION=${AZ_LOCATION:-northcentralus}
RG=practica-aws-node-rg
VM=practica-aws-node-vm
PUB_KEY=${PUB_KEY:-$HOME/.ssh/practica-cloud.pub}
PUB_KEY=$(cygpath -m "$PUB_KEY" 2>/dev/null || echo "$PUB_KEY")   # ruta legible por az.exe en Windows
MY_IP=$(curl -s https://checkip.amazonaws.com)/32

echo "==> Grupo de recursos $RG ($LOCATION)"
az group create -n $RG -l "$LOCATION" -o none

if ! az vm show -g $RG -n $VM -o none 2>/dev/null; then
  echo "==> VM Ubuntu 24.04 (IP pública estática, usuario ubuntu)"
  # Tamaños de la capa gratuita; se prueba el siguiente si no hay capacidad en la región
  for SIZE in Standard_B1s Standard_B2ats_v2 Standard_B2pts_v2; do
    IMAGE=Ubuntu2404
    [ "$SIZE" = "Standard_B2pts_v2" ] && IMAGE=Canonical:ubuntu-24_04-lts:server-arm64:latest
    if az vm create -g $RG -n $VM --image $IMAGE --size $SIZE \
        --admin-username ubuntu --ssh-key-values "$PUB_KEY" \
        --public-ip-sku Standard --public-ip-address-allocation static \
        --os-disk-size-gb 30 --storage-sku StandardSSD_LRS --nsg-rule SSH -o none; then
      echo "    Tamaño: $SIZE"; break
    fi
    echo "    $SIZE no disponible, probando otro..."
  done
fi

echo "==> Reglas de red (80/443 público, 22 solo $MY_IP, 3000 cerrado)"
NSG=$(az network nsg list -g $RG --query "[0].name" -o tsv)
az network nsg rule update -g $RG --nsg-name "$NSG" -n default-allow-ssh --source-address-prefixes "$MY_IP" -o none
az network nsg rule create -g $RG --nsg-name "$NSG" -n allow-http-https --priority 1010 \
  --access Allow --protocol Tcp --direction Inbound --destination-port-ranges 80 443 -o none

IP=$(az vm show -d -g $RG -n $VM --query publicIps -o tsv)
echo "IP_AZURE=$IP"
