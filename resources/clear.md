# CLEAR para prompts de liderança

Cinco princípios para escrever, testar e revisar. Adaptar e refletir fazem parte da conversa e da avaliação humana, não apenas do texto inicial.

## C · Conciso (Concise)

Faça um pedido direto, com foco na decisão e no contexto necessário.

Concisão preserva o que importa e elimina pedidos vagos ou redundantes. Ser breve não significa omitir fonte, objetivo ou limite.

## L · Lógico (Logical)

Organize as etapas: confira as fontes, analise os dados e recomende.

A ordem do trabalho deve ajudar a conferir o resultado. Primeiro reconheça a base, depois compare indicadores e só então proponha uma ação.

## E · Explícito (Explicit)

Defina as fontes, as restrições e o formato esperado para a resposta.

Torne verificáveis os requisitos da entrega: recorte, fórmulas, fontes e formato. Detalhes precisos reduzem a necessidade de a IA adivinhar o que você espera.

## A · Adaptável (Adaptive)

Ajuste o pedido conforme os dados disponíveis e as lacunas da conversa.

Adaptar é revisar a instrução após observar a resposta. O trecho destacado cria uma condição de ajuste; na próxima rodada, a liderança decide que informação acrescentar ou que escopo reduzir.

## R · Reflexivo (Reflective)

Confira a resposta e use as falhas para melhorar o próximo prompt.

Reflexão faz parte do ciclo de melhoria. A autoverificação solicitada à IA é um apoio; a pessoa precisa conferir a fonte, avaliar o resultado e revisar o prompt.

## Exemplo aplicado à Núcleo Casa

```text
Avalie se a Núcleo Casa cresceu com qualidade entre janeiro/2023 e novembro/2025 para orientar as prioridades de Q1/2026.

Primeiro confira os arquivos e a granularidade; depois compare receita e contribuição por canal; por fim, recomende uma prioridade com base nos achados.

Use somente nucleo-casa-mensal.csv e LEIA-ME.md anexados, com meses encerrados até novembro/2025. Entregue até três achados em tabela com período, fórmula e IDs das linhas, seguidos de uma recomendação. Não deduza lucro líquido, caixa ou LTV.

Se um arquivo não estiver acessível ou faltar um campo necessário, explique a lacuna e peça a informação antes de concluir essa parte. Prossiga no escopo verificável; na próxima rodada, ajustaremos o pedido aos dados disponíveis.

Antes de finalizar, confira os totais e denominadores, separe fatos de hipóteses e indique uma evidência que mudaria a recomendação. Apresente cálculos reproduzíveis; se não os executar, marque os números como não verificados. Eu conferirei um cálculo e usarei as falhas para revisar este prompt.
```

Referência: [Leo S. Lo · The CLEAR path (2023)](https://doi.org/10.1016/j.acalib.2023.102720). Exemplo didático próprio do workshop.
