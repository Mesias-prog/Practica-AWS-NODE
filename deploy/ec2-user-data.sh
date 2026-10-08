#!/bin/bash
# Primer arranque de la EC2: SSH también en el puerto 2222, porque el 22 puede llegar
# bloqueado desde la red del administrador. En Ubuntu 24.04 los puertos se declaran en
# sshd_config y el generador de systemd crea los sockets de ssh.socket a partir de ahí.
printf 'Port 22\nPort 2222\n' > /etc/ssh/sshd_config.d/10-puertos.conf
systemctl daemon-reload
systemctl restart ssh.socket 2>/dev/null || true
systemctl restart ssh 2>/dev/null || true
