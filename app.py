"""Workshop KeyCore: slides sincronizados, atividades e compartilhamento moderado.

Uma instância, um processo, disco persistente. Sem execução de prompts no servidor.
O conteúdo didático é público; tentativas/anexos dependem de autenticação e consentimento.
"""
from __future__ import annotations

import asyncio
import hashlib
import hmac
import io
import json
import os
from pathlib import Path
import re
import secrets
import shutil
import sqlite3
import tempfile
import time
import warnings
from contextlib import asynccontextmanager
from typing import Any
from urllib.parse import urlparse

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.trustedhost import TrustedHostMiddleware
import qrcode
from PIL import Image

ROOT = Path(__file__).resolve().parent
CONTENT = json.loads((ROOT / 'content.json').read_text(encoding='utf-8'))
DECK_HASH = hashlib.sha256((ROOT / 'content.json').read_bytes()).hexdigest()[:16]
EXERCISES = {e['id'] for e in CONTENT['exercises']}
SLIDES = {s['id'] for s in CONTENT['slides']}
RUBRIC = {r['id'] for r in CONTENT['rubric']}
MAX_FILE = 5 * 1024 * 1024
MAX_JSON = 128 * 1024
ALLOWED_FILES = {'.txt', '.md', '.csv', '.json', '.png', '.jpg', '.jpeg', '.pdf'}
COOKIE = 'kc_workshop_session'
Image.MAX_IMAGE_PIXELS = 15_000_000


