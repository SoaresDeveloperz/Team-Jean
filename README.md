# Team Jean — Consultoria Esportiva

App de treino (PWA) em Next.js 16 + Supabase. O treinador (admin) cadastra
alunos, monta treinos e acompanha as cargas; o aluno executa o treino pelo
celular, registra séries e acompanha a evolução.

## Rodando localmente

```bash
pnpm install
cp .env.example .env.local   # preencha com as chaves do seu projeto Supabase
pnpm dev
```

Abra http://localhost:3000.

## Variáveis de ambiente

| Variável | Onde é usada |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | navegador e servidor |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | navegador e servidor (chave pública) |
| `SUPABASE_SERVICE_ROLE_KEY` | **somente servidor**: cadastro de alunos, senha nova pelo treinador, envio de push e cron |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | **somente servidor**: notificações push (veja abaixo) |
| `VAPID_SUBJECT` | contato do app para os serviços de push (`mailto:...`) |
| `CRON_SECRET` | protege o cron diário `/api/cron/billing` |
| `NEXT_PUBLIC_EXERCISE_MEDIA_BASE_URL` | opcional, navegador: de onde vêm os GIFs dos exercícios (vazio = CDN do dataset; `off` desliga). Veja "Biblioteca de exercícios com GIFs" |

Em produção, cadastre todas em **Vercel → Settings → Environment Variables**.
O `.env.local` não deve ser commitado.

## Segurança do banco

Todo o controle de acesso aos dados depende do RLS do Supabase. Revise e rode
[`supabase/policies.sql`](supabase/policies.sql) no SQL Editor do projeto.

As funções do banco têm `search_path` fixo e as de gatilho não podem ser
chamadas pela API (só `is_admin`, `challenge_standings` e `community_members`
ficam liberadas, e só para quem está logado). Se o seu banco é de antes dessa
mudança, rode de novo os arquivos `supabase/*.sql` que você já usa para aplicar
as permissões novas.

## Comunidade

A aba **Equipe** (feed com fotos, fogo, comentários e ranking da semana) usa
tabelas e um bucket próprios. Depois do `policies.sql`, rode
[`supabase/community.sql`](supabase/community.sql) no SQL Editor. Ele pode ser
rodado mais de uma vez. Enquanto não for rodado, o app mostra como ativar.

- Fotos ficam no bucket privado `community` (até 4 por post, reduzidas no
  celular para no máximo 1600 px) e aparecem por links temporários.
- O treinador fixa e apaga qualquer post ou comentário; cada aluno apaga só o
  que é dele.
- O ranking mostra apenas nome, foto de perfil e quantidade de treinos da semana.

## Perfil e medidas

O **Perfil** do aluno tem foto e capa (com recorte: arrastar, pinça e zoom),
bio, objetivo, Instagram e o registro de medidas (peso, % de gordura, cintura e
fotos de evolução com comparação antes e depois). Depois do `policies.sql`, rode
[`supabase/profile.sql`](supabase/profile.sql) no SQL Editor. Ele pode ser rodado
mais de uma vez, antes ou depois do `community.sql`. Enquanto não for rodado, o
app avisa que o recurso ainda não foi ativado.

- Foto e capa ficam no bucket público `avatars` (quem tem o link vê); cada pessoa
  só envia na própria pasta. O recorte e a redução acontecem no celular (foto
  512 × 512, capa 1500 × 500).
- Fotos de evolução ficam no bucket privado `progress`: só o aluno e o treinador
  veem, por links temporários.
- O treinador vê e registra as medidas na ficha do aluno e troca a própria foto
  no painel.

## Ferramentas do treinador

Depois do `policies.sql`, rode [`supabase/coach.sql`](supabase/coach.sql) no SQL
Editor. Ele pode ser rodado mais de uma vez, em qualquer ordem com os outros
arquivos. Ele ativa:

- **Desafios da equipe** (aba Equipe): meta de treinos, dias ativos ou volume
  (kg) num período. O placar sai sozinho dos treinos concluídos, no horário de
  Brasília. O treinador cria e apaga; os alunos recebem um aviso e acompanham o
  progresso.
- **Notas do treinador** na ficha do aluno (lesões, preferências, combinados).
  Só o treinador vê.

Sem SQL novo, o painel também traz:

