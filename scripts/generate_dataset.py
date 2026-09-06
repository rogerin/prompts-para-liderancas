"""Regenerate only the fully synthetic training dataset, with a fixed seed."""
from pathlib import Path
import json, random, csv, math, hashlib
from decimal import Decimal
B=Path(__file__).resolve().parents[1]
(B/'resources/dados').mkdir(parents=True,exist_ok=True)
rng=random.Random(602026)
rows=[]
for year in (2023,2024,2025):
 for month in range(1,13):
  t=(year-2023)*12+month-1
  for channel,cf in [('E-commerce',1.18),('Lojas',1.0),('B2B',.62)]:
   for region,rf in [('Sudeste',1.5),('Nordeste',1.0),('Sul',.8),('Centro-Oeste',.65)]:
    weight=(1+t*.018)*cf*rf*(1.3 if month in [11,12] else .92 if month==2 else 1)*rng.uniform(.88,1.12)
    rows.append({'mes':f'{year}-{month:02d}','canal':channel,'regiao':region,'w':weight})
weights=sum(x['w'] for x in rows)
revenues=[round(x['w']/weights*4860000000) for x in rows]
revenues[-1]+=4860000000-sum(revenues)
orders=[max(1,round(x['w']/weights*41820)) for x in rows]
orders[-1]+=41820-sum(orders)
for i,(x,rc,order) in enumerate(zip(rows,revenues,orders)):
 t=(int(x['mes'][:4])-2023)*12+int(x['mes'][-2:])-1
 gross=Decimal(rc)/100
 discount=(gross*Decimal(str(.025+(t/36)*.02))).quantize(Decimal('.01'))
 returns=(gross*Decimal(str(.01+(t/36)*.018))).quantize(Decimal('.01'))
 net=gross-discount-returns
 cost=(net*Decimal(str(.51+t*.0035+rng.uniform(-.025,.025)))).quantize(Decimal('.01'))
 freight=(net*Decimal(str((.04 if x['canal']=='E-commerce' else .019)+t*.001))).quantize(Decimal('.01'))
 fees=(net*Decimal('.024')).quantize(Decimal('.01'))
 marketing=(net*Decimal(str(.075 if x['canal']=='E-commerce' else .018))).quantize(Decimal('.01'))
 late_rate=.04+t*.004+( .10 if x['mes']>='2025-09' and x['regiao']=='Sudeste' and x['canal']=='E-commerce' else 0)
 nps_n=max(5,round(order*.32)); promoters=round(nps_n*(.74-t*.006)); detractors=round(nps_n*(.10+t*.004))
 x.pop('w')
 x.update(id=f'M-{i+1:04d}',pedidos=order,receita_bruta=f'{gross:.2f}',descontos=f'{discount:.2f}',devolucoes_valor=f'{returns:.2f}',receita_liquida=f'{net:.2f}',cmv=f'{cost:.2f}',frete_custo=f'{freight:.2f}',taxas_pagamento=f'{fees:.2f}',marketing_investimento=f'{marketing:.2f}',novos_clientes=max(1,round(order*(.52 if x['canal']=='E-commerce' else .28))),pedidos_atrasados=round(order*late_rate),devolucoes_pedidos=round(order*(.018+t*.0005)),respostas_nps=nps_n,promotores_nps=promoters,detratores_nps=detractors)

def csv_write(name, rs):
 with (B/'resources/dados'/name).open('w',encoding='utf-8',newline='') as f:
  w=csv.DictWriter(f,fieldnames=list(rs[0]),lineterminator='\n'); w.writeheader(); w.writerows(rs)
csv_write('nucleo-casa-mensal.csv',rows)
people=[]; stock=[]
for y in (2023,2024,2025):
 for m in range(1,13):
  t=(y-2023)*12+m-1; hc=110+round(t*.8); hours=hc*176
  people.append(dict(id=f'P-{t+1:03d}',mes=f'{y}-{m:02d}',headcount_medio=hc,admissoes=4 if t%4==0 else 3,desligamentos=2 if t<24 else 4,horas_previstas=hours,horas_ausencia=round(hours*(.022+t*.0008)),horas_extras=round(hours*(.018+t*.0011)),folha_total=f'{hc*(4200+t*15):.2f}'))
  monthrows=[x for x in rows if x['mes']==f'{y}-{m:02d}']; cmv=sum(Decimal(x['cmv']) for x in monthrows)
  stock.append(dict(id=f'E-{t+1:03d}',mes=f'{y}-{m:02d}',cmv_mes=f'{cmv:.2f}',estoque_medio_custo=f'{(cmv*Decimal(str(2.1+t*.027))).quantize(Decimal(".01")):.2f}',skus_catalogo=1280,skus_sem_estoque=round(1280*(.026+t*.0011))))
