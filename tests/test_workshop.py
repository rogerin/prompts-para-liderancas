from __future__ import annotations
import csv
import io
from decimal import Decimal
import json
from pathlib import Path
import sqlite3
import time
import pytest
from fastapi.testclient import TestClient
from app import create_app, CONTENT, MAX_FILE

HEADERS={'x-workshop':'1','origin':'http://testserver'}
PASSWORD='test-password-for-workshop-2026'

@pytest.fixture
def setup(tmp_path):
    app=create_app(tmp_path,PASSWORD,'http://testserver')
    with TestClient(app,headers=HEADERS) as teacher:
        assert teacher.post('/api/login',json={'password':PASSWORD}).status_code==200
        a=TestClient(app,headers=HEADERS); b=TestClient(app,headers=HEADERS)
        room=teacher.post('/api/rooms',json={'title':'Turma de teste'}).json()
        code=room['code']
        for client,name in [(a,'Aluno A'),(b,'Aluno B')]:
            assert client.post(f'/api/rooms/{code}/join',json={'nickname':name,'group':'CEO','privacy_ack':True}).status_code==200
        yield app,teacher,a,b,code
        a.close();b.close()

def submission(client,code,*,client_id='attempt-001',consent=False,exercise='baseline',result='Resposta com evidência e limitações.'):
    response=client.post(f'/api/rooms/{code}/submissions',json={'client_id':client_id,'exercise':exercise,'prompt':'Analise a base fictícia e cite os dados realmente disponíveis.','result':result,'model':'Modelo informado pelo aluno','settings':'Teste controlado','reflection':'Confira a fonte.','consent':consent})
    assert response.status_code==200,response.text
    return response.json()

def test_default_denies_no_password(tmp_path):
    with pytest.raises(RuntimeError):
        with TestClient(create_app(tmp_path,'','http://testserver')):pass

def test_origin_guard(setup):
    _,teacher,_,_,_=setup
    assert teacher.post('/api/rooms',json={'title':'x'},headers={'origin':'https://example.invalid'}).status_code==403
    assert teacher.post('/api/rooms',json={'title':'x'},headers={'x-workshop':'0'}).status_code==403

def test_cookie_security(tmp_path):
    app=create_app(tmp_path,PASSWORD,'https://classroom.example')
    with TestClient(app,base_url='https://classroom.example') as c:
        r=c.post('/api/login',json={'password':PASSWORD},headers={'x-workshop':'1','origin':'https://classroom.example'})
        cookie=r.headers['set-cookie']
        assert 'HttpOnly' in cookie and 'Secure' in cookie and 'SameSite=strict' in cookie

def test_only_teacher_changes_slide(setup):
    _,teacher,a,_,code=setup
    current=teacher.get(f'/api/rooms/{code}').json()
    body={'slide':'ceo','version':current['version']}
    assert a.patch(f'/api/rooms/{code}',json=body).status_code==403
    assert teacher.patch(f'/api/rooms/{code}',json=body).status_code==200
    assert a.get(f'/api/rooms/{code}').json()['slide']=='ceo'
    assert teacher.patch(f'/api/rooms/{code}',json=body).status_code==409

def test_late_join_receives_current_slide(setup):
    app,teacher,_,_,code=setup
    current=teacher.get(f'/api/rooms/{code}').json()
    teacher.patch(f'/api/rooms/{code}',json={'slide':'dashboard','version':current['version']})
    with TestClient(app,headers=HEADERS) as newcomer:
        r=newcomer.post(f'/api/rooms/{code}/join',json={'nickname':'Novo','group':'CFO','privacy_ack':True})
        assert r.json()['room']['slide']=='dashboard'

def test_private_then_approved_then_revoked(setup):
    _,teacher,a,b,code=setup
    s=submission(a,code)
    assert b.get(f'/api/rooms/{code}/submissions').json()==[]
    assert b.get(f'/api/rooms/{code}/submissions?scope=review').status_code==403
    assert teacher.patch(f"/api/submissions/{s['id']}/review",json={'published':True}).status_code==409
    assert a.patch(f"/api/submissions/{s['id']}/consent",json={'consent':True}).status_code==200
    assert teacher.patch(f"/api/submissions/{s['id']}/review",json={'published':True}).status_code==200
    gallery=b.get(f'/api/rooms/{code}/submissions').json()
    assert len(gallery)==1 and gallery[0]['alias']=='Participante 001'
    assert 'nickname' not in gallery[0]
    a.patch(f"/api/submissions/{s['id']}/consent",json={'consent':False})
    assert b.get(f'/api/rooms/{code}/submissions').json()==[]