- **Radar do treinador**: recados dos alunos (com resposta), recordes da semana
  (com "Parabenizar"), cargas prontas para subir (todas as séries no topo da
  faixa com a mesma carga; "Aplicar" já grava a carga-alvo nova no treino) e
  alerta de cansaço (RPE 9+ nos últimos 3 treinos). Cada ação avisa o aluno.
- **Ficha do aluno em abas**: resumo (com os recados e o botão "Gerar senha
  nova"), corpo 3D da semana (séries por músculo e grupos sem estímulo há 10
  dias ou mais), medidas, saúde (anamnese) e notas.
- **Atalhos**: botão flutuante para novo aluno, treino, aviso, desafio,
  exercício e mensalidade (no computador fica o menu lateral).

## Corpo 3D

O modelo de cada exercício, a prévia do editor, o construtor de treinos e a
ficha do aluno mostram um corpo 3D (three.js) com as mesmas 13 regiões do mapa
muscular: arrastar para girar, pinça ou roda para aproximar, vistas de frente,
lado e costas, e toque num músculo para focar. A malha é esculpida no próprio
aparelho (num Web Worker, uma vez por sessão), e o three.js só é baixado quando
o 3D aparece. Sem WebGL, o app mostra o mapa 2D.

## Biblioteca de exercícios com GIFs

