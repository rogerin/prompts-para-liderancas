"""Start one local workshop process without a password hard-coded in source."""
from pathlib import Path
import os
import secrets
import subprocess
import sys

root = Path(__file__).resolve().parents[1]
env = os.environ.copy()
env.setdefault('PUBLIC_BASE_URL', 'http://127.0.0.1:8101')
if not env.get('FACILITATOR_PASSWORD'):
    env['FACILITATOR_PASSWORD'] = secrets.token_urlsafe(24)
    print('Senha temporária do facilitador (não compartilhe com alunos):', env['FACILITATOR_PASSWORD'], flush=True)
print('Abra:', env['PUBLIC_BASE_URL'], flush=True)
print('Uma única instância. Pressione Ctrl+C para encerrar.', flush=True)
args = [sys.executable, '-m', 'uvicorn', 'app:app', '--host', env.get('BIND_HOST', '127.0.0.1'), '--port', env.get('PORT', '8101'), '--workers', '1']
try:
    raise SystemExit(subprocess.call(args, cwd=root, env=env))
except KeyboardInterrupt:
    raise SystemExit(0)