def test_presenter_sees_pending_review_counts_without_publishing(setup):
    _,teacher,a,b,code=setup
    submission(a,code,client_id='private-001')
    pending=submission(a,code,client_id='pending-001',consent=True)
    published=submission(a,code,client_id='published-001',consent=True)
    teacher.patch(f"/api/submissions/{published['id']}/review",json={'published':True})
    url=f'/api/rooms/{code}/submission-summary'
    response=teacher.get(url)
    assert response.status_code==200
    assert response.json()=={'total':3,'pending_review':1,'without_consent':1,'published':1}
    assert b.get(url).status_code==403
    assert [s['id'] for s in b.get(f'/api/rooms/{code}/submissions').json()]==[published['id']]
    teacher.patch(f"/api/submissions/{pending['id']}/review",json={'published':True})
    assert teacher.get(url).json()['pending_review']==0
    assert teacher.get(url).json()['published']==2

def test_room_isolation(setup):
    _,teacher,a,b,code=setup
    other=teacher.post('/api/rooms',json={'title':'Segunda'}).json()['code']
    assert a.get(f'/api/rooms/{other}').status_code==403
    assert b.get(f'/api/rooms/{other}/submissions').status_code==403

def test_idempotency_and_new_version(setup):
    _,teacher,a,b,code=setup
    x=submission(a,code);y=submission(a,code)
    z=submission(a,code,client_id='attempt-002')
    assert x['id']==y['id'] and z['id']!=x['id'] and z['attempt']==2
    assert len(a.get(f'/api/rooms/{code}/submissions?scope=mine').json())==2
    assert b.get(f'/api/rooms/{code}/submissions?scope=mine').json()==[]

def test_attachment_access_moderation_and_filename(setup):
    _,teacher,a,b,code=setup
    s=submission(a,code,consent=True)
    upload=a.post(f"/api/submissions/{s['id']}/attachments?filename=../../resultado.txt",content='Resultado sintético'.encode('utf8'))
    assert upload.status_code==200,upload.text
    f=upload.json();assert f['filename']=='resultado.txt'
    assert b.get(f"/api/files/{f['id']}").status_code==403
    assert teacher.get(f"/api/files/{f['id']}").status_code==200
    assert teacher.patch(f"/api/submissions/{s['id']}/review",json={'published':True}).status_code==200
    download=b.get(f"/api/files/{f['id']}")
    assert download.status_code==200 and 'attachment' in download.headers['content-disposition']
    # Any newly attached content requires moderation again.
    assert a.post(f"/api/submissions/{s['id']}/attachments?filename=nova.txt",content=b'novo').status_code==200
    assert b.get(f"/api/files/{f['id']}").status_code==403

def test_upload_limits_and_types(setup):
    _,teacher,a,b,code=setup
    s=submission(a,code)
    url=f"/api/submissions/{s['id']}/attachments"
    assert a.post(url+'?filename=script.html',content=b'<html>').status_code==415
    assert a.post(url+'?filename=fake.png',content=b'not png').status_code==415
    assert a.post(url+'?filename=fake.pdf',content=b'not pdf').status_code==415
    assert a.post(url+'?filename=fake.json',content=b'not json').status_code==415
    assert a.post(url+'?filename=large.txt',content=b'x'*(MAX_FILE+1)).status_code==413
    for i in range(3):assert a.post(url+f'?filename={i}.txt',content=b'valido').status_code==200
    assert a.post(url+'?filename=4.txt',content=b'valido').status_code==409

def test_scores_validation(setup):
    _,teacher,a,_,code=setup
    s=submission(a,code,consent=True)
    valid={r['id']:3 for r in CONTENT['rubric']}
    bad=valid|{'contexto':5}
    assert teacher.patch(f"/api/submissions/{s['id']}/review",json={'scores':bad}).status_code==422
    assert teacher.patch(f"/api/submissions/{s['id']}/review",json={'scores':valid,'feedback':'Confirme a fórmula.'}).status_code==200
    assert a.get(f'/api/rooms/{code}/submissions?scope=mine').json()[0]['scores']==valid

