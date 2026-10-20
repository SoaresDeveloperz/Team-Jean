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
| `SUPABASE_SERVICE_ROLE_KEY` | **somente servidor**: cadastro de alunos pelo treinador |

Em produção, cadastre as três em **Vercel → Settings → Environment Variables**.
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

## Scripts

- `pnpm dev`: servidor de desenvolvimento
- `pnpm build`: build de produção
- `pnpm lint`: ESLint
