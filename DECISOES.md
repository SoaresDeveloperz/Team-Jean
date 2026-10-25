# Registro de decisões

Cada decisão importante entra aqui, com a mais nova no topo. Antes de decidir algo, leia esta lista.

Modelo:

```
## AAAA-MM-DD — título curto da decisão
- **Pergunta:** o que estava em jogo.
- **Opções:** A, B, C.
- **Conselheiro:** resumo da opinião e do quanto tinha certeza.
- **Voz do usuário:** resumo (se foi consultada).
- **Advogado do diabo:** os riscos que apontou e o que foi corrigido.
- **Decisão:** o que ficou decidido e quem decidiu.
- **Por quê:** a razão principal.
- **Rever quando:** o que faria mudar de ideia.
```

As decisões de 2026-10-21 são registros retroativos: foram tomadas antes de os agentes existirem, então nenhum agente foi consultado.

## 2026-10-25 — GIFs de exercícios (biblioteca da Gym visual)
- **Pergunta:** mostrar GIFs do movimento no treino e na biblioteca do treinador usando o dataset público [hasaneyldrm/exercises-dataset](https://github.com/hasaneyldrm/exercises-dataset) (1.324 exercícios, GIFs 180 × 180).
- **Licença:** o README e o LICENSE do repositório dizem que a mídia é © Gym visual, usada com permissão, e que quem reusa precisa da própria licença ([termos](https://gymvisual.com/content/3-terms-and-conditions-of-use)) e manter o crédito "© Gym visual — https://gymvisual.com/".
- **Opções:** A) GIFs desligados por padrão, ligados só com `NEXT_PUBLIC_EXERCISE_MEDIA_BASE_URL` depois de confirmar a licença; B) ligados por padrão pela CDN do repositório (jsDelivr); C) copiar os GIFs para um armazenamento próprio.
- **Conselheiro, voz do usuário e advogado do diabo:** não consultados nesta implementação (o plano veio aprovado pelo dono).
- **Decisão:** o plano começou com A; o dono confirmou que é a biblioteca gratuita da Gym visual e escolheu B. A variável continua valendo e tem prioridade (endereço próprio) e `off` desliga tudo. O crédito "© Gym visual", com link e letra de pelo menos 12 px, fica sempre junto de cada GIF. O banco guarda só o nome do arquivo (`exercises.media_id`, com restrição de formato), nunca um endereço.
- **O que muda ao ligar:** o app passa a depender de hospedagem externa (CDN jsDelivr servindo `@main` do repositório de outra pessoa). Se o repositório mudar, sair do ar ou trocar arquivos, os GIFs somem ou mudam sem aviso (o app só esconde o GIF que não carrega). Recomendado: fixar uma versão do repositório no lugar de `@main` (um commit, ex.: `...exercises-dataset@<commit>/videos`) ou copiar a pasta `videos/` para um armazenamento próprio (ex.: bucket público do Supabase) e apontar a variável para lá, mantendo o crédito.
- **Por quê:** o treinador ganha 1.324 exercícios prontos com nome em português e o aluno vê a execução sem o treinador gravar vídeos.
- **Rever quando:** a Gym visual mudar os termos, o repositório sair do ar, ou o app precisar dos GIFs sem internet (aí, armazenamento próprio).

## 2026-10-24 — Quanto a IA pode ver do Supabase (MCP)
- **Pergunta:** até onde o Claude Code pode olhar o banco do app pelo MCP oficial do Supabase.
- **Opções:** A) produção, só leitura, com SQL (o comando que o painel do Supabase sugeriu); B) produção, só leitura e sem SQL (docs, development e debugging: estrutura, logs e alertas de segurança); C) um projeto Supabase de teste, com dados inventados.
- **Revisor:** com A, a IA consegue ler anamnese, medidas, nomes e e-mails dos alunos (LGPD), e também textos escritos por alunos, onde alguém poderia esconder instruções para ela. Recomendou C, ou B se for em produção. A documentação do Supabase também desaconselha ligar o MCP em produção.
- **Conselheiro e advogado do diabo:** ainda não consultados.
- **Revisor (segunda passada):** a configuração está certa, mas os logs (grupo `debugging`) ainda podem mostrar e-mails, IPs e IDs dos alunos; fichas de saúde, medidas e fotos não aparecem.
- **Decisão:** provisória, tomada pela IA enquanto o dono não responde: B, já aplicado no `.mcp.json`. O dono decide se libera SQL (A) ou cria um projeto de teste (C).
- **Por quê:** estrutura, logs e alertas já respondem à maioria das dúvidas sem abrir fichas de saúde, medidas e fotos.
- **Rever quando:** um bug só puder ser achado olhando dados; de preferência, num projeto de teste.

