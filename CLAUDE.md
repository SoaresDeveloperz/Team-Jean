@AGENTS.md

## Sobre o projeto
- App: Team Jean — app de treino (PWA) da consultoria do treinador Jean. O aluno segue o treino do dia, registra séries e acompanha a evolução; o treinador prescreve treinos, acompanha os alunos e cobra a mensalidade.
- Para quem: alunos (do iniciante ao avançado, inclusive pessoas mais velhas) e o treinador.
- Tecnologia: Next.js 16 (App Router, `src/proxy.ts`), React 19, Tailwind v4, Framer Motion (`LazyMotion`/`m`), Supabase (Postgres com RLS, Auth e Storage), PWA com service worker (`public/sw.js`), hospedado na Vercel (cron em `vercel.json`).
- Testes:
  - rápidos: `pnpm lint` e `pnpm typecheck`;
  - ponta a ponta e acessibilidade: `pnpm test:build` e depois `pnpm test:e2e` (tudo, ~7 min) ou só o roteiro que cobre a mudança, com `node tests/run.mjs <roteiro>`:
    - `e2e` (`tests/e2e.cjs`): login, treino do aluno, perfil e medidas, comunidade, painel e ferramentas do treinador;
    - `gestao` (`tests/e2e-gestao.cjs`): esqueci minha senha, push, ficha de saúde, avaliação, treino sem internet, recados, carga-alvo, financeiro e o treinador no computador;
    - `routes`, `admin`, `coach`, `community`, `profile` e `gestao-a11y` (`tests/a11y/`): auditorias axe das telas de cada área;
  - banco: `pnpm test:sql` (precisa de um Postgres; veja o README);
  - o CI do GitHub roda tudo isso a cada push e a cada PR.
- Regras do projeto:
  - textos da tela em português do Brasil; mobile-first; paleta do Team Jean (verde `#34d399`, dourado `#fbbf24`, fundos escuros);
  - acessibilidade WCAG 2.1 AA: as auditorias axe terminam com 0 violações;
  - cada aluno só vê os próprios dados; o treinador (admin) vê tudo; permissões no banco (RLS) e no servidor;
  - `SUPABASE_SERVICE_ROLE_KEY`, `VAPID_PRIVATE_KEY` e `CRON_SECRET` só no servidor: nunca com `NEXT_PUBLIC_`, nunca no Git;
  - SQL novo vai em `supabase/*.sql`, idempotente e em qualquer ordem; o dono roda à mão no Supabase e o app funciona com aviso amigável até lá;
  - dados de saúde (anamnese, medidas, fotos de evolução) são sensíveis (LGPD): fotos privadas com link temporário, fora de logs e do texto das notificações;
  - treino sem internet: a fila do aparelho usa ids gerados no aparelho e nunca duplica ao sincronizar;
  - mensalidade e PIX: valores vêm do banco; o PIX é estático e o treinador marca o pagamento;
  - commits em português.
- Ideias rejeitadas: nenhuma registrada ainda. Quando o dono recusar uma ideia, anote aqui e no DECISOES.md.

## Economia de tokens (qual agente usar)
- Tarefa fácil e bem definida (trocar texto, ajustar valor, achar algo no código, rodar comando e resumir): `ajudante-rapido` (modelo leve).
- Tarefa difícil (função nova, vários arquivos, bug sem causa, login, mensalidade, PIX, push, segurança, arquitetura): `especialista` (modelo forte).
- Na dúvida, comece pelo ajudante: ele devolve a tarefa se for grande demais.

## Agentes do projeto
- `revisor`: revisa cada mudança contra as regras. Chame antes de cada commit.
- `testador`: roda os testes e cria verificações novas para regras novas.
- `conselheiro`: segunda opinião independente (modelo forte). Passe as opções sem dizer qual você prefere.
- `advogado-do-diabo`: ataca o plano escolhido antes de implementar.
- `voz-do-usuario`: reage como alunos e o treinador a telas, textos e preços.
- `ajudante-rapido` e `especialista`: ver "Economia de tokens".

## Como tomar uma decisão importante
Vale para decisões que mudam o rumo do app ou são difíceis de desfazer (preço, serviço externo, tecnologia, banco de dados, funções grandes). Decisão pequena não precisa disso.
1. Leia o `DECISOES.md` para não decidir de novo.
2. Pergunte ao `conselheiro`, sem dizer qual opção você prefere.
3. Se a decisão mexe no que o aluno ou o treinador vê, pergunte também à `voz-do-usuario`.
4. Escolha um caminho e passe o plano ao `advogado-do-diabo`. Corrija o que ele achar de sério.
5. Se você e o conselheiro discordarem, ou se a decisão for cara ou difícil de desfazer, traga as opiniões para o dono do projeto decidir.
6. Registre no `DECISOES.md`: data, a pergunta, as opções, o que cada agente disse e o que ficou decidido.
