# Prompts para Lideranças

**KeyCore Academy · Do dado à decisão**

Workshop interativo de **2h30** para lideranças que querem usar IA para analisar dados, formular boas perguntas e tomar decisões com evidências. A plataforma reúne apresentação, sala ao vivo, exercícios, materiais de estudo e comparação moderada dos resultados produzidos pelos participantes.

A aprendizagem parte da **Núcleo Casa**, um varejo omnicanal inteiramente fictício. A turma investiga o mesmo negócio pelas perspectivas de CEO, CFO, COO, CMO e CHRO, melhora seus prompts e encerra com uma simulação de conselho.

**23 slides · 33 prompts · 7 atividades em aula · 12 desafios adicionais na planilha · 5 perspectivas de liderança**

Quer realizar este workshop na sua empresa? [Converse com a KeyCore](https://keycore.com.br/agendar-um-cafe).

## Objetivo e público

O objetivo é transformar pedidos genéricos à IA em instruções que produzam respostas úteis, rastreáveis e verificáveis. O participante pratica:

- Definir contexto, objetivo, fontes, restrições e formato de entrega.
- Identificar perguntas que a base permite responder e dados que ainda faltam.
- Conferir fórmulas, denominadores, recortes e evidências citadas pela IA.
- Comparar recomendações de diferentes áreas, distinguindo hipótese de fato.
- Revisar o próprio prompt a partir dos resultados obtidos.
- Desenhar um experimento de sete dias para aplicar o aprendizado à rotina.

O conteúdo é voltado a gestores, executivos, coordenadores e equipes de negócios. Não exige programação. Os participantes precisam de um navegador e acesso à ferramenta de IA que pretendem usar; também podem trabalhar em duplas.

## Como funciona

1. O facilitador inicia o servidor, acessa o painel e cria uma sala.
2. A turma entra pelo QR code ou link, informa nome ou pseudônimo e escolhe uma cadeira de liderança.
3. Os slides acompanham a navegação do facilitador. Cada participante pode explorar livremente e voltar ao acompanhamento ao vivo.
4. O participante baixa os dados, escreve um prompt e o executa na ferramenta de IA de sua escolha.
5. De volta à plataforma, registra prompt, modelo, configurações, resultado, anexos e reflexão.
6. O facilitador revisa os envios. Os autorizados pelo autor e aprovados pelo facilitador podem aparecer na galeria da turma.
7. O grupo compara resultados, discute decisões e leva os materiais e seus próprios registros.

**A aplicação não executa prompts, não chama APIs de IA e não consome créditos de modelos.** O uso de IA acontece fora da plataforma, na conta e ferramenta escolhidas pelo participante. A rubrica é preenchida pelo facilitador; não há avaliação automática por IA.

## Funcionalidades

| Recurso | Detalhes |
| --- | --- |
| Apresentação interativa | 23 slides responsivos, indicador de progresso, roteiro, tela cheia e navegação por teclado. Atalhos não interferem nos formulários. |
| Biblioteca de prompts | 33 exemplos completos, com busca, categorias, indicação de uso e fontes necessárias. Permite copiar, baixar e usar o prompt em uma atividade. |
| Salas com QR code | Criação e retomada de turmas, link de entrada, código de sala e contagem de participantes inscritos. |
| Acompanhamento ao vivo | Atualização de slides por Server-Sent Events, reconexão e consulta periódica de estado quando a conexão falha. |
| Exploração individual | O participante pausa o acompanhamento, navega no conteúdo e retorna ao slide atual do facilitador. |
| Tentativas e rascunhos | Registros de modelo, prompt, resultado, configurações e reflexão. Rascunhos de texto são guardados por sala e exercício na aba do navegador e podem ser baixados. |
| Anexos | Até três arquivos por tentativa. Acesso depende das permissões do envio; anexos não entram no material público nem no rascunho. |
| Revisão privada | Consulta de envios, notas, feedback e aprovação da exibição dos resultados autorizados. |
| Pendências de revisão | A galeria do facilitador informa quantos envios aguardam aprovação, estão compartilhados ou não têm autorização. Os números são da sala inteira. |
| Galeria da turma | Resultados autorizados e aprovados, identificados por alias, com atualização automática e filtro por atividade. |
| Comparação | Até três tentativas lado a lado, com prompt, resultado, modelo, reflexão e feedback disponível. |
| Rubrica | Contexto, evidência, verificabilidade, limites e ação: cinco dimensões de 0 a 4, total de até 20 pontos, sem ranking automático. |
| Planilha de exercícios | XLSX com dados, indicadores, comparativos, cenários editáveis, dicionário, fontes e 19 propostas de exercício. |
| Exportações | Percurso pessoal em Markdown e exportação privada da turma em JSON. Anexos precisam ser baixados separadamente. |
| Guia do facilitador | Notas por slide e agenda para organizar o ritmo da aula. |
| Ciclo da sala | Encerrar bloqueia novas entradas e envios; reabrir retoma a participação; excluir remove os registros e anexos. |

## Como iniciar

### Requisitos

- Python 3.12 ou superior. A verificação desta atualização foi executada com Python 3.14.
- Navegador com JavaScript habilitado.
- Internet para instalar dependências e acessar a ferramenta de IA escolhida.
- Node.js apenas para testes de JavaScript ou reconstrução da planilha. Não é necessário para servir a aplicação.

### macOS e Linux

Na pasta do projeto:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python scripts/start_local.py
```

### Windows PowerShell

```powershell
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe scripts/start_local.py
```

### Primeiro acesso

Abra **http://127.0.0.1:8101**. O terminal mostra o endereço e gera uma senha temporária de facilitador se `FACILITATOR_PASSWORD` não estiver definida.

1. Clique em **Sala** e informe a senha em **Sou facilitador**.
2. Dê um nome à turma e clique em **Criar sala e QR code**.
3. Compartilhe o QR code ou link com os participantes.

Mantenha o processo aberto durante a aula. Para encerrar o servidor, pressione `Ctrl+C`. Sem uma senha fixa configurada, uma nova inicialização gera outra senha de facilitador.

Para testar como aluno no mesmo computador, use janela anônima ou outro perfil. Abas do mesmo perfil compartilham a sessão e não representam papéis independentes.

## Acesso por celulares e outros computadores

`localhost` e `127.0.0.1` só funcionam no próprio dispositivo. Para uma turma na mesma rede, configure o IP do computador que executa o servidor:

```bash
export PUBLIC_BASE_URL="http://192.168.1.100:8101"
export BIND_HOST="0.0.0.0"
python scripts/start_local.py
```

Substitua `192.168.1.100` pelo IP real. No PowerShell:

```powershell
$env:PUBLIC_BASE_URL = "http://192.168.1.100:8101"
$env:BIND_HOST = "0.0.0.0"
.\.venv\Scripts\python.exe scripts/start_local.py
```

Abra **a mesma origem configurada** no computador e nos celulares. A rede e o firewall precisam permitir acesso à porta. Redes de visitantes com isolamento entre dispositivos podem impedir a conexão.

Para acesso pela internet, use domínio com HTTPS, proxy reverso e armazenamento persistente. O QR precisa apontar para essa origem pública. Publicar somente os arquivos HTML não ativa salas, envios ou sincronização.

## Configuração

| Variável | Padrão | Uso |
| --- | --- | --- |
| `FACILITATOR_PASSWORD` | Gerada pelo iniciador local quando ausente | Senha com pelo menos 16 caracteres. Ao iniciar Uvicorn diretamente, deve ser definida antes. |
| `PUBLIC_BASE_URL` | `http://127.0.0.1:8101` | Origem dos links, QR codes e validação das requisições. Somente protocolo, domínio/IP e porta, sem caminho. |
| `BIND_HOST` | `127.0.0.1` | Interface usada pelo iniciador local. Para rede local, use `0.0.0.0`. |
| `PORT` | `8101` | Porta do iniciador. Ajuste também a porta em `PUBLIC_BASE_URL`. |
| `DATA_DIR` | `var/` na raiz | Diretório privado do banco SQLite e dos anexos. |
| `RETENTION_DAYS` | `7` | Dias desde a criação da sala, entre 1 e 90. |

A aplicação lê o ambiente do processo e não carrega `.env` automaticamente. Não coloque senhas, dados de participantes ou o diretório `var/` em materiais públicos ou no controle de versão.

## Condução do workshop

### Agenda de 150 minutos

| Duração | Bloco | Entrega |
| --- | --- | --- |
| 20 min | Entrada, caso e tentativa inicial | Primeiro prompt e resposta registrados. |
| 25 min | Anatomia do prompt e auditoria | Conferência dos dados e identificação de limites. |
| 40 min | Perspectivas C-Level e revisão | Recomendação por cadeira e melhoria do prompt. |
| 25 min | Fontes, dashboard e comparação | Indicadores com fórmulas e evidências. |
| 30 min | Conselho e decisão | Orçamento hipotético, reserva e critérios de revisão. |
| 10 min | Aplicação e materiais | Plano de sete dias e download do kit. |

As sete atividades são **Tentativa inicial**, **A evidência vem antes da opinião**, **Assuma uma cadeira do conselho**, **Reescreva e compare**, **Uma tela que ajuda a decidir**, **Decisão coletiva com limites** e **Sete dias para devolver tempo**. Os 12 desafios adicionais da planilha servem para aprofundamento, sem alterar a agenda da aplicação.

### Como mostrar os resultados da turma

**Autorização do participante e aprovação do facilitador são etapas diferentes.** Um envio autorizado ainda não aparece automaticamente em “Resultados para aprender em conjunto”.

1. Abra **Sala → Revisão privada**, ou use **Revisão privada** na galeria.
2. Localize o envio. Se necessário, selecione **Todas as atividades**.
3. Confira se o participante autorizou o compartilhamento.
4. Marque **Exibir na turma** e clique em **Salvar revisão**. As notas são opcionais; se preencher, informe as cinco dimensões.
5. Abra **Galeria da turma** para projetar os resultados aprovados.

A galeria do facilitador informa as pendências. Atualizações recebidas durante a edição aguardam sua conclusão, com aviso de novos resultados. Salvar a revisão atualiza a lista. Há também um botão **Atualizar**.

**Use a revisão privada em uma tela não compartilhada**, pois ela contém nomes e envios privados. Para projeção, use a galeria da turma. Revogar autorização ou adicionar um novo anexo retira a tentativa da galeria e exige nova aprovação.

## Núcleo Casa e materiais

Varejo omnicanal fictício, com e-commerce, 12 lojas e B2B. A **NC-2026.1** cobre **janeiro/2023 a dezembro/2025**.

| Indicador | Valor e definição |
| --- | --- |
| Receita bruta | **R$ 48.600.000,00**, reconciliados com o CSV. |
| Pedidos | **41.820**, sem equivalência com clientes únicos. |
| Vendas | **432 registros no total**: 36 meses × 3 canais × 4 regiões. |
| Pessoas | **36 registros**, um por mês, consolidados para a empresa. |
| Estoque | **36 registros**, um por mês, com valores ao custo e CMV reconciliado com vendas. |
| Contexto | 12 lojas e catálogo de 1.280 SKUs, sem registros individuais por loja ou SKU. |

### Downloads

- [Planilha Núcleo Casa — exemplos e exercícios](resources/dados/nucleo-casa-exercicios.xlsx).
- [Vendas em CSV](resources/dados/nucleo-casa-mensal.csv), [pessoas](resources/dados/pessoas-mensal.csv) e [estoque](resources/dados/estoque-mensal.csv).
- [Dicionário, fórmulas e limites](resources/dados/LEIA-ME.md) e [documentos sintéticos](resources/dados/politicas-e-eventos.md).
- [Kit completo](resources/kit-estudo-completo.zip).
- [33 prompts em Markdown](resources/kit-prompts.md) e [biblioteca em JSON](resources/prompts.json).
- [Canvas de prompt](resources/canvas-prompt.md) e [rubrica](resources/rubrica.md).

### Abas da planilha

São **504 registros de origem em 12 abas**, com tabelas filtráveis, cabeçalhos congelados nas bases, números e datas tipados, fórmulas e gráfico anual.

| Aba | Conteúdo |
| --- | --- |
| `Leia-me` | Contexto, roteiro de uso e cuidados de interpretação. |
| `Resumo` | Comparação anual, gráfico e conferência dos totais do slide 03. |
| `Vendas` | 432 linhas de receita, pedidos, custos, marketing, clientes atribuídos, atrasos, devoluções e NPS, com indicadores calculados. |
| `Pessoas` | 36 meses de quadro médio, movimentações, horas e folha; turnover, absenteísmo e proporção de horas extras. |
| `Estoque` | 36 meses de estoque, CMV, giro, ruptura e conferência com vendas. |
| `Mensal` | Indicadores consolidados por competência. |
| `Canais` | Comparativo anual de E-commerce, Lojas e B2B. |
| `Regioes` | Comparativo anual de Sudeste, Nordeste, Sul e Centro-Oeste. |
| `Cenarios` | Três alocações de R$ 1,2 milhão e sensibilidade da contribuição a CMV, frete e marketing. |
| `Exercicios` | Sete atividades da aula e 12 desafios, com fontes, prompts e critérios de conferência. |
| `Dicionario` | Unidades, definições, fórmulas e regras de agregação. |
| `Fontes` | Referências dos CSVs e documentos POL-01, LOG-01, CON-01 e PES-01. |

Os comparativos são visões dos mesmos registros, não novas operações. Taxas usam os totais do recorte; filtros visuais em `Vendas` não alteram os recortes fixos dos comparativos. Células amarelas em `Cenarios` são premissas editáveis.

### Limites dos dados

Não há IDs ou coortes de clientes, recompra, fluxo de caixa, custos fixos completos, dados individuais de pessoas ou detalhamento por transportadora. A base não permite calcular LTV, recompra, caixa disponível, lucro líquido completo ou produtividade individual.

Antes de cruzar pessoas e estoque com vendas, consolide as 12 linhas de vendas de cada mês para não multiplicar folha e estoque.

O conselho é simulado em **15/12/2025**, mas a base contém dezembro completo para análise didática retrospectiva. Para decidir com informação disponível naquela data, use meses encerrados até novembro/2025; a sensibilidade da planilha adota esse corte. O orçamento de R$ 1,2 milhão é hipotético, não saldo de caixa observado.

## Arquitetura e estrutura

O navegador usa HTML, CSS e JavaScript sem framework. **FastAPI** atende a API e os arquivos públicos, **SQLite** guarda salas e envios em disco, e **Server-Sent Events** transmite mudanças da sala. O servidor roda com **Uvicorn**, em um único worker.

```text
app.py                         API, autenticação, salas, revisão, anexos e eventos
index.html                     Estrutura da interface
content.json                   Fonte de slides, prompts, atividades e rubrica
keycore-logo.png               Identidade visual
static/                        JavaScript, CSS e conteúdo gerado
resources/                     Materiais públicos e kit ZIP
resources/dados/               XLSX, CSVs, dicionário e documentos sintéticos
scripts/start_local.py         Iniciador local
scripts/build_materials.py     Atualização dos materiais derivados e do ZIP
scripts/build_workbook.mjs     Construção e validação da planilha
scripts/generate_dataset.py   Geração determinística dos dados fictícios
scripts/test_sse.py            Verificação das conexões de eventos
tests/                        Testes de API, dados e galeria
docs/                         Facilitação e homologação
deploy/                       Exemplo de proxy Nginx
requirements.txt              Dependências para executar
requirements-dev.txt          Dependências de desenvolvimento
var/                          Dados privados locais; não distribuir
```

## Atualizar conteúdo e materiais

Edite `content.json` e execute:

```bash
python scripts/build_materials.py
```

O comando atualiza `static/content.js`, `resources/prompts.json`, `resources/kit-prompts.md` e o ZIP. Não altera os CSVs nem reconstrói o XLSX. Mantenha os IDs estáveis. Alterar `content.json` muda a assinatura da apresentação: crie uma nova sala e não altere o conteúdo durante uma turma ativa.

Para recriar os dados sintéticos com a semente fixa da NC-2026.1:

```bash
python scripts/generate_dataset.py
```

Esse comando sobrescreve os CSVs, o resumo e os documentos sintéticos. Execute quando quiser regenerar a base. Depois, reconstrua a planilha e o kit para manter os arquivos consistentes.

### Reconstruir a planilha

O XLSX pronto já está em `resources/dados/`. Não é preciso instalar ferramentas de autoria para realizar o workshop.

O gerador usa **`@oai/artifact-tool`**, disponível no runtime de artefatos do Codex. Procura as dependências no cache desse runtime ou no diretório indicado por `ARTIFACT_TOOL_NODE_MODULES`:

```bash
node scripts/build_workbook.mjs
python scripts/build_materials.py
```

Em outro ambiente com a dependência já disponível:

```bash
ARTIFACT_TOOL_NODE_MODULES="/caminho/do/runtime/node_modules" node scripts/build_workbook.mjs
```

O gerador confere totais, IDs, relações monetárias, CMV mensal e sensibilidade das fórmulas. Prévias de conferência ficam em diretório temporário; apenas o XLSX final entra nos materiais.

## Dados dos participantes e operação

Anexos aceitos: **TXT, MD, CSV, JSON, PNG, JPG/JPEG e PDF**, até **3 por tentativa**, **5 MiB por arquivo**, **100 MiB por sala** e **1 GiB na instância**. O XLSX do material é para download e análise; o formulário de envio não aceita XLSX.

Textos precisam ser UTF-8, JSON é validado e imagens são regravadas sem metadados. PDFs recebem verificação inicial de assinatura, sem antivírus. Os arquivos são entregues para download, sem execução ou incorporação nos slides.

Sessões duram 24 horas. Salas têm retenção de sete dias desde a criação por padrão. A limpeza ocorre em até 60 segundos depois da expiração enquanto o processo está ativo, ou na próxima inicialização. Rascunhos usam `sessionStorage`, não são backup e podem ser perdidos ao fechar a aba.

Os dados dos participantes ficam separados dos materiais públicos. Revogar autorização altera o acesso pela galeria, mas não desfaz cópias já baixadas. Exporte textos e baixe anexos antes da exclusão ou expiração. Use dados fictícios nos exercícios.

### Hospedagem e limites

Esta versão usa uma instância, um único worker e disco persistente. Todos os logins de facilitador acessam as salas dessa instância; não há contas administrativas individuais ou isolamento por empresa.

O limite funcional é de 200 inscritos por sala e 100 tentativas por participante, sem equivaler a capacidade comprovada por teste de carga. A galeria retorna os 500 envios mais recentes por consulta; filtre por atividade. A exportação privada inclui todos os registros existentes, sem os bytes dos anexos.

Há um [exemplo parcial de Nginx](deploy/nginx.example.conf), com buffering desativado para SSE, e um [serviço systemd](conselho-em-simulacao.service). Ajuste domínio, certificados, usuário, diretórios e variáveis antes de usá-los. O serviço contém caminhos específicos e não é instalado pelo iniciador local.

## Testes e verificação

```bash
python -m pip install -r requirements-dev.txt
python -m pytest -q
node --check static/app.js
node --test tests/gallery.test.mjs
```

Os testes verificam papéis, isolamento de salas, consentimento, aprovação, revogação, anexos, rubrica, expiração, consistência do conteúdo e reconciliação da base. Os testes de JavaScript cobrem pendências, retomada da atualização após edição e prevenção de reabertura de um painel fechado por uma resposta atrasada.

Para testar SSE contra uma instância de teste já iniciada:

```bash
export TEST_BASE_URL="http://127.0.0.1:8101"
export TEST_FACILITATOR_PASSWORD="$FACILITATOR_PASSWORD"
python scripts/test_sse.py
```

Use a senha configurada nessa instância de teste. O script cria uma sala temporária, conecta dois clientes, verifica mudança de slide, reconexão e QR code, e remove a sala ao concluir.

Antes da aula, teste o QR em um celular real, um envio, sua aprovação e o recebimento ao vivo na rede da turma. Consulte o [guia do facilitador](docs/GUIA-DO-FACILITADOR.md) e o [checklist de homologação](docs/CHECKLIST-DE-HOMOLOGACAO.md).

## Problemas comuns

| Sintoma | O que conferir |
| --- | --- |
| Galeria vazia após envios | Abra **Revisão privada**, confira autorização, marque **Exibir na turma** e salve. Verifique o filtro de atividade. |
| Aviso de novos resultados sem mudança na lista | Conclua e salve a revisão em edição. A atualização automática preserva os campos enquanto você trabalha. |
| Celular não abre o QR | Confira IP real em `PUBLIC_BASE_URL`, rede, firewall e isolamento entre dispositivos. |
| “Prévia estática” ou “Modo de estudo” | Inicie o backend e use seu endereço HTTP. Abrir o HTML diretamente não conecta uma turma. |
| Senha recusada ou servidor não inicia | Use a senha da execução atual ou configure `FACILITATOR_PASSWORD` com pelo menos 16 caracteres. |
| Acesso recusado após trocar endereço | Use a origem exata de `PUBLIC_BASE_URL`, incluindo protocolo e porta. |
| Sala incompatível após editar conteúdo | Reconstrua os materiais, reinicie o servidor e crie uma nova sala. |
| Aluno aparece como facilitador | Use janela anônima ou outro perfil de navegador. |
| Sincronização para atrás de um proxy | Confira SSE, buffering desativado e tempo de conexão. |

## Leve o workshop para sua empresa

Quer trabalhar prompts, análise de dados e decisões com sua equipe de liderança? Entre em contato com a **KeyCore** para conversar sobre a realização do **Prompts para Lideranças** na sua empresa.

Informe o perfil do público, o número estimado de participantes, a cidade ou formato desejado e os objetivos da capacitação. Esses detalhes ajudam a discutir o conteúdo e a organização da turma.

- **Site:** [keycore.com.br](https://keycore.com.br/).
- **Contato comercial:** [Agendar um Café com a KeyCore](https://keycore.com.br/agendar-um-cafe).
- **Telefone:** [+55 (81) 98364-3267](tel:+5581983643267).

Canais conferidos no [site oficial da KeyCore](https://keycore.com.br/) em 06/09/2026.
