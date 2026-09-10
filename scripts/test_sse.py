"""Run against a local test server. Creates and removes its own test room."""
import asyncio
import json
import os
import time
import httpx

BASE = os.environ.get('TEST_BASE_URL', 'http://127.0.0.1:8101').rstrip('/')
PASSWORD = os.environ['TEST_FACILITATOR_PASSWORD']
HEAD = {'x-workshop': '1', 'origin': BASE}


async def main():
    async with httpx.AsyncClient(base_url=BASE, headers=HEAD, timeout=10) as teacher, \
            httpx.AsyncClient(base_url=BASE, headers=HEAD, timeout=10) as a, \
            httpx.AsyncClient(base_url=BASE, headers=HEAD, timeout=10) as b:
        (await teacher.post('/api/login', json={'password': PASSWORD})).raise_for_status()
        created = await teacher.post('/api/rooms', json={'title': 'Validação SSE'})
        created.raise_for_status()
        code = created.json()['code']
        queues = {label: asyncio.Queue() for label in ('A', 'B')}
        tasks = []
        checks = []
        latencies = {}

        async def listen(client, label):
            async with client.stream('GET', f'/api/rooms/{code}/events') as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if line.startswith('data: '):
                        await queues[label].put((json.loads(line[6:]), time.perf_counter()))

        async def expect_both(predicate):
            async def match(label):
                while True:
                    state, arrival = await queues[label].get()
                    if predicate(state):
                        return label, state, arrival
            return await asyncio.wait_for(asyncio.gather(*(match(label) for label in queues)), 5)

        async def change(description, **changes):
            current = (await teacher.get(f'/api/rooms/{code}')).json()
            started = time.perf_counter()
            response = await teacher.patch(f'/api/rooms/{code}', json={**changes, 'version': current['version']})
            response.raise_for_status()
            expected = response.json()
            received = await expect_both(lambda state: state['version'] == expected['version'])
            for _, state, _ in received:
                for field in ('slide', 'presentation', 'activity_timer'):
                    assert state[field] == expected[field], (description, field)
            latencies[description] = {label: round((arrival-started)*1000, 1) for label, _, arrival in received}
            checks.append(description)
            return expected

        try:
            for client, name in ((a, 'Teste A'), (b, 'Teste B')):
                (await client.post(f'/api/rooms/{code}/join', json={'nickname': name, 'privacy_ack': True, 'group': 'CEO'})).raise_for_status()
            tasks = [asyncio.create_task(listen(client, label)) for client, label in ((a, 'A'), (b, 'B'))]
            await expect_both(lambda state: state['slide'] == 'entrada')
            checks.append('Estado inicial entregue a ambos os clientes')
            await change('Slide e card abrem em ambos os clientes', slide='ceo', presentation={'kind': 'card', 'slide': 'ceo', 'card': 0})
            await change('Fechamento do modal compartilhado', presentation=None)
            await change('Exemplo CLEAR compartilhado', slide='clear', presentation={'kind': 'clear', 'slide': 'clear', 'letter': 'C'})
            await change('Destaque da letra CLEAR atualizado', presentation={'kind': 'clear', 'slide': 'clear', 'letter': 'E'})
            started = await change('Contador iniciado com o mesmo prazo', slide='primeira-tentativa', timer_action='start', exercise='baseline')
            assert started['presentation'] is None
            paused = await change('Pausa compartilhada', timer_action='pause')
            assert paused['activity_timer']['ends_at'] is None
            resumed = await change('Retomada compartilhada', timer_action='resume')
            assert resumed['activity_timer']['id'] == started['activity_timer']['id']
            async with b.stream('GET', f'/api/rooms/{code}/events', headers={'Last-Event-ID': '1:0'}) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if line.startswith('data: '):
                        state = json.loads(line[6:])
                        assert state['activity_timer'] == resumed['activity_timer']
                        assert state['slide'] == 'primeira-tentativa'
                        break
            checks.append('Reconexão recupera o prazo persistido sem reiniciar')
            await change('Contador zerado em ambos os clientes', timer_action='reset')
            qr = await a.get(f'/api/rooms/{code}/qr.png')
            qr.raise_for_status()
            assert qr.content.startswith(b'\x89PNG')
            checks.append('QR autenticado preservado')
            print(json.dumps({'method': 'Dois clientes HTTP independentes e simultâneos, sem mocks.', 'checks': checks,
                              'latency_ms': latencies, 'note': 'Latência local; não é teste de carga ou de rede pública.'}, ensure_ascii=False, indent=2))
        finally:
            for task in tasks:
                task.cancel()
            await asyncio.gather(*tasks, return_exceptions=True)
            await teacher.delete(f'/api/rooms/{code}')


if __name__ == '__main__':
    asyncio.run(main())
