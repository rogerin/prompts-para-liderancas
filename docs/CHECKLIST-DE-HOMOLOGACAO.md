# Homologação antes da primeira turma

## Repositório e infraestrutura

- [ ] Confirmar que o projeto desejado é `rogerin/prompts-para-liderancas` e revisar o diff numa branch.
- [ ] Preservar `keycore-logo.png` original, sem substituí-la por uma aproximação.
- [ ] Instalar dependências, executar testes e revisar avisos de segurança de dependências com a política da equipe.
- [ ] Configurar domínio real, HTTPS, senha exclusiva e origem pública correta. Nunca usar localhost no QR público.
- [ ] Configurar uma instância com um worker e disco persistente, porta 8101 e proxy sem buffering de SSE.
- [ ] Validar diretório de dados, permissões, cotas, retenção, backup e processo de recuperação. Backups têm política própria de exclusão.
- [ ] Decidir se PDFs serão aceitos sem antivírus. Para operação aberta, integrar varredura antes de liberá-los.

## Teste ponta a ponta no endereço que será usado

- [ ] Abrir o computador do professor e dois celulares reais, preferencialmente Android e iOS.
- [ ] Criar sala, escanear o QR da primeira tela e entrar com dois nomes de teste.
- [ ] Trocar slides rapidamente; confirmar que ninguém consegue controlar o professor.
- [ ] Entrar atrasado: o participante deve receber o slide atual, não o primeiro.
- [ ] Pausar o acompanhamento, explorar slides e voltar ao vivo.
- [ ] Começar a digitar no exercício, trocar o slide no professor e conferir que o texto continua no formulário.
- [ ] Usar setas e espaço no textarea e conferir que a apresentação não avança.
- [ ] Derrubar a rede de um celular, preencher um rascunho, reconectar e verificar estado e rascunho.
- [ ] Testar envio de texto, arquivo de texto, PNG, JPG e PDF, incluindo limite de tamanho e tentativa repetida.
- [ ] Enviar sem consentimento e confirmar que o outro aluno não vê texto nem arquivo.
- [ ] Autorizar, aprovar e verificar a galeria com alias. Abrir comparação de duas e três tentativas.
- [ ] Revogar autorização e confirmar que o resultado e o arquivo deixam de ser acessíveis ao colega.
- [ ] Anexar novo conteúdo a um envio publicado e confirmar que volta para revisão.
- [ ] Baixar prompts, kit, exportação pessoal e exportação privada da turma.
- [ ] Encerrar sala, testar bloqueio de entrada/envio, reabrir e excluir uma sala de teste.
- [ ] Reiniciar o processo e conferir persistência do slide, da turma e dos arquivos ainda válidos.

## Condução e privacidade

- [ ] Apresentar o acordo de dados fictícios e o prazo de retenção.
- [ ] Não projetar a revisão privada do facilitador.
- [ ] Avisar que participantes não devem anexar dados de trabalho, saúde ou clientes reais.
- [ ] Confirmar que os alunos têm uma ferramenta de IA disponível ou organizar duplas. Não exigir plano pago sem planejamento.
- [ ] Fazer uma rodada de ensaio com o facilitador; a soma de agenda é 150 minutos, mas o ritmo precisa ser testado com o público.
- [ ] Explicar o que foi calculado, simulado e apenas proposto. A plataforma não executa um modelo por conta própria.
- [ ] Incentivar download do percurso ainda na aula. A sessão dura 24h e não há recuperação por e-mail.
