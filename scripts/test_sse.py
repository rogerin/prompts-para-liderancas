"""Run against a local test server. Creates and removes its own test room."""
import asyncio, json, time, os
from pathlib import Path
import httpx
BASE=os.environ.get('TEST_BASE_URL','http://127.0.0.1:8101').rstrip('/')
PASSWORD=os.environ['TEST_FACILITATOR_PASSWORD']
HEAD={'x-workshop':'1','origin':BASE}
async def main():
 async with httpx.AsyncClient(base_url=BASE,headers=HEAD,timeout=10) as t, httpx.AsyncClient(base_url=BASE,headers=HEAD,timeout=10) as a, httpx.AsyncClient(base_url=BASE,headers=HEAD,timeout=10) as b:
  r=await t.post('/api/login',json={'password':PASSWORD});r.raise_for_status()
  room=(await t.post('/api/rooms',json={'title':'Validação SSE'})).json();code=room['code']
  for client,name in [(a,'Teste A'),(b,'Teste B')]:
   (await client.post(f'/api/rooms/{code}/join',json={'nickname':name,'privacy_ack':True,'group':'CEO'})).raise_for_status()
  initial=[]; arrivals={};ready=asyncio.Event();count=0
  async def listen(client,label):
   nonlocal count
   async with client.stream('GET',f'/api/rooms/{code}/events') as response:
    response.raise_for_status()
    async for line in response.aiter_lines():
     if line.startswith('data: '):
      data=json.loads(line[6:])
      if data['slide']=='entrada':
       initial.append(label);count+=1
       if count==2:ready.set()
      if data['slide']=='ceo':arrivals[label]=time.perf_counter();return data
  tasks=[asyncio.create_task(listen(a,'A')),asyncio.create_task(listen(b,'B'))]
  await asyncio.wait_for(ready.wait(),5)
  state=(await t.get(f'/api/rooms/{code}')).json();start=time.perf_counter()
  update=await t.patch(f'/api/rooms/{code}',json={'slide':'ceo','version':state['version']});update.raise_for_status()
  got=await asyncio.wait_for(asyncio.gather(*tasks),5)
  assert all(x['slide']=='ceo' for x in got)
  # New SSE connection starts with authoritative current state, regardless of last-event-id.
  async with b.stream('GET',f'/api/rooms/{code}/events',headers={'Last-Event-ID':'1:0'}) as response:
   async for line in response.aiter_lines():
    if line.startswith('data: '):
     assert json.loads(line[6:])['slide']=='ceo';break
  qr=await a.get(f'/api/rooms/{code}/qr.png');qr.raise_for_status()
  assert qr.content.startswith(b'\x89PNG')
  output={'method':'Dois clientes HTTP independentes e simultâneos conectados ao servidor local, sem mocks.','checks':['Estado inicial entregue a ambos os clientes','Mudança de slide recebida por ambas as conexões SSE','Reconexão entrega o slide atual','Endpoint QR retorna PNG autenticado'],'latency_ms':{k:round((v-start)*1000,1) for k,v in arrivals.items()},'note':'Latência local, não representa desempenho em rede pública ou carga de uma turma.'}
  await t.delete(f'/api/rooms/{code}')
  print(json.dumps(output,ensure_ascii=False,indent=2))
if __name__ == '__main__':
 asyncio.run(main())
