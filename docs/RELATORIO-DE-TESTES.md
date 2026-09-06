# Relatório de validação | 06/09/2026

## Resultado e escopo

**15 testes de API aprovados**, executados com pytest/FastAPI TestClient. Verificação de sintaxe Python e JavaScript aprovada. Conteúdo gerado a partir de uma fonte JSON única.

Teste de SSE com servidor Uvicorn ativo em loopback e **duas sessões HTTP independentes e simultâneas**, sem mock de eventos. Ambas receberam estado inicial, mudança de slide e snapshot atual ao reconectar. Latências observadas nesta execução: aproximadamente 491 ms e 496 ms, em rede local do ambiente de teste. Não são benchmark de internet nem prova de capacidade para uma turma.

Renderização da interface com Chromium/Playwright em memória, nas larguras **1440 px e 390 px**. Os 23 slides foram percorridos em cada resolução, sem overflow horizontal da página. Busca de prompt, download individual e proteção de atalhos em textarea foram verificados. Nenhuma exceção JavaScript não tratada nesses percursos.

## API coberta

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

## Limitação real do teste de navegador

O navegador disponível bloqueou a navegação para o endereço HTTP local com `ERR_BLOCKED_BY_ADMINISTRATOR`. Não foi feita alteração dessa política. A interface foi inspecionada por renderização em memória, e a integração SSE foi testada separadamente por clientes HTTP autorizados no ambiente.

Assim, **não é correto afirmar que o fluxo completo professor/aluno passou em um navegador conectado ao backend**, nem que foi validado em um celular físico. Essa homologação está descrita no checklist e continua pendente. A persistência de rascunho está implementada com sessionStorage, mas não foi validada ponta a ponta nesse navegador de origem opaca.

## Não executado

Deploy, push ao GitHub, pull request, teste no domínio público, QR escaneado em câmera física, Safari/iOS, teste de carga de 200 alunos, auditoria online de vulnerabilidades, varredura antimalware e restauração de backup.

## Como repetir

```bash
pip install -r requirements-dev.txt
pytest -q
node --check static/app.js
python -m compileall -q app.py scripts
```

Com um servidor de teste ativo e senha exclusiva, configure `TEST_FACILITATOR_PASSWORD` e opcionalmente `TEST_BASE_URL`, depois execute `python scripts/test_sse.py`. Esse script cria e exclui sua própria sala de teste.

Para a validação de operação real, siga `CHECKLIST-DE-HOMOLOGACAO.md`.