def create_app(data_dir: Path | None = None, password: str | None = None,
               public_url: str | None = None, retention_days: int | None = None) -> FastAPI:
    password = password if password is not None else os.getenv('FACILITATOR_PASSWORD', '')
    base = (public_url or os.getenv('PUBLIC_BASE_URL', 'http://127.0.0.1:8101')).rstrip('/')
    parsed = urlparse(base)
    if parsed.scheme not in {'http', 'https'} or not parsed.hostname or parsed.path not in {'', '/'} or parsed.query or parsed.fragment or parsed.username:
        raise ValueError('PUBLIC_BASE_URL deve conter somente a origem HTTP(S), sem caminho, credenciais ou query.')
    folder = Path(data_dir or os.getenv('DATA_DIR', str(ROOT / 'var'))).resolve()
    days = retention_days or int(os.getenv('RETENTION_DAYS', '7'))
    if not 1 <= days <= 90:
        raise ValueError('RETENTION_DAYS deve ser de 1 a 90.')
    secure_cookie = parsed.scheme == 'https'
    database = folder / 'workshop.sqlite3'
    uploads = folder / 'uploads'
    limiter: dict[tuple[str, str], list[float]] = {}

    def db() -> sqlite3.Connection:
        connection = sqlite3.connect(database, timeout=10)
        connection.row_factory = sqlite3.Row
        connection.execute('PRAGMA foreign_keys=ON')
        return connection

    def initialise() -> None:
        if not (password or '').strip() or (password or '').startswith('SUBSTITUA_'):
            raise RuntimeError('Defina FACILITATOR_PASSWORD antes de iniciar o servidor.')
        folder.mkdir(parents=True, exist_ok=True, mode=0o700)
        uploads.mkdir(parents=True, exist_ok=True, mode=0o700)
        with db() as c:
            c.execute('PRAGMA journal_mode=WAL')
            c.executescript('''
                CREATE TABLE IF NOT EXISTS sessions (
                    token_hash TEXT PRIMARY KEY, role TEXT NOT NULL CHECK(role IN ('student','presenter')),
                    expires REAL NOT NULL);
                CREATE TABLE IF NOT EXISTS rooms (
                    code TEXT PRIMARY KEY, title TEXT NOT NULL, slide TEXT NOT NULL,
                    version INTEGER NOT NULL DEFAULT 1, revision INTEGER NOT NULL DEFAULT 0,
                    closed INTEGER NOT NULL DEFAULT 0, created REAL NOT NULL,
                    expires REAL NOT NULL, deck_hash TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS members (
                    id TEXT PRIMARY KEY, room TEXT NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
                    token_hash TEXT NOT NULL REFERENCES sessions(token_hash), nickname TEXT NOT NULL,
                    alias TEXT NOT NULL, group_name TEXT NOT NULL, created REAL NOT NULL,
                    UNIQUE(room, token_hash));
                CREATE TABLE IF NOT EXISTS submissions (
                    id TEXT PRIMARY KEY, room TEXT NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
                    member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
                    exercise TEXT NOT NULL, client_id TEXT NOT NULL, prompt TEXT NOT NULL,
                    result TEXT NOT NULL, model TEXT NOT NULL, settings TEXT NOT NULL,
                    reflection TEXT NOT NULL, attempt INTEGER NOT NULL, consent INTEGER NOT NULL,
                    published INTEGER NOT NULL DEFAULT 0, created REAL NOT NULL,
                    scores TEXT, feedback TEXT NOT NULL DEFAULT '',
                    UNIQUE(member_id, client_id));
                CREATE TABLE IF NOT EXISTS files (
                    id TEXT PRIMARY KEY, submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
                    filename TEXT NOT NULL, stored_name TEXT NOT NULL, size INTEGER NOT NULL,
                    created REAL NOT NULL);
                CREATE INDEX IF NOT EXISTS sub_room ON submissions(room, exercise);
                CREATE INDEX IF NOT EXISTS file_sub ON files(submission_id);
            ''')
        cleanup()

    def erase_room(code: str, c: sqlite3.Connection) -> None:
        paths = c.execute('SELECT f.stored_name FROM files f JOIN submissions s ON s.id=f.submission_id WHERE s.room=?', (code,)).fetchall()
        c.execute('DELETE FROM rooms WHERE code=?', (code,))
        for path in paths:
            (uploads / path['stored_name']).unlink(missing_ok=True)

    def cleanup() -> None:
        with db() as c:
            for room in c.execute('SELECT code FROM rooms WHERE expires < ?', (time.time(),)).fetchall():
                erase_room(room['code'], c)
            # Preserve expired session rows referenced by old submissions until room expiry.
            c.execute('DELETE FROM sessions WHERE expires < ? AND token_hash NOT IN (SELECT token_hash FROM members)', (time.time(),))
        for path in uploads.glob('.pending-*'):
            if path.stat().st_mtime < time.time() - 3600:
                path.unlink(missing_ok=True)

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        initialise()
        async def maintenance():
            while True:
                await asyncio.sleep(60)
                cleanup()
        task = asyncio.create_task(maintenance())
        yield
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass

    app = FastAPI(title='KeyCore Workshop', version='2.0.0', lifespan=lifespan,
                  docs_url=None, redoc_url=None, openapi_url=None)
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=list({parsed.hostname, 'localhost', '127.0.0.1', 'testserver'}))

    @app.middleware('http')
    async def boundaries(request: Request, call_next):
        if request.method not in {'GET', 'HEAD', 'OPTIONS'}:
            origin = request.headers.get('origin')
            if request.headers.get('x-workshop') != '1' or (origin and origin.rstrip('/') != base):
                return JSONResponse({'detail': 'Origem ou proteção da requisição inválida.'}, status_code=403)
            length = request.headers.get('content-length')
            limit = MAX_FILE if '/attachments' in request.url.path else MAX_JSON
            if length:
                try:
                    if int(length) < 0 or int(length) > limit:
                        return JSONResponse({'detail': 'Arquivo ou texto excede o limite.'}, status_code=413)
                except ValueError:
                    return JSONResponse({'detail': 'Tamanho inválido.'}, status_code=400)
        response = await call_next(request)
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['Referrer-Policy'] = 'no-referrer'
        response.headers['X-Frame-Options'] = 'DENY'
        response.headers['Permissions-Policy'] = 'camera=(), microphone=(), geolocation=()'
        response.headers['Content-Security-Policy'] = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"
        if request.url.path.startswith('/api/'):
            response.headers['Cache-Control'] = 'no-store'
        return response

    def rate(request: Request, bucket: str, maximum: int, seconds: int = 60):
        ip = request.client.host if request.client else 'local'
        key = (ip, bucket); now = time.monotonic()
        entries = [t for t in limiter.get(key, []) if t > now-seconds]
        if len(entries) >= maximum:
            raise HTTPException(429, 'Muitas tentativas. Aguarde antes de repetir.', headers={'Retry-After': str(seconds)})
        entries.append(now); limiter[key] = entries
        if len(limiter) > 5000:
            for k in list(limiter):
                if not limiter[k] or limiter[k][-1] < now-600:
                    del limiter[k]

    def digest(token: str) -> str:
        return hashlib.sha256(token.encode()).hexdigest()

    def actor(request: Request, required: bool = True) -> dict | None:
        token = request.cookies.get(COOKIE, '')
        if not token:
            if required: raise HTTPException(401, 'Entre na sala ou faça login como facilitador.')
            return None
        with db() as c:
            row = c.execute('SELECT * FROM sessions WHERE token_hash=? AND expires>?', (digest(token),time.time())).fetchone()
        if not row:
            if required: raise HTTPException(401, 'Sessão expirada. Entre novamente.')
            return None
        return dict(row)

    def teacher(request: Request) -> dict:
        a = actor(request)
        if a['role'] != 'presenter': raise HTTPException(403, 'Somente o facilitador pode realizar esta ação.')
        return a

    def get_room(code: str) -> dict:
        with db() as c:
            row = c.execute('SELECT * FROM rooms WHERE code=?', (code.upper(),)).fetchone()
        if not row or row['expires'] <= time.time(): raise HTTPException(404, 'Sala inexistente ou expirada.')
        if row['deck_hash'] != DECK_HASH: raise HTTPException(409, 'Conteúdo atualizado. O facilitador deve criar uma nova sala.')
        return dict(row)

    def access(request: Request, code: str) -> tuple[dict, dict | None, dict]:
        a = actor(request); room = get_room(code)
        with db() as c:
            m = c.execute('SELECT * FROM members WHERE room=? AND token_hash=?', (room['code'],a['token_hash'])).fetchone()
        if a['role'] != 'presenter' and not m: raise HTTPException(403, 'Esta sessão não pertence à sala.')
        return a, dict(m) if m else None, room

    async def body(request: Request) -> dict:
        raw = bytearray()
        async for chunk in request.stream():
            raw.extend(chunk)
            if len(raw) > MAX_JSON: raise HTTPException(413, 'Texto excede o limite de 128 KB.')
        try:
            value = json.loads(raw)
        except (ValueError, UnicodeError): raise HTTPException(400, 'JSON inválido.')
        if not isinstance(value, dict): raise HTTPException(422, 'O conteúdo deve ser um objeto.')
        return value

    def text(data: dict, name: str, minimum: int = 0, maximum: int = 4000, default: str = '') -> str:
        value = data.get(name, default)
        if not isinstance(value, str): raise HTTPException(422, f'{name}: use texto.')
        value = value.strip()
        if '\x00' in value or not minimum <= len(value) <= maximum:
            raise HTTPException(422, f'{name}: tamanho permitido de {minimum} a {maximum} caracteres.')
        return value

    def flag(data: dict, name: str, default: bool = False) -> bool:
        value = data.get(name, default)
        if type(value) is not bool: raise HTTPException(422, f'{name}: use true ou false.')
        return value

    def session_response(payload: dict, role: str, existing: dict | None = None) -> JSONResponse:
        response = JSONResponse(payload)
        if existing: return response
        token = secrets.token_urlsafe(32)
        with db() as c:
            c.execute('INSERT INTO sessions VALUES(?,?,?)', (digest(token), role, time.time()+24*3600))
        response.set_cookie(COOKIE, token, max_age=24*3600, httponly=True, secure=secure_cookie, samesite='strict', path='/')
        return response

    def state(room: dict) -> dict:
        with db() as c:
            count = c.execute('SELECT COUNT(*) FROM members WHERE room=?', (room['code'],)).fetchone()[0]
        return {'code':room['code'],'title':room['title'],'slide':room['slide'],'version':room['version'],
                'revision':room['revision'],'closed':bool(room['closed']),'registered':count,
                'expires':room['expires'],'deck_hash':DECK_HASH,
                'join_url': f"{base}/?sala={room['code']}",
                'local_url': parsed.hostname in {'localhost','127.0.0.1'}}

    def submission_access(request: Request, sid: str) -> tuple[dict, dict | None, dict]:
        with db() as c:
            sub = c.execute('SELECT * FROM submissions WHERE id=?', (sid,)).fetchone()
        if not sub: raise HTTPException(404,'Envio não encontrado.')
        a,m,_ = access(request,sub['room'])
        own = m and m['id']==sub['member_id']
        if not (a['role']=='presenter' or own or (sub['published'] and sub['consent'])):
            raise HTTPException(403,'Este envio é privado.')
        return a,m,dict(sub)

    def serialise(sub: sqlite3.Row | dict, presenter: bool = False) -> dict:
        data = dict(sub)
        with db() as c:
            m = c.execute('SELECT * FROM members WHERE id=?', (data['member_id'],)).fetchone()
            fs = c.execute('SELECT id,filename,size FROM files WHERE submission_id=? ORDER BY created', (data['id'],)).fetchall()
        result = {k:data[k] for k in ['id','room','exercise','prompt','result','model','settings','reflection','attempt','created','feedback']}
        result.update(alias=m['alias'],group=m['group_name'],consent=bool(data['consent']),published=bool(data['published']),
                      scores=json.loads(data['scores']) if data['scores'] else None,
                      attachments=[dict(x) for x in fs],dataset_version=CONTENT['datasetVersion'])
        if presenter: result['nickname'] = m['nickname']
        return result

    @app.get('/api/health')
    def health(): return {'ok':True,'version':'2.0.0','deck_hash':DECK_HASH}

    @app.get('/api/me')
    def me(request: Request):
        a = actor(request,False)
        if not a: return {'role':'guest','rooms':[],'retention_days':days}
        with db() as c:
            if a['role']=='presenter': rs=c.execute('SELECT * FROM rooms WHERE expires>? ORDER BY created DESC', (time.time(),)).fetchall()
            else: rs=c.execute('SELECT r.* FROM rooms r JOIN members m ON m.room=r.code WHERE m.token_hash=? AND r.expires>? ORDER BY r.created DESC',(a['token_hash'],time.time())).fetchall()
        return {'role':a['role'],'rooms':[state(dict(r)) for r in rs if r['deck_hash']==DECK_HASH], 'retention_days':days}

    @app.post('/api/login')
    async def login(request: Request):
        rate(request,'login',8,300)
        p=text(await body(request),'password',1,256)
        if not hmac.compare_digest(p.encode(),password.encode()): raise HTTPException(401,'Senha inválida.')
        return session_response({'role':'presenter'},'presenter')

    @app.post('/api/logout')
    def logout(request: Request):
        a=actor(request,False)
        if a:
            with db() as c: c.execute('UPDATE sessions SET expires=? WHERE token_hash=?',(time.time()-1,a['token_hash']))
        response=JSONResponse({'ok':True}); response.delete_cookie(COOKIE,path='/'); return response

    @app.post('/api/rooms')
    async def create_room(request: Request):
        teacher(request); rate(request,'create',20)
        title=text(await body(request),'title',1,80)
        code=''.join(secrets.choice('ABCDEFGHJKLMNPQRSTUVWXYZ23456789') for _ in range(10))
        now=time.time()
        with db() as c:
            active=c.execute('SELECT COUNT(*) FROM rooms WHERE expires>?',(now,)).fetchone()[0]
            if active>=100: raise HTTPException(409,'Limite de salas ativas atingido. Exclua salas anteriores.')
            c.execute('INSERT INTO rooms(code,title,slide,created,expires,deck_hash) VALUES(?,?,?,?,?,?)',(code,title,CONTENT['slides'][0]['id'],now,now+days*86400,DECK_HASH))
        return state(get_room(code))

    @app.post('/api/rooms/{code}/join')
    async def join(code: str, request: Request):
        rate(request,'join',300)
        room=get_room(code)
        if room['closed']: raise HTTPException(409,'Sala encerrada para novas entradas e envios.')
        data=await body(request); name=text(data,'nickname',2,50); group=text(data,'group',0,20)
        if group not in {'','CEO','CFO','COO','CMO','CHRO'}: raise HTTPException(422,'Grupo inválido.')
        if not flag(data,'privacy_ack'): raise HTTPException(422,'É necessário reconhecer o aviso de privacidade.')
        a=actor(request,False); new_token=None
        if a and a['role']=='presenter': return {'role':'presenter','room':state(room)}
        if not a:
            new_token=secrets.token_urlsafe(32); a={'token_hash':digest(new_token),'role':'student'}
        with db() as c:
            c.execute('BEGIN IMMEDIATE')
            old=c.execute('SELECT id FROM members WHERE room=? AND token_hash=?',(room['code'],a['token_hash'])).fetchone()
            if not old:
                count=c.execute('SELECT COUNT(*) FROM members WHERE room=?',(room['code'],)).fetchone()[0]
                if count>=200: raise HTTPException(409,'Limite configurado de 200 participantes atingido.')
                if new_token: c.execute('INSERT INTO sessions VALUES(?,?,?)',(a['token_hash'],'student',time.time()+24*3600))
                c.execute('INSERT INTO members VALUES(?,?,?,?,?,?,?)',(secrets.token_hex(16),room['code'],a['token_hash'],name,f'Participante {count+1:03d}',group,time.time()))
            else:
                c.execute('UPDATE members SET nickname=?,group_name=? WHERE id=?',(name,group,old['id']))
            c.execute('UPDATE rooms SET version=version+1 WHERE code=?',(room['code'],))
        response=JSONResponse({'role':'student','room':state(get_room(code))})
        if new_token: response.set_cookie(COOKIE,new_token,max_age=86400,httponly=True,secure=secure_cookie,samesite='strict',path='/')
        return response

    @app.get('/api/rooms/{code}')
    def room_state(code: str, request: Request): return state(access(request,code)[2])

    @app.patch('/api/rooms/{code}')
    async def change_room(code: str,request: Request):
        teacher(request); room=get_room(code); data=await body(request)
        selected=text(data,'slide',default=room['slide'])
        if selected not in SLIDES: raise HTTPException(422,'Slide inválido.')
        closed=flag(data,'closed',bool(room['closed']))
        expected=data.get('version')
        if type(expected) is not int: raise HTTPException(422,'Informe a versão atual da sala.')
        with db() as c:
            result=c.execute('UPDATE rooms SET slide=?,closed=?,version=version+1 WHERE code=? AND version=?', (selected,int(closed),room['code'],expected))
            if result.rowcount!=1: raise HTTPException(409,'A sala mudou em outra tela. Atualize e tente novamente.')
        return state(get_room(code))

    @app.delete('/api/rooms/{code}')
    def delete_room(code: str,request: Request):
        teacher(request); room=get_room(code)
        with db() as c: erase_room(room['code'],c)
        return {'ok':True}

    @app.get('/api/rooms/{code}/qr.png')
    def qr(code: str,request: Request):
        _,_,room=access(request,code)
        buf=io.BytesIO(); qrcode.make(f"{base}/?sala={room['code']}").save(buf,format='PNG')
        return Response(buf.getvalue(),media_type='image/png')

    @app.get('/api/rooms/{code}/events')
    async def events(code: str,request: Request):
        access(request,code)
        async def stream():
            last=None; heartbeat=time.monotonic()
            yield 'retry: 2000\n\n'
            while not await request.is_disconnected():
                try:
                    _,_,room=access(request,code)
                except HTTPException:
                    yield 'event: ended\ndata: {}\n\n'; return
                current=(room['version'],room['revision'])
                if current!=last:
                    last=current
                    payload=json.dumps(state(room),ensure_ascii=False)
                    yield f'id: {current[0]}:{current[1]}\nevent: state\ndata: {payload}\n\n'
                elif time.monotonic()-heartbeat>=15:
                    yield ': heartbeat\n\n'; heartbeat=time.monotonic()
                await asyncio.sleep(.5)
        return StreamingResponse(stream(),media_type='text/event-stream',headers={'X-Accel-Buffering':'no','Cache-Control':'no-cache'})

    @app.post('/api/rooms/{code}/submissions')
    async def submit(code: str,request: Request):
        a,m,room=access(request,code)
        if not m: raise HTTPException(403,'Use uma sessão de participante para enviar uma atividade.')
        if room['closed']: raise HTTPException(409,'Sala encerrada. Exporte seu rascunho local.')
        # Per-session rate limit avoids punishing a classroom sharing one IP.
        now=time.time(); data=await body(request)
        exercise=text(data,'exercise',1,40)
        if exercise not in EXERCISES: raise HTTPException(422,'Exercício inválido.')
        client_id=text(data,'client_id',8,80)
        prompt=text(data,'prompt',15,15000); result=text(data,'result',0,30000)
        model=text(data,'model',1,100); settings=text(data,'settings',0,300)
        reflection=text(data,'reflection',0,4000); consent=flag(data,'consent')
        with db() as c:
            c.execute('BEGIN IMMEDIATE')
            existing=c.execute('SELECT * FROM submissions WHERE member_id=? AND client_id=?',(m['id'],client_id)).fetchone()
            if existing: return serialise(existing)
            recent=c.execute('SELECT COUNT(*) FROM submissions WHERE member_id=? AND created>?',(m['id'],now-60)).fetchone()[0]
            total=c.execute('SELECT COUNT(*) FROM submissions WHERE member_id=?',(m['id'],)).fetchone()[0]
            if recent>=15 or total>=100: raise HTTPException(429,'Limite de tentativas atingido.')
            attempt=c.execute('SELECT COUNT(*) FROM submissions WHERE member_id=? AND exercise=?',(m['id'],exercise)).fetchone()[0]+1
            sid=secrets.token_hex(16)
            c.execute('INSERT INTO submissions(id,room,member_id,exercise,client_id,prompt,result,model,settings,reflection,attempt,consent,created) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)', (sid,room['code'],m['id'],exercise,client_id,prompt,result,model,settings,reflection,attempt,int(consent),now))
            c.execute('UPDATE rooms SET revision=revision+1 WHERE code=?',(room['code'],))
        return serialise(submission_access(request,sid)[2])

    @app.get('/api/rooms/{code}/submission-summary')
    def submission_summary(code: str, request: Request):
        teacher(request)
        _,_,room=access(request,code)
        with db() as c:
            row=c.execute('''SELECT COUNT(*) AS total,
                COALESCE(SUM(consent=1 AND published=0),0) AS pending_review,
                COALESCE(SUM(consent=0),0) AS without_consent,
                COALESCE(SUM(consent=1 AND published=1),0) AS published
                FROM submissions WHERE room=?''',(room['code'],)).fetchone()
        return dict(row)

    @app.get('/api/rooms/{code}/submissions')
    def submissions(code: str,request: Request, scope: str = 'gallery', exercise: str = ''):
        a,m,room=access(request,code)
        params=[room['code']]; where='s.room=?'
        if scope=='mine':
            if not m: return []
            where+=' AND s.member_id=?'; params.append(m['id'])
        elif scope=='review':
            if a['role']!='presenter': raise HTTPException(403,'Revisão privada do facilitador.')
        elif scope=='gallery': where+=' AND s.published=1 AND s.consent=1'
        else: raise HTTPException(422,'Escopo inválido.')
        if exercise:
            if exercise not in EXERCISES: raise HTTPException(422,'Exercício inválido.')
            where+=' AND s.exercise=?'; params.append(exercise)
        with db() as c: found=c.execute(f'SELECT s.* FROM submissions s WHERE {where} ORDER BY s.created DESC LIMIT 500',params).fetchall()
        return [serialise(x,scope=='review') for x in found]

    @app.patch('/api/submissions/{sid}/consent')
    async def consent(sid: str,request: Request):
        a,m,sub=submission_access(request,sid)
        if not m or m['id']!=sub['member_id']: raise HTTPException(403,'Somente o autor pode alterar a autorização.')
        value=flag(await body(request),'consent')
        with db() as c:
            c.execute('UPDATE submissions SET consent=?,published=0 WHERE id=?',(int(value),sid))
            c.execute('UPDATE rooms SET revision=revision+1 WHERE code=?',(sub['room'],))
        return {'ok':True}

    @app.patch('/api/submissions/{sid}/review')
    async def review(sid: str,request: Request):
        teacher(request); _,_,sub=submission_access(request,sid); data=await body(request)
        publish=flag(data,'published',bool(sub['published']))
        if publish and not sub['consent']: raise HTTPException(409,'O participante não autorizou o compartilhamento.')
        scores=data.get('scores')
        if scores is not None:
            if not isinstance(scores,dict) or set(scores)!=RUBRIC or any(type(v) is not int or not 0<=v<=4 for v in scores.values()):
                raise HTTPException(422,'Informe as cinco notas inteiras de 0 a 4.')
        feedback=text(data,'feedback',0,3000,sub['feedback'])
        if publish and not sub['result']:
            with db() as c:
                if not c.execute('SELECT 1 FROM files WHERE submission_id=?',(sid,)).fetchone():
                    raise HTTPException(409,'Envio sem resultado e sem anexo.')
        with db() as c:
            c.execute('UPDATE submissions SET published=?,scores=?,feedback=? WHERE id=?',(int(publish),json.dumps(scores) if scores else sub['scores'],feedback,sid))
            c.execute('UPDATE rooms SET revision=revision+1 WHERE code=?',(sub['room'],))
        return {'ok':True}

    @app.delete('/api/submissions/{sid}')
    def remove_submission(sid: str,request: Request):
        a,m,sub=submission_access(request,sid)
        if a['role']!='presenter' and (not m or m['id']!=sub['member_id']): raise HTTPException(403,'Somente o autor ou facilitador pode excluir.')
        with db() as c:
            paths=c.execute('SELECT stored_name FROM files WHERE submission_id=?',(sid,)).fetchall()
            c.execute('DELETE FROM submissions WHERE id=?',(sid,))
            c.execute('UPDATE rooms SET revision=revision+1 WHERE code=?',(sub['room'],))
            for path in paths: (uploads/path['stored_name']).unlink(missing_ok=True)
        return {'ok':True}

    @app.post('/api/submissions/{sid}/attachments')
    async def upload(sid: str,request: Request,filename: str):
        a,m,sub=submission_access(request,sid)
        if not m or m['id']!=sub['member_id']: raise HTTPException(403,'Somente o autor pode anexar arquivos.')
        room=get_room(sub['room'])
        if room['closed']: raise HTTPException(409,'Sala encerrada.')
        name=Path(filename.replace('\\','/')).name
        if len(name)>100 or not name or any(ord(ch)<32 for ch in name): raise HTTPException(422,'Nome de arquivo inválido.')
        ext=Path(name).suffix.lower()
        if ext not in ALLOWED_FILES: raise HTTPException(415,'Formatos permitidos: TXT, MD, CSV, JSON, PNG, JPG e PDF.')
        temp=uploads/f'.pending-{secrets.token_hex(16)}'; size=0
        try:
            with temp.open('wb') as f:
                async for chunk in request.stream():
                    size+=len(chunk)
                    if size>MAX_FILE: raise HTTPException(413,'Cada anexo pode ter no máximo 5 MiB.')
                    f.write(chunk)
            if not size: raise HTTPException(422,'Arquivo vazio.')
            raw=temp.read_bytes()
            if ext in {'.txt','.md','.csv','.json'}:
                try:
                    decoded=raw.decode('utf-8-sig')
                    if '\x00' in decoded: raise ValueError()
                    if ext=='.json': json.loads(decoded)
                except (UnicodeError,ValueError): raise HTTPException(415,'Texto deve ser UTF-8 e JSON deve ser válido.')
            elif ext=='.pdf':
                if not raw.startswith(b'%PDF-'): raise HTTPException(415,'Assinatura de PDF inválida.')
                # PDFs are never executed, embedded, or interpreted. Always force download.
            else:
                try:
                    with warnings.catch_warnings():
                        warnings.simplefilter('error',Image.DecompressionBombWarning)
                        with Image.open(temp) as img:
                            expected='PNG' if ext=='.png' else 'JPEG'
                            if img.format!=expected: raise ValueError()
                            img.load()
                            safe=img.convert('RGB') if expected=='JPEG' else img.convert('RGBA')
                            safe.save(temp,format=expected)
                    size=temp.stat().st_size
                    if size>MAX_FILE: raise HTTPException(413,'Imagem reprocessada excede 5 MiB.')
                except HTTPException: raise
                except Exception: raise HTTPException(415,'Imagem inválida ou resolução excessiva.')
            fid=secrets.token_hex(16); stored=fid+ext
            with db() as c:
                c.execute('BEGIN IMMEDIATE')
                if not c.execute('SELECT 1 FROM submissions WHERE id=?',(sid,)).fetchone(): raise HTTPException(404,'Envio removido.')
                count=c.execute('SELECT COUNT(*) FROM files WHERE submission_id=?',(sid,)).fetchone()[0]
                used=c.execute('SELECT COALESCE(SUM(f.size),0) FROM files f JOIN submissions s ON s.id=f.submission_id WHERE s.room=?',(sub['room'],)).fetchone()[0]
                total_disk=c.execute('SELECT COALESCE(SUM(size),0) FROM files').fetchone()[0]
                if count>=3: raise HTTPException(409,'Limite de três anexos por tentativa.')
                if used+size>100*1024*1024 or total_disk+size>1024*1024*1024: raise HTTPException(413,'Cota de armazenamento atingida.')
                temp.replace(uploads/stored)
                c.execute('INSERT INTO files VALUES(?,?,?,?,?,?)',(fid,sid,name,stored,size,time.time()))
                # New content always requires a new moderation decision.
                c.execute('UPDATE submissions SET published=0 WHERE id=?',(sid,))
                c.execute('UPDATE rooms SET revision=revision+1 WHERE code=?',(sub['room'],))
            return {'id':fid,'filename':name,'size':size}
        finally:
            temp.unlink(missing_ok=True)

    @app.get('/api/files/{fid}')
    def file(fid: str,request: Request):
        with db() as c: f=c.execute('SELECT * FROM files WHERE id=?',(fid,)).fetchone()
        if not f: raise HTTPException(404,'Arquivo não encontrado.')
        submission_access(request,f['submission_id'])
        path=uploads/f['stored_name']
        if not path.is_file(): raise HTTPException(404,'Arquivo indisponível.')
        return FileResponse(path,media_type='application/octet-stream',filename=f['filename'],content_disposition_type='attachment',headers={'Content-Security-Policy':"sandbox; default-src 'none'"})

    @app.get('/api/rooms/{code}/export')
    def export(code: str,request: Request):
        teacher(request); room=get_room(code)
        with db() as c: subs=c.execute('SELECT * FROM submissions WHERE room=? ORDER BY created',(room['code'],)).fetchall()
        payload={'room':state(room),'exported_at':time.time(),'scope':'Privado: uso do facilitador; não publicar sem nova autorização.','submissions':[serialise(s,True) for s in subs]}
        return Response(json.dumps(payload,ensure_ascii=False,indent=2),media_type='application/json',headers={'Content-Disposition':f'attachment; filename="workshop-{room["code"]}-privado.json"'})

    @app.get('/')
    def index(): return FileResponse(ROOT/'index.html')

    @app.get('/keycore-logo.png')
    def logo():
        path=ROOT/'keycore-logo.png'
        if not path.exists(): raise HTTPException(404,'Mantenha a logomarca original do repositório nesta pasta.')
        return FileResponse(path)

    app.mount('/static',StaticFiles(directory=ROOT/'static'),name='static')
    app.mount('/resources',StaticFiles(directory=ROOT/'resources'),name='resources')
    app.state.database=database
    app.state.cleanup=cleanup
    return app

app = create_app()