def test_close_and_delete_room(setup):
    app,teacher,a,b,code=setup
    s=submission(a,code)
    file=a.post(f"/api/submissions/{s['id']}/attachments?filename=file.txt",content=b'resultado').json()
    state=teacher.get(f'/api/rooms/{code}').json()
    teacher.patch(f'/api/rooms/{code}',json={'version':state['version'],'closed':True})
    assert a.post(f'/api/rooms/{code}/submissions',json={}).status_code==409
    assert a.get(f'/api/rooms/{code}/submissions?scope=mine').status_code==200
    assert teacher.delete(f'/api/rooms/{code}').status_code==200
    assert a.get(f"/api/files/{file['id']}").status_code==404
    assert not list(app.state.database.parent.joinpath('uploads').iterdir())

def test_expired_room_rejected_and_cleaned(setup):
    app,teacher,a,b,code=setup
    submission(a,code)
    with sqlite3.connect(app.state.database) as c:c.execute('UPDATE rooms SET expires=? WHERE code=?',(time.time()-1,code))
    assert a.get(f'/api/rooms/{code}').status_code==404
    app.state.cleanup()
    with sqlite3.connect(app.state.database) as c:assert c.execute('SELECT COUNT(*) FROM submissions').fetchone()[0]==0

def test_public_resources_and_qr(setup):
    _,teacher,a,_,code=setup
    assert a.get('/').status_code==200
    qr=a.get(f'/api/rooms/{code}/qr.png')
    assert qr.status_code==200 and qr.content.startswith(b'\x89PNG')
    assert 'password' not in a.get(f'/api/rooms/{code}').text
    assert a.get('/var/workshop.sqlite3').status_code==404
    assert a.get('/api/rooms/'+code+'/export').status_code==403

def test_content_and_data_reconcile():
    root=Path(__file__).resolve().parents[1]
    assert len(CONTENT['slides'])==24 and len(CONTENT['prompts'])==33 and len(CONTENT['exercises'])==7
    assert sum(a['minutes'] for a in CONTENT['agenda'])==150
    ids={p['id'] for p in CONTENT['prompts']};ex={e['id'] for e in CONTENT['exercises']}
    for s in CONTENT['slides']:
        assert all(p in ids for p in s['prompts'])
        assert not s['exercise'] or s['exercise'] in ex
        for card in s['cards']:
            assert 10 <= len(card['body'].split()) <= 30
            assert all(card['detail'].get(key) for key in ('explanation', 'example', 'question'))
    clear = CONTENT['slides'][4]
    assert clear['id'] == 'clear'
    assert [card['letter'] for card in clear['cards']] == list('CLEAR')
    assert [part['letter'] for part in clear['clearExample']] == list('CLEAR')
    with (root/'resources/dados/nucleo-casa-mensal.csv').open() as f:rows=list(csv.DictReader(f))
    assert len(rows)==432 and len({r['id'] for r in rows})==432
    assert sum(Decimal(r['receita_bruta']) for r in rows)==Decimal('48600000.00')
    assert sum(int(r['pedidos']) for r in rows)==41820
    for r in rows:
        assert Decimal(r['receita_liquida'])==Decimal(r['receita_bruta'])-Decimal(r['descontos'])-Decimal(r['devolucoes_valor'])
        assert int(r['promotores_nps'])+int(r['detratores_nps'])<=int(r['respostas_nps'])
        assert int(r['pedidos_atrasados'])<=int(r['pedidos'])


def patch_state(teacher, code, **changes):
    current = teacher.get(f'/api/rooms/{code}').json()
    result = teacher.patch(f'/api/rooms/{code}', json={**changes, 'version': current['version']})
    assert result.status_code == 200, result.text
    return result.json()


def test_teaching_modal_open_select_close_and_slide_change(setup):
    _, teacher, student, _, code = setup
    for card in range(3):
        detail = {'kind': 'card', 'slide': 'entrada', 'card': card}
        patch_state(teacher, code, presentation=detail)
        assert student.get(f'/api/rooms/{code}').json()['presentation'] == detail
    patch_state(teacher, code, presentation=None)
    assert student.get(f'/api/rooms/{code}').json()['presentation'] is None
    patch_state(teacher, code, presentation=detail)
    assert patch_state(teacher, code, slide='clear')['presentation'] is None
    for letter in 'CLEAR':
        detail = {'kind': 'clear', 'slide': 'clear', 'letter': letter}
        patch_state(teacher, code, presentation=detail)
        assert student.get(f'/api/rooms/{code}').json()['presentation'] == detail


