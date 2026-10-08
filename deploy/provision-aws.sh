#!/usr/bin/env bash
# Crea la infraestructura de la Práctica 06 en AWS (Fase 0 y Fase 1) con AWS CLI.
# Requiere: aws login (o aws configure) y la llave ~/.ssh/practica-cloud(.pub).
set -euo pipefail

# La cuenta (proyecto de AWS Settings) solo permite EC2 en su región principal: Ohio
REGION=${AWS_REGION:-us-east-2}
NAME=Practica-AWS-NODE
KEY_NAME=practica-cloud
SG_NAME=practica-aws-node-sg
PUB_KEY=${PUB_KEY:-$HOME/.ssh/practica-cloud.pub}
MY_IP=$(curl -s https://checkip.amazonaws.com)/32
# Script de primer arranque: SSH también en el puerto 2222 (el 22 puede llegar bloqueado)
USER_DATA="$(cd "$(dirname "$0")" && pwd)/ec2-user-data.sh"
USER_DATA=$(cygpath -m "$USER_DATA" 2>/dev/null || echo "$USER_DATA")
export AWS_DEFAULT_REGION=$REGION AWS_PAGER=""

echo "==> Par de claves"
if ! aws ec2 describe-key-pairs --key-names "$KEY_NAME" >/dev/null 2>&1; then
  aws ec2 import-key-pair --key-name "$KEY_NAME" --public-key-material "fileb://$(cygpath -m "$PUB_KEY" 2>/dev/null || echo "$PUB_KEY")" >/dev/null
fi

echo "==> Grupo de seguridad (80/443 público, 22 solo $MY_IP, 3000 cerrado)"
VPC_ID=$(aws ec2 describe-vpcs --filters Name=is-default,Values=true --query 'Vpcs[0].VpcId' --output text)
SG_ID=$(aws ec2 describe-security-groups --filters Name=group-name,Values=$SG_NAME Name=vpc-id,Values=$VPC_ID \
  --query 'SecurityGroups[0].GroupId' --output text)
if [ "$SG_ID" = "None" ]; then
  SG_ID=$(aws ec2 create-security-group --group-name $SG_NAME --vpc-id "$VPC_ID" \
    --description "Practica 06: HTTP/HTTPS publico, SSH restringido" --query GroupId --output text)
  aws ec2 authorize-security-group-ingress --group-id "$SG_ID" --ip-permissions \
    "IpProtocol=tcp,FromPort=80,ToPort=80,IpRanges=[{CidrIp=0.0.0.0/0,Description=HTTP}]" \
    "IpProtocol=tcp,FromPort=443,ToPort=443,IpRanges=[{CidrIp=0.0.0.0/0,Description=HTTPS}]" \
    "IpProtocol=tcp,FromPort=22,ToPort=22,IpRanges=[{CidrIp=$MY_IP,Description=SSH-Mi-IP}]"     "IpProtocol=tcp,FromPort=2222,ToPort=2222,IpRanges=[{CidrIp=$MY_IP,Description=SSH-2222-Mi-IP}]" >/dev/null
fi

echo "==> Instancia EC2 (Ubuntu 24.04)"
INSTANCE_ID=$(aws ec2 describe-instances \
  --filters Name=tag:Name,Values=$NAME Name=instance-state-name,Values=pending,running,stopped \
  --query 'Reservations[0].Instances[0].InstanceId' --output text)
if [ "$INSTANCE_ID" = "None" ]; then
  # AMI oficial más reciente de Canonical (099720109477) para Ubuntu 24.04 x86_64
  AMI=$(aws ec2 describe-images --owners 099720109477 \
    --filters "Name=name,Values=ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*" "Name=state,Values=available" \
    --query 'sort_by(Images,&CreationDate)[-1].ImageId' --output text)
  TYPE=${INSTANCE_TYPE:-t3.micro}   # 2 vCPU, 1 GB RAM (~0,0104 USD/h)
  echo "    AMI $AMI, tipo $TYPE"
  INSTANCE_ID=$(aws ec2 run-instances --image-id "$AMI" --instance-type "$TYPE" --key-name $KEY_NAME \
    --security-group-ids "$SG_ID" \
    --block-device-mappings 'DeviceName=/dev/sda1,Ebs={VolumeSize=8,VolumeType=gp3}' \
    --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=$NAME}]" \
    --user-data "file://$USER_DATA" \
    --query 'Instances[0].InstanceId' --output text)
fi
aws ec2 wait instance-running --instance-ids "$INSTANCE_ID"

echo "==> IP elástica"
EIP=$(aws ec2 describe-addresses --filters Name=tag:Name,Values=$NAME --query 'Addresses[0].PublicIp' --output text)
if [ "$EIP" = "None" ]; then
  ALLOC=$(aws ec2 allocate-address --domain vpc \
    --tag-specifications "ResourceType=elastic-ip,Tags=[{Key=Name,Value=$NAME}]" --query AllocationId --output text)
  aws ec2 associate-address --instance-id "$INSTANCE_ID" --allocation-id "$ALLOC" >/dev/null
  EIP=$(aws ec2 describe-addresses --allocation-ids "$ALLOC" --query 'Addresses[0].PublicIp' --output text)
else
  # Si la instancia se reemplazó, mover la IP elástica a la nueva
  ALLOC=$(aws ec2 describe-addresses --filters Name=tag:Name,Values=$NAME --query 'Addresses[0].AllocationId' --output text)
  aws ec2 associate-address --instance-id "$INSTANCE_ID" --allocation-id "$ALLOC" --allow-reassociation >/dev/null
fi

echo "INSTANCE_ID=$INSTANCE_ID"
echo "IP_AWS=$EIP"
