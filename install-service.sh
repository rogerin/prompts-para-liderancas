#!/usr/bin/env bash
set -euo pipefail
install -d -m 700 /etc/keycore
printf '%s\n' 'FACILITATOR_PASSWORD=R0ger!n20100' 'PUBLIC_BASE_URL=https://prompts-para-liderancas.keycore.com.br' > /etc/keycore/prompts-para-liderancas.env
chmod 600 /etc/keycore/prompts-para-liderancas.env
cat > /etc/systemd/system/conselho-em-simulacao.service <<'UNIT'
[Unit]
Description=KeyCore Academy - Prompts para Lideranças
After=network.target

[Service]
Type=simple
User=keyla
WorkingDirectory=/home/keyla/hermes-workspace/prompts-para-liderancas
EnvironmentFile=/etc/keycore/prompts-para-liderancas.env
ExecStart=/home/keyla/hermes-workspace/prompts-para-liderancas/.venv/bin/python -m uvicorn app:app --host 127.0.0.1 --port 8101 --workers 1
Restart=on-failure
RestartSec=3
UMask=0077
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable conselho-em-simulacao.service
systemctl restart conselho-em-simulacao.service
