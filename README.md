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

Em produção, cadastre todas em **Vercel → Settings → Environment Variables**.
O `.env.local` não deve ser commitado.

## Segurança do banco

Todo o controle de acesso aos dados depende do RLS do Supabase. Revise e rode
[`supabase/policies.sql`](supabase/policies.sql) no SQL Editor do projeto.

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
   membros da equipe do projeto e tem limite baixo. Em **Rate Limits**, deixe o
   limite de e-mails por hora bem abaixo do limite diário do seu provedor.
3. Em **Emails → Templates → Reset Password**, use o assunto
   `Criar nova senha — Team Jean` e cole o modelo de
   [`supabase/email-recuperar-senha.html`](supabase/email-recuperar-senha.html).
   O link dele (`/auth/confirm?token_hash=...`) funciona mesmo abrindo o e-mail
   em outro aparelho.

Se o e-mail não chegar, o treinador usa **Gerar senha nova** na ficha do aluno
e envia a senha provisória.

### Treino sem internet

Na execução do treino, cada série marcada fica numa fila no aparelho e sobe
para o Supabase em ordem; sem conexão, o treino continua normalmente (inclusive
finalizar com recado) e tudo é enviado sozinho quando a internet volta. O
treino aberto fica guardado no aparelho e pode ser reaberto offline.

## Testes e CI

- `pnpm test:build && pnpm test:e2e`: sobe um Supabase falso
  ([`tests/mock-supabase.mjs`](tests/mock-supabase.mjs)) e o app de produção e
  roda os roteiros de ponta a ponta (Playwright) e as auditorias de
  acessibilidade (axe, WCAG 2.1 AA). Use `node tests/run.mjs e2e gestao` para
  rodar só alguns.
- `pnpm test:sql`: aplica os `supabase/*.sql` duas vezes, em duas ordens, num
  Postgres 16 e testa RLS, restrições e funções (`PGHOST`, `PGUSER` e
  `PGPASSWORD` apontando para o banco).
- O GitHub Actions ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) roda
  lint, build, tipos, os testes de ponta a ponta e os do banco a cada push e PR.

## Scripts

- `pnpm dev`: servidor de desenvolvimento
- `pnpm build`: build de produção
- `pnpm lint`: ESLint
- `pnpm typecheck`: TypeScript
- `pnpm test:build`, `pnpm test:e2e`, `pnpm test:sql`: testes (veja acima)