> **Licença dos GIFs.** As animações são **© Gym visual — https://gymvisual.com/**
> e vêm do dataset público
> [hasaneyldrm/exercises-dataset](https://github.com/hasaneyldrm/exercises-dataset).
> O dono confirmou que são da biblioteca gratuita da Gym visual. O crédito
> "© Gym visual", com link, **tem de aparecer junto de cada GIF** (o componente
> `ExerciseGif` já faz isso; não remova). Confira os
> [termos de uso](https://gymvisual.com/content/3-terms-and-conditions-of-use)
> antes de mudar a forma de uso. Decisão registrada no [`DECISOES.md`](DECISOES.md).

- **Treino do aluno:** o botão de execução de cada exercício mostra o GIF do
  movimento (180 × 180) quando o exercício tem `media_id` e o treinador não
  cadastrou um vídeo próprio (o vídeo dele tem prioridade). O GIF só é baixado
  ao abrir o painel, tem botão "Pausar movimento" e, para quem pediu menos
  movimento no aparelho, só toca depois de "Ver movimento". Sem internet, o GIF
  que não carrega some junto com o botão; o treino e a fila de séries seguem
  normais.
- **Biblioteca do treinador** (`/admin/exercises`): "Buscar na biblioteca"
  procura nos 1.324 exercícios por nome (português ou inglês), grupo muscular e
  equipamento, 20 por vez, e cria o exercício já com nome em português, grupo e
  GIF. No editor, "Vincular GIF", "Trocar GIF" e "Tirar GIF". O "Catálogo base"
  também entra com os GIFs.
- **Banco:** rode [`supabase/exercicios.sql`](supabase/exercicios.sql) (coluna
  `exercises.media_id`, só o nome do arquivo, ex.: `0025-EIeI8Vf`, com restrição
  de formato). Depois, se quiser ligar os exercícios que já existem, rode
  [`supabase/exercicios-casamento.sql`](supabase/exercicios-casamento.sql):
  é **específico do banco do Team Jean**, casa 51 exercícios pelo nome, só
  preenche quem está sem GIF e pode ser rodado de novo. Antes do SQL, o app
  funciona sem GIF e a biblioteca do treinador mostra um aviso.
- **De onde vêm os GIFs:** sem `NEXT_PUBLIC_EXERCISE_MEDIA_BASE_URL`, da CDN
  jsDelivr do repositório do dataset
  (`https://cdn.jsdelivr.net/gh/hasaneyldrm/exercises-dataset@main/videos`).
  Para usar um armazenamento próprio, copie a pasta `videos/` e defina a
  variável com o endereço da pasta (http/https, sem barra no fim). `off`
  desliga os GIFs por completo. Como é `NEXT_PUBLIC_`, a mudança só vale depois
  de um novo build/deploy. O service worker não guarda os GIFs (são de outro
  domínio).
- **Dados:** [`public/exercicios/biblioteca.json`](public/exercicios/biblioteca.json)
  (índice de ~320 KB: id, arquivo do GIF, nome em português e em inglês, grupo,
  equipamento, músculo-alvo e crédito), baixado só quando o treinador abre a
  busca, e `public/exercicios/passos/<grupo>.json` (passo a passo, em inglês por
  ora). Para gerar de novo:

  ```bash
  # exercises.json do repositório do dataset (≈17 MB, não vai para o Git)
  node scripts/gerar-biblioteca-exercicios.mjs --dataset caminho/exercises.json
  # com traduções novas: --nomes saida-1.json saida-2.json ... (regrava
  # scripts/dados/exercicios-nomes-pt.json com a junção)
  ```

  O script para com erro se algum exercício ficar sem nome em português, com
  campo vazio, com nome repetido ou com grupo/equipamento sem tradução.

## Gestão: push, recados, anamnese, avaliação e financeiro

Depois do `policies.sql`, rode [`supabase/gestao.sql`](supabase/gestao.sql) no
SQL Editor (idempotente, em qualquer ordem com os outros arquivos). Sem ele, o
app continua funcionando e cada tela explica o que falta ativar.

- **Recado do treino**: ao finalizar, o aluno marca como foi (ex.: "Senti dor")
  e escreve um recado. O treinador recebe um aviso, vê na aba **Recados** do
  radar e na ficha do aluno e responde; a resposta aparece no histórico do aluno.
- **Carga-alvo**: no construtor de treinos cada série pode ter a carga em kg. O
  aluno vê a meta no campo de carga e num selo do exercício.
- **Anamnese (PAR-Q)**: ficha de saúde no Perfil do aluno (o "Hoje" lembra quem
  não respondeu). Qualquer "sim" no PAR-Q gera um alerta para o treinador, que
  vê as respostas na aba **Saúde** da ficha do aluno.
- **Avaliação física**: ao registrar medidas, "Avaliação completa" traz dobras
  cutâneas (Jackson & Pollock 3 ou 7 dobras + Siri, com o % de gordura calculado
  na hora), 13 perímetros e o IMC. O histórico mostra a composição corporal
  (massa magra e gorda) e a variação de cada perímetro.
- **Financeiro** (menu lateral no computador, painel e atalhos no celular):
  mensalidade e dia de vencimento por aluno, status do mês (pago, a vencer,
  vence hoje, atrasado), registrar e desfazer pagamento, lembrete com um toque e
  chave PIX do treinador. O aluno vê a mensalidade no Perfil e copia o **PIX
  copia e cola** já com o valor (padrão BR Code do Banco Central).

### Notificações push

1. Gere as chaves: `npx web-push generate-vapid-keys`.
2. Cadastre `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` e `VAPID_SUBJECT` na Vercel
   e faça um novo deploy.
3. Cada pessoa ativa em **Perfil → Notificações no celular** (o treinador, no
   painel). No iPhone é preciso instalar o app na Tela de Início (iOS 16.4+).

Avisos, recados, respostas, comentários e lembretes viram push assim que são
criados; o que ficar pendente sai no cron diário.

### Lembretes automáticos (cron)

O [`vercel.json`](vercel.json) agenda `/api/cron/billing` todo dia às 12h UTC
(9h em Brasília). Cadastre `CRON_SECRET` na Vercel: ela manda o segredo em cada
chamada. Com "Lembrete automático" ligado no Financeiro, o aluno recebe aviso
3 dias antes, no dia e 3 dias depois do vencimento (uma vez por dia).

### Esqueci minha senha

Na tela de login, "Esqueci minha senha" manda um link por e-mail que abre
`/redefinir-senha`. No Supabase:

0. **Antes de tudo, Authentication → Sign In / Providers**: desligue *Allow new
   users to sign up*. Os alunos são criados pelo treinador (no servidor), então
   o cadastro público não faz falta. Com um SMTP de verdade ligado, ele deixaria
   qualquer pessoa criar conta e ver a Comunidade.
1. **Authentication → URL Configuration**: em *Site URL* coloque o endereço do
   app e em *Redirect URLs* adicione `https://SEU-DOMINIO/auth/confirm`.
2. **Authentication → Emails → SMTP**: configure um SMTP próprio (Gmail com
   senha de app, Resend etc.). O envio padrão do Supabase só entrega para
   membros da equipe do projeto e tem limite baixo. Em **Rate Limits**, coloque
   `10` no limite de e-mails por hora (240 por dia, abaixo dos cerca de 500 por
   dia do Gmail; com outro provedor, divida o limite diário dele por 24).
3. Em **Emails → Templates → Reset Password**, use o assunto
   `Criar nova senha — Team Jean` e cole o modelo de
   [`supabase/email-recuperar-senha.html`](supabase/email-recuperar-senha.html).
   O link dele (`/auth/confirm?token_hash=...`) funciona mesmo abrindo o e-mail
   em outro aparelho. O e-mail diz que o link vale 1 hora: mantenha *Email OTP
   Expiration* em `3600` (Authentication → Providers → Email) ou troque o texto
   do e-mail.

Se o e-mail não chegar, o treinador usa **Gerar senha nova** na ficha do aluno
e envia a senha provisória.

Se quem esqueceu foi o próprio treinador e o e-mail não chegar, rode no **SQL
Editor** do Supabase. Troque só o texto entre as aspas (mantenha as aspas) e
escreva o e-mail em letras minúsculas:

```sql
update auth.users
set encrypted_password = extensions.crypt('SENHA-NOVA', extensions.gen_salt('bf'))
where email = 'seu@email.com'
returning email;
```

Se a resposta mostrar o seu e-mail, a senha foi trocada; se vier vazia, o e-mail
não confere. Depois apague a consulta do SQL Editor, porque a senha digitada
fica guardada no histórico dele.

### Treino sem internet

Na execução do treino, cada série marcada fica numa fila no aparelho e sobe
para o Supabase em ordem; sem conexão, o treino continua normalmente (inclusive
finalizar com recado) e tudo é enviado sozinho quando a internet volta. O
treino aberto fica guardado no aparelho e pode ser reaberto offline.

### Tenho pouco tempo (versão curta do treino)

Quando o treino de hoje passa de uns 30 minutos (estimativa de ~40 s de
execução e 90 s de descanso por série, mais 1 min por exercício), a tela Hoje e
o próprio treino mostram **"Tenho pouco tempo"**. Um painel lista o que sai
("Sai hoje: ..."), deixa o aluno marcar qualquer exercício para manter e promete
só uma estimativa ("cerca de N min"). Regra padrão: os exercícios do começo do
treino, em ordem, até uns 20 min, com 2 séries de trabalho cada; aquecimento e
série principal ficam; série já feita nunca some.

- **Só muda a tela:** a prescrição do Jean, as séries (`sets`) e os ids da fila
  do aparelho continuam intactos. A faixa "Versão curta de hoje" tem **Desfazer**
  e o estado fica no aparelho só para aquele treino e aquele dia.
- **Para o treinador:** a coluna `workout_sessions.short_mode` (sim/não, nada de
  motivo ou saúde) mostra o selo "Versão curta" no histórico do aluno e na ficha.
  Não gera aviso nem push. Rode [`supabase/treino-curto.sql`](supabase/treino-curto.sql)
  (idempotente). Antes disso o app funciona normalmente: ao finalizar, se a
  coluna não existe, o treino é salvo sem a marca (nunca fica preso na fila).
- **Contas:** `src/lib/short-workout.ts` (puras, testadas em
  `tests/contas-curto.mjs`). Telas: roteiros `curto` e `curto-a11y`.

### Trocar exercício e marca "Essencial"

Se a máquina está ocupada ou algo incomoda, o aluno toca em **Trocar** no
exercício (antes da primeira série dele) e vê até 3 opções: primeiro as
**alternativas que o Jean escolheu** ("Indicado pelo Jean"), depois sugestões
do mesmo grupo muscular, com GIF primeiro ("Sugestão do app"). A troca vale só
para hoje e neste aparelho, dá para **voltar ao original**, e a prescrição do
Jean não muda. A série é gravada no exercício que foi feito (`exercise_id`), com
o `assigned_exercise_id` da linha original; o "Anterior" e a carga-alvo do outro
exercício não aparecem, e não há "recorde" falso.

- **Dor:** o painel tem "Estou trocando por causa de dor"; isso só deixa a tag
  **Senti dor** marcada no recado final (o aviso de sempre ao treinador). Nada de
  texto livre, e o push continua genérico.
- **Essencial:** no construtor, o Jean marca o exercício como essencial. Ele
  nunca sai da versão curta (aparece travado no painel) e só troca por
  alternativa que o Jean escolheu (até 5 por exercício).
- **Para o treinador:** o histórico mostra "N trocas" (só o número,
  `workout_sessions.swaps`, sem aviso nem push).
- **Banco:** rode [`supabase/trocar-exercicio.sql`](supabase/trocar-exercicio.sql)
  (idempotente, qualquer ordem). Antes disso o construtor não mostra os campos
  novos e o aluno troca por sugestão do grupo; ao finalizar, se a coluna não
  existe, o treino é salvo sem o número de trocas.
- **Contas:** `src/lib/swap-exercise.ts` (puras, `tests/contas-trocar.mjs`).
  Telas: roteiros `trocar` e `trocar-a11y`; banco: `tests/sql/rls-trocar.sql`.

## Testes e CI

- `pnpm test:build && pnpm test:e2e`: sobe um Supabase falso
  ([`tests/mock-supabase.mjs`](tests/mock-supabase.mjs)) e o app de produção e
  roda os roteiros de ponta a ponta (Playwright) e as auditorias de
  acessibilidade (axe, WCAG 2.1 AA). Use `node tests/run.mjs e2e gestao` para
  rodar só alguns.
- `node tests/contas-novidades.mjs`: confere, sem navegador, as contas do
  aquecimento e das anilhas (`src/lib/warmup.ts`) e a mensagem de WhatsApp
  (`src/lib/whatsapp.ts`). Também roda no roteiro `novidades`.
- `node tests/contas-exercicios.mjs`: confere, sem navegador, o endereço dos
  GIFs (com e sem a variável, e com `off`), a biblioteca gerada, a busca e o
  casamento. Também roda no roteiro `exercicios`; a auditoria axe das telas dos
  GIFs é o roteiro `exercicios-a11y`. O `pnpm test:build` aponta os GIFs para o
  Supabase falso (`/__gif/`), sem internet.
- `node tests/contas-curto.mjs`: confere, sem navegador, as contas da versão curta
  (duração, séries escondidas, regra padrão, estado no aparelho). Também roda no
  roteiro `curto`, que testa as telas com e sem o SQL e sem internet; a auditoria
  axe é o roteiro `curto-a11y`.
- `node tests/contas-trocar.mjs`: confere, sem navegador, as opções de troca
  (alternativas do Jean primeiro, mesmo grupo muscular, essencial só por
  alternativa do Jean, nunca o próprio exercício nem um que já está no treino).
  Também roda no roteiro `trocar`, que testa as telas com e sem o SQL; a
  auditoria axe é o roteiro `trocar-a11y`.
- `pnpm test:sql`: aplica os `supabase/*.sql` duas vezes, em duas ordens, num
  Postgres 16 e testa RLS, restrições e funções (`PGHOST`, `PGUSER` e
  `PGPASSWORD` apontando para o banco).
- O GitHub Actions ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) roda
  lint, build, tipos, os testes de ponta a ponta e os do banco a cada push e PR.

## Claude Code: agentes e Supabase

- [`.claude/agents/`](.claude/agents) traz vinte e quatro agentes. Os catorze
  primeiros: revisor, testador, conselheiro, advogado do diabo, voz do usuário,
  ajudante rápido, especialista, front leve, front difícil, animador, animador
  pro, revisor visual, mesa de design e especialista em cibersegurança. Os dez
  novos (adaptados do [agency-agents](https://github.com/msitarzewski/agency-agents),
  licença MIT): auditor de acessibilidade, verificador de realidade, engenheiro
  de motivação, sintetizador de feedback, priorizador, encarregado de LGPD,
  medidor de desempenho, analista de dados, engenheiro de cobrança e curador de
  Instagram. O [`CLAUDE.md`](CLAUDE.md) diz quando usar cada um, e as
  decisões importantes ficam em [`DECISOES.md`](DECISOES.md).
- [`.claude/skills/design-taste-frontend`](.claude/skills/design-taste-frontend)
  é a skill de direção de arte [taste-skill](https://github.com/Leonxlnx/taste-skill)
  (licença MIT). No Team Jean as regras do projeto (paleta, WCAG, letra mínima,
  LGPD) valem sempre mais que ela.
- [`.mcp.json`](.mcp.json) liga o MCP oficial do Supabase ao projeto, em modo só
  leitura e **sem SQL**: dá para ver a estrutura do banco, os logs e os alertas
  de segurança, mas não as fichas de saúde, medidas, fotos e recados dos alunos
  (os logs ainda podem mostrar e-mails e IDs). Para usar, abra o Claude Code
  nesta pasta, digite `/mcp`, escolha *supabase* e autorize no navegador com a
  sua conta do Supabase.

## Scripts

- `pnpm dev`: servidor de desenvolvimento
- `pnpm build`: build de produção
- `pnpm lint`: ESLint
- `pnpm typecheck`: TypeScript
- `pnpm test:build`, `pnpm test:e2e`, `pnpm test:sql`: testes (veja acima)
