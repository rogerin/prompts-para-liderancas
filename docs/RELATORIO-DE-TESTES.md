# Relatório de validação

## Revisão para projeção

Foram verificadas **172 combinações de slide, resolução e estado** no Chromium/Playwright. Os 24 slides passaram em 1280×720, 1024×768 e 1920×1080 com contador ativo e inativo, sem rolagem vertical ou horizontal da página e com texto principal de pelo menos 20 px. Os 24 slides também passaram em 390×844 sem overflow horizontal. As quatro verificações adicionais cobriram a abertura de uma sala com QR code, com e sem contador, em 1280×720 e 1024×768.

As capturas da abertura, do CLEAR, da rubrica, dos exercícios e dos modais foram revisadas. A revisão encurtou títulos e resumos mais densos, aumentou fontes e contraste, compactou referências de apoio em telas baixas e reorganizou o QR code para preservar o enquadramento. Os 40 testes automatizados continuaram aprovados. Não foi usado um projetor físico nesta verificação.

## Atualização: cards, CLEAR e contadores

**40 testes automatizados aprovados:** 29 testes pytest de API/conteúdo e 11 testes JavaScript. As verificações incluem autorização dos controles de sala, atualização concorrente, migração do banco existente, persistência dos modais e contador, entrada tardia, pausa/retomada/reinício, relógio do dispositivo diferente do servidor e alarme único por contagem. O conteúdo contém 24 slides e 71 cards com resumo, explicação, exemplo e pergunta.

O teste `scripts/test_sse.py` passou com dois clientes HTTP independentes conectados ao Uvicorn local. Foram conferidos estado inicial, mudança de slide, abertura/fechamento de card, destaque CLEAR, início/pausa/retomada/remoção de contador, reconexão com o prazo persistido e QR autenticado. As entregas observadas ficaram entre aproximadamente 352 e 808 ms nesta execução local.

A integração também foi verificada em **dois contextos Chromium independentes conectados ao backend**, com login de facilitador e entrada de participante pela interface. Os três cards iniciais e as cinco letras CLEAR sincronizaram; exploração livre, retorno ao vivo e recarregamento restauraram o estado correto. Um formulário de atividade aberto conservou seu rascunho durante a exibição remota de um detalhe.

O contador iniciou, pausou e retomou nos dois navegadores. O encerramento foi acelerado pelo relógio de teste do Playwright: ambos exibiram o término e executaram uma sequência de seis pulsos Web Audio, com o botão de reinício habilitado. Esse teste verifica o disparo de áudio; o volume e a saída física do dispositivo não foram avaliados.

Capturas revisadas em **1440 × 900** e **390 × 844**, incluindo slide CLEAR, modal com destaque e contador. Não houve overflow horizontal na página móvel verificada. As imagens ficam em `output/playwright/`, fora do controle de versão. O navegador registrou o 404 do favicon existente e um conflito de versão recuperado automaticamente após a entrada do participante.

Comandos reproduzíveis: `.venv/bin/pytest -q`, `node --test tests/*.test.mjs` e `python scripts/test_sse.py` com as variáveis do servidor de teste. Sintaxe JavaScript e `git diff --check` também passaram. Os materiais derivados e o ZIP foram reconstruídos.

Esta rodada não inclui deploy, navegador Safari/iOS, celular físico, câmera de QR ou teste de carga. Os limites de acesso ao navegador descritos abaixo pertencem à rodada histórica; a integração local conectada foi executada nesta atualização.

## Registro histórico | 06/09/2026

### Resultado e escopo

**15 testes de API aprovados**, executados com pytest/FastAPI TestClient. Verificação de sintaxe Python e JavaScript aprovada. Conteúdo gerado a partir de uma fonte JSON única.

Teste de SSE com servidor Uvicorn ativo em loopback e **duas sessões HTTP independentes e simultâneas**, sem mock de eventos. Ambas receberam estado inicial, mudança de slide e snapshot atual ao reconectar. Latências observadas nesta execução: aproximadamente 491 ms e 496 ms, em rede local do ambiente de teste. Não são benchmark de internet nem prova de capacidade para uma turma.

Renderização da interface com Chromium/Playwright em memória, nas larguras **1440 px e 390 px**. Os 23 slides foram percorridos em cada resolução, sem overflow horizontal da página. Busca de prompt, download individual e proteção de atalhos em textarea foram verificados. Nenhuma exceção JavaScript não tratada nesses percursos.

### API coberta

| Caso | Resultado |
| --- | --- |
| Inicialização sem senha adequada | Bloqueada |
| Escrita sem header esperado ou com origem externa | Bloqueada |
| Cookie seguro no modo HTTPS | HttpOnly, Secure e SameSite=strict |
| Alteração de slide por participante | Bloqueada |
| Escrita concorrente com versão antiga | HTTP 409 |
| Entrada tardia | Recebe slide atual |
| Tentativa privada / autorização / aprovação / revogação | Estados e visibilidade corretos |
| Acesso a outra sala sem participação | Bloqueado |
| Repetição de envio com mesmo client_id | Sem duplicidade |
| Nova tentativa explícita | Incrementa número da tentativa |
| Anexo privado, publicado e alterado após publicação | Acesso e nova moderação corretos |
| Nome de arquivo com caminho | Caminho removido do nome de exibição |
| Tipo inválido, assinatura inválida, arquivo grande ou quarto anexo | Bloqueados |
| Notas fora da rubrica | Bloqueadas |
| Encerramento, exclusão e expiração de sala | Leitura/bloqueio/remoção conforme regra |
| Acesso à raiz do banco de dados por HTTP | Não exposto |
| QR code | PNG autenticado e conteúdo decodificado por detector local de QR, sem teste em câmera física |
| Exportação da turma por participante | Bloqueada |
| Conteúdo e dados fictícios | IDs, fórmulas, totais e vínculos reconciliados |

Alguns testes verificam mais de uma regra; a tabela não significa uma contagem maior de funções pytest.

### Limitação do teste de navegador dessa rodada

O navegador disponível bloqueou a navegação para o endereço HTTP local com `ERR_BLOCKED_BY_ADMINISTRATOR`. Não foi feita alteração dessa política. A interface foi inspecionada por renderização em memória, e a integração SSE foi testada separadamente por clientes HTTP autorizados no ambiente.

Assim, **não é correto afirmar que o fluxo completo professor/aluno passou em um navegador conectado ao backend**, nem que foi validado em um celular físico. Essa homologação está descrita no checklist e continua pendente. A persistência de rascunho está implementada com sessionStorage, mas não foi validada ponta a ponta nesse navegador de origem opaca.

### Não executado nessa rodada

Deploy, push ao GitHub, pull request, teste no domínio público, QR escaneado em câmera física, Safari/iOS, teste de carga de 200 alunos, auditoria online de vulnerabilidades, varredura antimalware e restauração de backup.

### Como repetir

```bash
pip install -r requirements-dev.txt
pytest -q
node --check static/app.js
python -m compileall -q app.py scripts
```

Com um servidor de teste ativo e senha exclusiva, configure `TEST_FACILITATOR_PASSWORD` e opcionalmente `TEST_BASE_URL`, depois execute `python scripts/test_sse.py`. Esse script cria e exclui sua própria sala de teste.

Para a validação de operação real, siga `CHECKLIST-DE-HOMOLOGACAO.md`.