## 2026-10-24 — Por onde sai o e-mail de "Esqueci minha senha"
- **Pergunta:** o e-mail padrão do Supabase só entrega para a equipe do projeto (2 por hora), então nenhum aluno recebe o link. Qual SMTP usar? E o link do e-mail é seguro?
- **Opções:** 1) Gmail pessoal do dono com senha de app; 2) Brevo grátis sem domínio; 3) domínio próprio + Resend; 4) sem SMTP, só a senha provisória do treinador; 5) um Gmail só do app com senha de app (trazida pelo conselheiro); 6) botão de WhatsApp com mensagem pronta para o treinador (trazida pelo advogado do diabo).
- **Conselheiro (Opus, certeza média-alta):** opção 5 agora: grátis, uns 20 minutos, cerca de 500 e-mails por dia e boa entrega. Domínio (cerca de R$ 40 por ano) + Resend quando houver outros e-mails. O Brevo sem domínio troca o remetente @gmail por um endereço dele e tende a cair no spam. A página de senha de app só aparece com a verificação em duas etapas ligada.
- **Voz do usuário:** a mensagem de erro não pode culpar o aluno nem sugerir que o treinador vai saber a senha dele: "Não conseguimos enviar o e-mail agora. Peça ajuda ao seu treinador para entrar." No e-mail, botão grande e o mesmo verbo no assunto e no botão: "Criar nova senha".
- **Advogado do diabo:**
  1. Com SMTP de verdade, o cadastro público deixaria um estranho criar conta e ver a Comunidade. Mitigado à mão: o README manda desligar *Allow new users to sign up* antes. Falta a correção no banco: o revisor mostrou que as políticas da Comunidade aceitam qualquer conta logada. Exigir perfil pode não bastar: o `policies.sql` cita um gatilho que cria o perfil no cadastro, e com ele o estranho também ganharia perfil. Conferir em Database → Triggers (tabela `auth.users`); se o gatilho existir, o critério tem de ser algo que só o treinador preenche. Até lá, a barreira é manter o cadastro público desligado.
  2. Antivírus de e-mail podem abrir o link antes do aluno e gastar o código. Ver o especialista.
  3. O limite por hora aparecia como "Aguarde um minuto". Corrigido.
  4. Sem CAPTCHA, alguém pode esgotar o limite de e-mails. Corrigido em parte: o README pede Rate Limits baixos; o CAPTCHA fica para depois.
  5. A conta Gmail vira ponto único e guarda cópia dos links. O modelo do e-mail foi para o repositório; falta testar em Gmail, Outlook e iCloud antes de avisar os alunos.
- **Testador:** 9 verificações novas pegam o erro com o código antigo e passaram 30 vezes seguidas. Observou que, com o SMTP falhando, o Supabase só dá erro para e-mails que têm conta, então a tela de erro pode revelar quem é aluno. Não é novo (a mensagem antiga também aparecia só nesse caso) e some com o SMTP funcionando.
- **Especialista (Opus):** para o item 2, recomenda trocar o link por um código de 6 dígitos digitado no próprio app. Isso também resolve o iPhone com o app instalado. Tamanho médio; precisa de aprovação.
- **Decisão:** aguardando o dono, que escolhe o SMTP (5, 3 ou 6) e se aprova o código de 6 dígitos. Já feito no app: mensagens de erro novas, modelo do e-mail em `supabase/email-recuperar-senha.html` e o aviso do cadastro público no README.
- **Rever quando:** dois alunos disserem que o e-mail não chegou ou caiu no spam, ou aparecer o primeiro erro de envio.

## 2026-10-21 — Senha esquecida: link por e-mail e senha provisória pelo treinador
- **Pergunta:** como o aluno volta a entrar quando esquece a senha.
- **Opções:** A) só o treinador gera uma senha nova; B) só link por e-mail; C) os dois.
- **Decisão:** C, implementado no PR #8. O link usa `/auth/confirm` (aceita `token_hash` e `code`), e o treinador gera uma senha provisória na ficha do aluno.
- **Por quê:** o e-mail depende de SMTP configurado; a senha pelo treinador funciona sempre.
- **Rever quando:** o SMTP estiver estável e o treinador não quiser mais esse trabalho.

## 2026-10-21 — Mensalidade com PIX estático
- **Pergunta:** como receber a mensalidade pelo app.
- **Opções:** A) PIX estático (copia e cola com o valor) e o treinador marca o pagamento; B) empresa de pagamentos com PIX dinâmico e baixa automática.
- **Decisão:** A, implementado no PR #8.
- **Por quê:** sem taxa por pagamento e sem cadastro em empresa de pagamentos; com poucos alunos, marcar à mão é rápido.
- **Rever quando:** houver muitos alunos ou atrasos frequentes; aí vale a baixa automática.

## 2026-10-21 — Notificações push com Web Push próprio (VAPID)
- **Pergunta:** como avisar o aluno e o treinador no celular.
- **Opções:** A) Web Push direto do servidor com chaves VAPID; B) serviço pago ou de terceiros (OneSignal, Firebase).
- **Decisão:** A, implementado no PR #8.
- **Por quê:** sem custo e sem SDK de terceiros; os avisos já existem no banco e viram push uma única vez.
- **Rever quando:** precisar de campanhas, segmentação ou estatísticas de entrega.

## 2026-10-21 — Testes com Supabase falso e Postgres de verdade no CI
- **Pergunta:** como testar sem mexer no banco de produção.
- **Opções:** A) Supabase falso que imita RLS e restrições, mais os `.sql` num Postgres real; B) um projeto Supabase só para testes.
- **Decisão:** A, implementado nos PRs #8 e #9.
- **Por quê:** roda de graça no GitHub Actions, sem chaves, e pega erro de permissão antes de chegar ao aluno.
- **Rever quando:** o Supabase falso começar a divergir do real com frequência.
