# Núcleo Casa | conjunto sintético NC-2026.1

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
