# Análise do workshop e decisões de evolução

## Fonte e recorte

Repositório analisado: `rogerin/prompts-para-liderancas`, branch `main`, em 06/09/2026. README original: blob `da6c38c7650c903d4073c6cffb2daaf2cbeca16f`. HTML original: blob `e57ea9974d50fe9d4c6bf3996da5a4505f417a28`. Serviço original: blob `1767432e83473d488606526f680f4cc791b8bc3a`.

A conversa mencionava também `rogerin/workshop-fhdata`. A inspeção mostrou que o primeiro contém a apresentação de slides “Prompts para Lideranças”; o segundo é um dashboard de dados. A evolução foi preparada sobre a apresentação, não sobre o dashboard. Nenhum dos dois foi alterado remotamente.

## Diagnóstico

A proposta pedagógica já era clara: usar a empresa fictícia Núcleo Casa, investigar uma base sob cinco perspectivas C-Level, especificar um dashboard e simular uma decisão de conselho em 2h30.

A implementação original era um HTML com alternância local de slides, CSS embutido e navegação por teclado. O serviço usava `python3 -m http.server` na porta 8101. Não havia backend de sala, identidade de participante, sincronização, persistência de exercícios, upload ou moderação. A navegação era independente em cada dispositivo.

O diretório raiz continha README, HTML, serviço e logomarca. Os slides prometiam uma base de treinamento e um kit para levar, mas esses arquivos não acompanhavam o repositório inspecionado. Alguns prompts pediam métricas como LTV, caixa e recompra sem uma base efetiva para calculá-las. A demonstração visual de RAG tinha uma resposta ilustrativa com números, o que podia ser confundido com uma consulta de verdade.

## Decisões pedagógicas

**Tentativa antes da técnica.** Primeiro o participante registra o pedido espontâneo; depois aprende, revisa e compara. O aprendizado deixa uma evidência observável.

**Pergunta comum e variáveis registradas.** Na comparação antes/depois, orientar o uso da mesma base, pergunta, ferramenta e configuração quando possível. O registro do modelo evita atribuir ao prompt diferenças que vieram de outro fator. Não há inferência causal automática sobre a melhora.

**Variações com objetivos diferentes.** A biblioteca tem 33 prompts completos em 11 categorias. Não são apenas três versões mais longas da mesma instrução: há diagnóstico, sensibilidade, contraprova, planejamento, reconciliação, ata, pré-mortem e avaliação.

**Limites fazem parte do exercício.** Uma resposta boa reconhece que a fonte não permite calcular uma métrica. O kit declara de propósito o que não contém: coortes, fluxo de caixa, causas por transportadora e avaliações individuais.

**Rubrica antes da preferência.** Contexto, evidência, verificabilidade, limites e ação, cada um de 0 a 4. As notas são didáticas e justificadas; não representam certificação nem avaliação automatizada da pessoa.

**Do estudo à prática.** A última atividade pede uma rotina, uma medida de tempo/qualidade e um experimento de sete dias. “Devolver tempo” vira algo mensurável, não uma promessa de economia.

## Decisões de produto

Sala com código aleatório e QR gerado no servidor a partir da origem pública configurada. Não existe QR decorativo com destino inventado. Senha de facilitador nunca é incluída no link de entrada.

Apresentador controla o slide atual; aluno pode sair do acompanhamento e retornar ao estado atual. Entrada tardia e reconexão recebem um snapshot persistido. O servidor valida IDs de slides e a versão do conteúdo. Rascunhos são separados por sala e exercício, e o formulário não é recriado quando uma atualização de slide chega.

Tentativas são enviadas explicitamente. O backend não chama IAs em nome dos alunos. Não há custos escondidos de tokens nem chave de API em frontend. A plataforma suporta diferentes ferramentas porque compara o que o aluno de fato submeteu e recebeu.

Compartilhamento depende de dois atos: autorização do autor e aprovação do facilitador. O aluno pode revogar. O facilitador tem uma tela privada, distinta da galeria para projeção. Os aliases reduzem exposição de nomes, mas não tornam seguros textos em que o próprio autor inseriu informação pessoal; a moderação continua necessária.

Exportações públicas incluem apenas o conteúdo didático. A exportação pessoal contém apenas as tentativas da própria sessão. A exportação da turma é privada e acessível ao facilitador. Anexos são baixados separadamente.

## Decisões técnicas

FastAPI e SQLite foram escolhidos para adicionar um backend pequeno ao projeto estático e continuar podendo usar a porta e o serviço existentes. Isso não prova que essa seja a infraestrutura final da KeyCore. O pacote mantém o serviço observado como exemplo revisável, sem instalar nada.

SSE envia estado do servidor para o navegador. Entradas de alunos e ações do professor continuam em requisições HTTP. Os eventos possuem identificador de versão, reconexão nativa e heartbeat. Em erro de SSE, o frontend consulta o estado a cada cinco segundos enquanto tenta reconectar. O objetivo é convergir ao estado atual, não reproduzir cada slide intermediário perdido durante uma desconexão.

SQLite persiste salas, membros, tentativas, avaliações e metadados de anexos. Arquivos ficam fora do diretório público. A aplicação só serve explicitamente `static/`, `resources/`, `index.html` e a logomarca, não a raiz inteira do projeto.

IDs e SQL parametrizado, cookies HttpOnly/SameSite, origem validada, header não simples em escritas, separação de privilégios, cotas e verificação de anexos cobrem controles básicos do piloto. Não equivalem a auditoria de segurança. PDFs não têm varredura antimalware. A escala, o backup, a observabilidade e a autenticação individual exigem revisão antes de um SaaS público.

## Preservado e corrigido

Preservados: nome da apresentação, propósito de 2h30, cinco funções, caso Núcleo Casa, tema do dado à decisão, orçamento hipotético do conselho, linguagem visual clara e tons verde/teal.

Corrigidos: ausência de materiais, prompts pedindo dados inexistentes sem limites, confusão entre simulação e consulta real, promessa excessiva de garantia no RAG, ausência de participação e compartilhamento automático potencialmente indevido.

## Ainda não entregue como operação de produção

Nenhuma publicação, PR ou commit remoto. Nenhuma sessão real com turma. Nenhuma integração de LLM, chat RAG implementado, reconhecimento de alunos por e-mail, autenticação multi-organização, infraestrutura distribuída, antivírus ou capacidade de 200 usuários certificada.

O código implementa o piloto solicitado e permite revisão. A decisão de hospedagem, domínio, aprovação de segurança e teste ponta a ponta continuam como passos de implantação.

## Referências técnicas consultadas

- FastAPI, documentação de arquivos e respostas customizadas: `https://fastapi.tiangolo.com/tutorial/request-files/` e `https://fastapi.tiangolo.com/advanced/custom-response/`.
- Starlette, StreamingResponse e FileResponse: `https://starlette.dev/responses/`.
- MDN, uso e reconexão de Server-Sent Events: `https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events`.

O upload desta implementação usa corpo binário limitado por requisição, sem multipart, para reduzir dependências. As referências de arquivos ajudaram a distinguir envio de texto, upload e entrega segura de anexos; não descrevem uma integração de IA pronta.