def test_late_join_receives_modal_and_authoritative_timer(setup):
    app, teacher, _, _, code = setup
    detail = {'kind': 'card', 'slide': 'primeira-tentativa', 'card': 0}
    state = patch_state(teacher, code, slide='primeira-tentativa', presentation=detail,
                        timer_action='start', exercise='baseline')
    with TestClient(app, headers=HEADERS) as newcomer:
        joined = newcomer.post(f'/api/rooms/{code}/join', json={'nickname': 'Depois', 'privacy_ack': True}).json()['room']
        assert joined['presentation'] == detail
        assert joined['activity_timer'] == state['activity_timer']
        assert joined['server_time'] >= state['server_time']


def test_timer_pause_resume_restart_and_reset_keep_server_time(setup, monkeypatch):
    _, teacher, student, _, code = setup
    now = time.time()
    monkeypatch.setattr('app.time.time', lambda: now)
    started = patch_state(teacher, code, slide='primeira-tentativa', timer_action='start', exercise='baseline')['activity_timer']
    assert started['duration'] == 180
    assert started['ends_at'] == now + 180
    now += 17.5
    paused = patch_state(teacher, code, timer_action='pause')['activity_timer']
    assert paused['remaining'] == 162.5 and paused['ends_at'] is None
    now += 60
    resumed = patch_state(teacher, code, timer_action='resume')['activity_timer']
    assert resumed['id'] == started['id'] and resumed['ends_at'] == now + 162.5
    patch_state(teacher, code, slide='clear')
    assert student.get(f'/api/rooms/{code}').json()['activity_timer'] == resumed
    now += 170
    ended = patch_state(teacher, code, timer_action='pause')['activity_timer']
    assert ended['remaining'] == 0
    restarted = patch_state(teacher, code, slide='primeira-tentativa', timer_action='start', exercise='baseline')['activity_timer']
    assert restarted['id'] != started['id']
    assert patch_state(teacher, code, timer_action='reset')['activity_timer'] is None


def test_shared_teaching_controls_require_facilitator(setup):
    _, teacher, student, _, code = setup
    current = teacher.get(f'/api/rooms/{code}').json()
    for change in [dict(presentation={'kind': 'card', 'slide': 'entrada', 'card': 0}), dict(timer_action='reset')]:
        assert student.patch(f'/api/rooms/{code}', json={**change, 'version': current['version']}).status_code == 403
    assert teacher.get(f'/api/rooms/{code}').json()['version'] == current['version']


@pytest.mark.parametrize('change', [
    {'presentation': {'kind': 'card', 'slide': 'entrada', 'card': 3}},
    {'presentation': {'kind': 'card', 'slide': 'entrada', 'card': True}},
    {'presentation': {'kind': 'card', 'slide': 'ceo', 'card': 0}},
    {'presentation': {'kind': 'review', 'slide': 'entrada'}},
    {'slide': 'clear', 'presentation': {'kind': 'clear', 'slide': 'clear', 'letter': 'CL'}},
    {'timer_action': 'start', 'exercise': 'baseline'},
    {'timer_action': 'resume'},
])
def test_teaching_state_rejects_invalid_controls_atomically(setup, change):
    _, teacher, _, _, code = setup
    current = teacher.get(f'/api/rooms/{code}').json()
    result = teacher.patch(f'/api/rooms/{code}', json={**change, 'version': current['version']})
    assert result.status_code == 422
    assert teacher.get(f'/api/rooms/{code}').json()['version'] == current['version']


def test_existing_room_schema_is_migrated_without_losing_rooms(tmp_path):
    from app import DECK_HASH
    with sqlite3.connect(tmp_path/'workshop.sqlite3') as db:
        db.execute('CREATE TABLE rooms (code TEXT PRIMARY KEY, title TEXT, slide TEXT, version INTEGER DEFAULT 1, revision INTEGER DEFAULT 0, closed INTEGER DEFAULT 0, created REAL, expires REAL, deck_hash TEXT)')
        db.execute('INSERT INTO rooms(code,title,slide,created,expires,deck_hash) VALUES(?,?,?,?,?,?)',
                   ('ABCDEFGHJK', 'Turma preservada', 'entrada', time.time(), time.time()+3600, DECK_HASH))
    app = create_app(tmp_path, PASSWORD, 'http://testserver')
    for _ in range(2):
        with TestClient(app, headers=HEADERS) as teacher:
            teacher.post('/api/login', json={'password': PASSWORD})
            state = teacher.get('/api/rooms/ABCDEFGHJK').json()
            assert state['title'] == 'Turma preservada'
            assert state['presentation'] is None and state['activity_timer'] is None
