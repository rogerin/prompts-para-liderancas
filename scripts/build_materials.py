"""Build browser content and downloadable study materials from content.json.

Run this after editing slides/prompts. This script does not regenerate the synthetic data.
"""
from pathlib import Path
import json
import zipfile

ROOT = Path(__file__).resolve().parents[1]
content = json.loads((ROOT / 'content.json').read_text(encoding='utf-8'))
ids = {p['id'] for p in content['prompts']}
if len(ids) != len(content['prompts']):
    raise ValueError('IDs de prompts duplicados.')
for slide in content['slides']:
    if any(p not in ids for p in slide.get('prompts', [])):
        raise ValueError(f"Referência de prompt inválida: {slide['id']}")
(ROOT/'static/content.js').write_text('window.WORKSHOP_CONTENT = '+json.dumps(content,ensure_ascii=False)+';\n',encoding='utf-8')
(ROOT/'resources/prompts.json').write_text(json.dumps(content['prompts'],ensure_ascii=False,indent=2),encoding='utf-8')
kit='# Prompts para Lideranças | KeyCore Academy\n\nCaso fictício NC-2026.1. Substitua os campos entre colchetes. Anexe somente as fontes necessárias. Nenhum modelo é executado por esta aplicação.\n\n'
for p in content['prompts']:
    kit+=f"## {p['id']} | {p['category']} | {p['title']}\n\nQuando usar: {p['use']}.\n\n```text\n{p['text']}\n```\n\n"
(ROOT/'resources/kit-prompts.md').write_text(kit.rstrip()+'\n',encoding='utf-8')
clear = next(slide for slide in content['slides'] if slide['id'] == 'clear')
clear_guide = '# CLEAR para prompts de liderança\n\n'
clear_guide += 'Cinco princípios para escrever, testar e revisar. Adaptar e refletir fazem parte da conversa e da avaliação humana, não apenas do texto inicial.\n\n'
for card in clear['cards']:
    clear_guide += f"## {card['title']} ({card['english']})\n\n{card['body']}\n\n{card['detail']['explanation']}\n\n"
clear_guide += '## Exemplo aplicado à Núcleo Casa\n\n```text\n'
clear_guide += '\n\n'.join(part['text'] for part in clear['clearExample']) + '\n```\n\n'
clear_guide += f"Referência: [{clear['source']['title']}]({clear['source']['url']}). Exemplo didático próprio do workshop.\n"
(ROOT/'resources/clear.md').write_text(clear_guide, encoding='utf-8')
with zipfile.ZipFile(ROOT/'resources/kit-estudo-completo.zip','w',zipfile.ZIP_DEFLATED) as archive:
    for p in sorted((ROOT/'resources').rglob('*')):
        if p.is_file() and p.suffix!='.zip':
            archive.write(p,p.relative_to(ROOT/'resources'))
print(f"Gerados: {len(content['slides'])} slides, {len(content['prompts'])} prompts e kit de estudo.")
