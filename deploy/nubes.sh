#!/usr/bin/env bash
# Enciende, apaga o consulta los servidores de AWS y Azure sin perder disco, configuración ni IP fija.
# Uso: bash deploy/nubes.sh encender|apagar|estado
set -euo pipefail
export PATH="$PATH:/c/Program Files/Amazon/AWSCLIV2:/c/Program Files/Microsoft SDKs/Azure/CLI2/wbin"
export AWS_DEFAULT_REGION=us-east-2 AWS_PAGER="" MSYS_NO_PATHCONV=1

RG=practica-aws-node-rg
VM=practica-aws-node-vm
EC2_ID=$(aws ec2 describe-instances --filters Name=tag:Name,Values=Practica-AWS-NODE \
  Name=instance-state-name,Values=pending,running,stopping,stopped \
  --query 'Reservations[0].Instances[0].InstanceId' --output text)

case "${1:-estado}" in
  encender)
    aws ec2 start-instances --instance-ids "$EC2_ID" >/dev/null
    az vm start -g $RG -n $VM -o none
    aws ec2 wait instance-running --instance-ids "$EC2_ID"
    echo "Encendidas. PM2 levanta la app solo; espera ~30 s y abre:"
    echo "  AWS:   http://3.138.218.34"
    echo "  Azure: http://130.131.46.243"
    ;;
  apagar)
    aws ec2 stop-instances --instance-ids "$EC2_ID" >/dev/null
    az vm deallocate -g $RG -n $VM -o none
    aws ec2 wait instance-stopped --instance-ids "$EC2_ID"
    echo "Apagadas (sin cobro de cómputo; se conservan disco e IP fija)."
    ;;
  estado)
    printf "AWS   %s: " "$EC2_ID"
    aws ec2 describe-instances --instance-ids "$EC2_ID" --query 'Reservations[0].Instances[0].State.Name' --output text
    printf "Azure %s: " "$VM"
    az vm get-instance-view -g $RG -n $VM --query "instanceView.statuses[1].displayStatus" -o tsv
    ;;
  *) echo "Uso: bash deploy/nubes.sh encender|apagar|estado"; exit 1 ;;
esac