csv_write('pessoas-mensal.csv',people); csv_write('estoque-mensal.csv',stock)
summary={'cenario':'Núcleo Casa, inteiramente fictício','periodo':'2023-01 a 2025-12','receita_bruta_total':48600000,'pedidos_total':41820,'registros_mensais':len(rows),'lojas_cenario':12,'skus_cenario':1280,'versao':'NC-2026.1','seed':602026}
(B/'resources/dados/resumo.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2))
(B/'resources/dados/LEIA-ME.md').write_text('''# Núcleo Casa | conjunto sintético NC-2026.1

TODOS os dados são fictícios e foram gerados para aprendizagem. Não contêm registros de clientes, pacientes ou empregados reais. Não usar como evidência sobre uma empresa existente.

## Universo e arquivos
- `nucleo-casa-mensal.csv`: 432 registros, um por mês, canal e região. Janeiro de 2023 a dezembro de 2025. Receita bruta acumulada R$ 48.600.000,00 e 41.820 pedidos. IDs M-0001 a M-0432.
- `pessoas-mensal.csv`: 36 meses, consolidação de toda a empresa. Não cruzar multiplicando a folha pelas 12 linhas do mesmo mês de vendas.
- `estoque-mensal.csv`: 36 meses, consolidação de toda a empresa; valores ao custo. CMV coincide com o somatório mensal do primeiro arquivo.
- `nucleo-casa-exercicios.xlsx`: 12 abas com os mesmos 504 registros dos CSVs, indicadores por fórmula, comparativos mensais e anuais, cenários hipotéticos editáveis, dicionário, fontes e 19 exercícios (7 da aula e 12 desafios adicionais). As agregações não acrescentam operações. Os filtros visuais em Vendas não alteram os recortes fixos das abas de comparativo.
- `politicas-e-eventos.md`: documentos sintéticos com IDs de fonte para a atividade de recuperação de evidências.

CSV em UTF-8, separador vírgula e ponto decimal. Valores monetários em reais. Campos numéricos aditivos podem ser somados; percentuais devem ser recalculados pelos totais. Não calcular a média simples dos percentuais das linhas.

## Dicionário e fórmulas
`id`: identificador estável da linha. `mes`: competência, não data de recebimento. `canal` e `regiao`: dimensões. `pedidos`: número de pedidos, não de pessoas únicas.

Receita líquida = receita_bruta - descontos - devolucoes_valor.
Margem bruta em R$ = receita_liquida - cmv. Margem bruta % = soma da margem bruta / soma da receita_liquida.
Contribuição gerencial simplificada = receita_liquida - cmv - frete_custo - taxas_pagamento - marketing_investimento. Não é lucro líquido e não inclui folha, impostos não destacados, despesas fixas ou depreciação.
CAC gerencial = marketing_investimento / novos_clientes, no mesmo recorte, se denominador positivo. Novos clientes são atribuídos a uma linha. Isto não prova causalidade nem elimina problemas de atribuição.
Taxa de atraso = pedidos_atrasados / pedidos. Devolução de pedidos = devolucoes_pedidos / pedidos. São medidas diferentes de devolucoes_valor.
NPS = 100 * (promotores_nps - detratores_nps) / respostas_nps, recalculado com os totais. A amostra não representa automaticamente toda a base.
Turnover de desligamentos = desligamentos / headcount_medio. Absenteísmo = horas_ausencia / horas_previstas. Folha e horas extras são consolidadas; não há salários individuais.
Giro mensal de estoque = cmv_mes / estoque_medio_custo. Não anualizar sem declarar premissa. Ruptura por SKU = skus_sem_estoque / skus_catalogo.

## Limites deliberados
Não há coortes de clientes, IDs de cliente, datas de pagamento, fluxo de caixa, custos fixos completos, dados individuais, detalhamento por transportadora ou SKU, nem relação causal comprovada. LTV, recompra, caixa disponível, margem por SKU e produtividade individual não podem ser calculados com segurança. Uma boa resposta deve dizer o que falta, sem inventar valores.

12 lojas e 1.280 SKUs são atributos do cenário fictício; não existe uma tabela transacional de cada loja ou SKU. Os sinais de crescimento, pressão de margem e logística foram inseridos artificialmente; descobrir esses padrões não é descobrir um fato real.

## Cenário de decisão
Data simulada do conselho: 15/12/2025. Horizonte de decisão: Q1 e Q2 de 2026. Orçamento HIPOTÉTICO de R$ 1.200.000,00 para exercício de alocação, não saldo de caixa da base. É um cenário histórico simulado, não uma projeção atual.

## Planilha e corte temporal

A planilha é uma apresentação dos CSVs existentes, não uma nova versão histórica. Preserve os IDs ao citar evidências. Abra Leia-me para o roteiro e Exercicios para as atividades. As células amarelas em Cenarios são hipóteses, não resultados observados.

A base contém dezembro/2025 completo para análise retrospectiva didática. Na simulação de decisão em 15/12/2025, use meses encerrados até novembro/2025. A sensibilidade da planilha usa janeiro a novembro/2025.
''',encoding='utf-8')
(B/'resources/dados/politicas-e-eventos.md').write_text('''# Documentos sintéticos | não são fatos reais

## POL-01 | Política de análise | versão 1 | 15/12/2025
Toda recomendação deve citar arquivo, IDs de linhas ou documento, período, fórmula e limitações. Correlação não prova causa. Metas sugeridas são propostas, não resultados observados.

## LOG-01 | Nota operacional fictícia | 01/09/2025
O cenário introduz uma pressão adicional de atrasos no E-commerce do Sudeste a partir de setembro de 2025. A base não identifica transportadoras nem causas individuais. A nota contextualiza o exercício; não comprova causalidade.

## CON-01 | Mandato do conselho simulado | 15/12/2025
Avaliar alocação hipotética de R$ 1,2 milhão em logística, aquisição e expansão B2B para Q1/2026. É permitido manter reserva. A soma das alocações e da reserva deve ser exatamente o orçamento. Não há fluxo de caixa que assegure disponibilidade real desse valor.

## PES-01 | Nota de pessoas | 15/12/2025
Só há métricas agregadas mensais. Não inferir desempenho, saúde ou conduta de indivíduos. Investigar hipóteses de capacidade sem atribuir culpa a empregados.
''',encoding='utf-8')

print("Base sintética NC-2026.1 recriada; slides e prompts preservados.")
