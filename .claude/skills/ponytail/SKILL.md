---
name: ponytail
description: >
  Modo "dev sênior preguiçoso" para o Team Jean: a menor mudança que resolve a
  tarefa inteira, sem abstração, opção ou dependência que ninguém pediu, e uma
  resposta que o dono entende de uma vez. Use ao escrever, corrigir, refatorar
  ou rever código, ao escolher dependência e quando o dono reclamar de exagero
  ou de código demais. Também para "dívida" (listar os `shortcut:` do código).
license: MIT
---

# Ponytail (adaptado ao Team Jean)

Adaptado do [ponytail](https://github.com/DietrichGebert/ponytail) (MIT, © 2026 DietrichGebert). O melhor código é o que nunca foi escrito: resolva o problema inteiro com o mínimo de código novo. Termine a resposta com uma ou duas linhas: o que ficou de fora ou não foi conferido, e qualquer risco que o dono precise saber.

## Antes de escrever
Leia a tarefa e o código que ela toca. Liste tudo que a mudança precisa alcançar: quem chama, testes, mocks (`tests/mock-supabase.mjs`), SQL, README/CLAUDE.md. Veja o que a mudança pode quebrar para o aluno ou o treinador (dado apagado ou exposto, tela que para de abrir). Isso é escopo; função extra não é.

## A menor mudança completa
Pegue a primeira opção que resolve de verdade:
1. Precisa existir? Pedido vago ("faz um X") ganha a menor versão que cumpre o essencial; diga em uma linha o que ficou fora.
2. Já existe no projeto (helper em `src/lib`, componente em `src/components/ui`, padrão de sonda de SQL)? Use do jeito da vizinhança.
3. CSS, HTML ou recurso da plataforma resolve? Use (animação em CSS antes de Framer Motion).
4. Dependência já instalada? Use. Nunca adicione dependência para poucas linhas.
5. Cabe em uma linha que se entende de relance? Uma linha.
6. Senão, o mínimo que funciona.

- Preguiça é com a solução, nunca com a mudança: termine tudo que a tarefa pede, inclusive chamadores, testes e mocks que a mudança quebra.
- Sem abstração, wrapper, opção, configuração ou código "para depois" que ninguém pediu. Apagar vence acrescentar. Mantenha a estrutura que o projeto já tem.
- Corrigindo bug: procure todos os chamadores antes e conserte a causa uma vez só, no código compartilhado.
- Código movido ou unido mantém validação e tratamento de erro.
- Entre opções do mesmo tamanho, a que acerta os casos de borda.
- Lógica nova e não trivial (condição, laço, conta, dinheiro, permissão) deixa um teste pequeno (`tests/contas-*.mjs`, `tests/sql/`, roteiro e2e). Mudança trivial não precisa.
- Atalho com limite conhecido leva um comentário em uma linha: `shortcut: <o limite>, <quando melhorar>`.
- Comente só o porquê que o código não mostra.

## Nunca corte (regras do projeto vencem a preguiça)
Validação onde entra dado de fora; tratamento de erro que evita perder dado; permissões (RLS + servidor) e segredos só no servidor; dados de saúde e LGPD; acessibilidade WCAG 2.1 AA (alvo de 44 px, texto ≥ 12 px, movimento reduzido); treino sem internet com ids do aparelho sem duplicar; dinheiro contado uma vez; texto da tela em português do Brasil; SQL idempotente com aviso amigável enquanto o dono não roda; o que o dono pediu.

## Níveis
- **leve**: faça o que foi pedido e cite a opção menor em uma linha.
- **cheio** (padrão): as regras acima.
- **ultra**: questione o pedido antes de construir, nas partes que a necessidade não justifica.

## Rever (use com o `revisor`)
Ordem de importância: certo, seguro, aguenta o uso real, testado, rápido, enxuto. Cada achado precisa de um caso concreto ("com esta entrada, acontece este erro"); sem caso, sem achado. Antes de chamar algo de "sem uso", procure no projeto inteiro, inclusive testes, mocks e referências por texto. Um `shortcut:` com limite nomeado é decisão, não achado, a menos que o uso real já passe do limite. Proponha a menor correção, de preferência a que apaga código. Sem gosto pessoal e sem "considere".
Lista numerada (para o dono dizer "arruma o 2 e o 5"), em português simples: **Corrigir já** / **Deveria corrigir** / **Se der**; cada item com o que é, o problema, a correção e o que acontece se pular. Feche com `Veredito:` e `Não conferido:`.

## Dívida
Lista os atalhos marcados no código, sem mudar nada:
`git grep -nE '(#|//|/[*]) ?shortcut:' -- src supabase tests`
Uma linha por marcador: `<arquivo>:<linha>, o que foi simplificado. limite: ... melhorar quando: ...`. Marcador sem "quando melhorar" leva a etiqueta `sem-gatilho` (é o que apodrece). Feche com `<N> marcadores, <M> sem gatilho.` ou `Sem dívida de atalho.`
