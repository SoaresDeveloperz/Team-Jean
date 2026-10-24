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

## 2026-10-24 — Por onde sai o e-mail de "Esqueci minha senha"
- **Pergunta:** o e-mail padrão do Supabase só entrega para a equipe do projeto (2 por hora), então nenhum aluno recebe o link. Qual SMTP usar? E o link do e-mail é seguro?
- **Opções:** 1) Gmail pessoal do dono com senha de app; 2) Brevo grátis sem domínio; 3) domínio próprio + Resend; 4) sem SMTP, só a senha provisória do treinador; 5) um Gmail só do app com senha de app (trazida pelo conselheiro); 6) botão de WhatsApp com mensagem pronta para o treinador (trazida pelo advogado do diabo).
- **Conselheiro (Opus, certeza média-alta):** opção 5 agora: grátis, uns 20 minutos, cerca de 500 e-mails por dia e boa entrega. Domínio (cerca de R$ 40 por ano) + Resend quando houver outros e-mails. O Brevo sem domínio troca o remetente @gmail por um endereço dele e tende a cair no spam. A página de senha de app só aparece com a verificação em duas etapas ligada.
- **Voz do usuário:** a mensagem de erro não pode culpar o aluno nem sugerir que o treinador vai saber a senha dele: "Não conseguimos enviar o e-mail agora. Peça ajuda ao seu treinador para entrar." No e-mail, botão grande e o mesmo verbo no assunto e no botão: "Criar nova senha".
- **Advogado do diabo:**
  1. Com SMTP de verdade, o cadastro público deixaria um estranho criar conta e ver a Comunidade. Corrigido: o README manda desligar *Allow new users to sign up* antes.
  2. Antivírus de e-mail podem abrir o link antes do aluno e gastar o código. Ver o especialista.
  3. O limite por hora aparecia como "Aguarde um minuto". Corrigido.
  4. Sem CAPTCHA, alguém pode esgotar o limite de e-mails. Corrigido em parte: o README pede Rate Limits baixos; o CAPTCHA fica para depois.
  5. A conta Gmail vira ponto único e guarda cópia dos links. O modelo do e-mail foi para o repositório; falta testar em Gmail, Outlook e iCloud antes de avisar os alunos.
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
