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

## 2026-11-17 — Revisão do front do app inteiro (pedido do dono), primeira leva
- **Pedido:** "veja o front de todo o aplicativo, remodele, organize e anime o que for necessário".
- **Revisor visual:** nota por tela (melhores: treino, Histórico, Evolução, lista de alunos, Avisos; piores: Perfil 2,5, Exercícios 2,5, Hoje/Resumo/painel 3) e 12 mudanças em ordem.
- **Feito nesta leva (pequenas e seguras):** fim das listas do treinador com espaço para o botão "+" (ele cobria o valor no Financeiro); menu do treinador hifeniza a palavra longa em vez de cortar "Exercício s"; "Team Jean" não quebra ao lado do selo "Treinador"; anel do descanso sem animação a cada segundo (era um loop na tela de treino) e 600 ms nos outros usos; frase "Respire e se prepare" removida do descanso (cobria a série seguinte); resumo do treino visível desde o primeiro instante (sem atrasos escalonados); nome do treino em até duas linhas; nada pulsando sem fim ("Em andamento" e o envio do treino salvo); contagem de números em 400 ms; gráfico em 600 ms; entrada do login em 300 ms; "Começar treino" em verde (a ação do dia).
- **Não feito de propósito:** trocar todos os 76 botões brancos por verde (o verde hoje significa "concluído/ação do dia"; mudar tudo é decisão de marca para o dono) e renomear "Concluir" (o termo é usado em toda a tela e nos roteiros).
- **Falta (levas seguintes, maiores):** reorganizar o Perfil (mensalidade no topo, "Ajustes" numa lista), enxugar a tela Hoje, painel e ficha do aluno no computador, detalhe de Exercícios (GIF primeiro, 3D recolhido), construtor de treinos (menu "⋯"), cabeçalho de tela único.
- **Aviso de segurança do Next.js:** o build avisou que a versão instalada (16.4.3) tem uma vulnerabilidade conhecida e recomenda atualizar (`next upgrade`). Não atualizado nesta leva; decidir com o dono.

## 2026-11-14 — Aba de nutrição: base de alimentos agora, planos depois da resposta sobre o responsável técnico
- **Pergunta:** o Jean pediu uma aba de nutrição com tabela de alimentos ligada a uma base (macro, micro e kcal sem digitar), podendo cadastrar à mão o que faltar. O dono vai cobrar o módulo à parte.
- **Opções (fonte):** A) TACO embutida no banco + cadastro do treinador; B) TACO + API externa de produtos (Open Food Facts); C) TBCA/USP; D) USDA ou IBGE/POF.
- **Fatos conferidos:** TACO (Unicamp/NEPA, 4ª ed., 2011, 597 alimentos): "É permitida a reprodução parcial ou total desta obra, desde que citada a fonte." TBCA (USP, v7.3): "Não é permitida a comercialização... Para fins comerciais, é necessário contatar os coordenadores." Open Food Facts respondeu 503 no teste. A licença do IBGE/POF não foi confirmada.
- **Conselheiro:** A (certeza alta); escopo da 1ª versão = plano do treinador + "comi" (certeza média); tabela de medidas caseiras; micros em "ver mais"; "Tr" e "NA" nunca como se fossem dado certo (superado: ver Decisão abaixo, o NA da TACO é "não aplicável" e entra como 0); perguntar ao Jean sobre CRN antes de escrever a Fase 1.
- **Voz do usuário:** aba "Alimentação" para o aluno e "Nutrição" na ficha do treinador (evitar "Dieta"); medida caseira primeiro e gramas depois; micros escondidos; "Comi" pode soar como nota (preferir "Marquei como feito" ou deixar para depois); o Jean precisa copiar/modelo de plano; aviso "não substitui médico ou nutricionista"; piso de kcal para quem quer emagrecer; abrir sem internet.
- **Encarregado LGPD:** plano alimentar e adesão são dado de saúde: consentimento por finalidade (versão, data, revogação), push sempre genérico, exclusão e retenção, fonte TACO citada. Achados que já existiam: o app não tem registro de consentimento nem página de privacidade, e não tem exclusão de conta. Regulatório: montar dieta é atividade privativa de nutricionista (Lei 8.234/91); aviso ou nome de aba não resolvem; a proteção é um responsável técnico real (nome, CRN, UF). Nada disso substitui advogado ou o CRN da região.
- **Advogado do diabo:** (Fase 1) `profiles.nutrition_enabled` não é "só admin grava" com a RLS atual (o aluno edita a própria linha): usar tabela `student_modules` ou trigger como o de `role`, e checar na RLS das tabelas de nutrição; o campo de CRN sozinho é só texto; cru x cozido muda o carboidrato em umas 3 vezes (mostrar o nome completo e avisar); totais não podem mostrar 0 quando faltou dado; cópia do plano no aparelho é dado de saúde e precisa sair ao sair da conta; "copiar plano" deve copiar só refeições e itens; alimentos próprios usados em plano não podem ser editados nem apagados. Corte sugerido: trocas por equivalentes.
- **Decisão (feita, fase 0):** TACO embutida no banco; TBCA descartada; nada de API externa. Feitos `supabase/nutricao.sql` (tabela `foods`, RLS: todos leem, só o treinador cria/edita/apaga os seus `custom`, TACO imutável pelo app) e `supabase/nutricao-taco.sql` (597 alimentos, do PDF oficial, conferidos no PDF, fora do repositório (kJ = kcal x 4,184 nas 597 linhas), energia coerente com os macros em 578 de 582, 5 linhas de minerais conferidas contra a imagem do PDF e RAE = RE/2 nos vegetais). Regra dos dados: "Tr" e "NA" (não aplicável) = 0; célula em branco e "*" ("análises sendo reavaliadas") = vazio. Quatro alimentos ficam sem energia na própria TACO (leite integral, leite desnatado, iogurte sabor abacaxi, coco verde). `src/lib/nutrition.ts` soma os itens e devolve `incomplete` (nutrientes com item sem dado). Testes: `tests/contas-nutricao.mjs` (31) e `tests/sql/rls-nutricao.sql` (28, nas duas ordens).
- **Não feito de propósito:** trigger que bloqueia a TACO até para o dono do banco (o dono precisa poder corrigir o seed; a RLS já protege contra o app); medidas caseiras (nenhuma fonte livre conferida ainda); micros na tela.
- **Resposta do dono (2026-11-14):** o Jean tem formação em nutrição, então ele é o responsável técnico dos planos; o uso da TACO está autorizado; o crédito da TACO fica bem pequeno e **fora das telas de nutrição** (no fim do Perfil do aluno).
- **Feito a partir da resposta (Fase 1, enxuta):** `supabase/nutricao-plano.sql` (um plano por aluno, refeições e itens em gramas com medida caseira em texto; o responsável técnico, nome e CRN, é obrigatório no banco e aparece para o aluno; alimento em uso não é apagado e o alimento próprio em uso não muda de valores; gatilhos sem EXECUTE pela API); aba "Nutrição" na ficha do aluno (`NutritionPlanEditor`, `FoodPicker`) e tela "Alimentação" do aluno (`/student/nutrition`, link na tela Hoje só com plano, abre sem internet pela cópia do aparelho, que sai ao sair da conta). **Criar o plano é o que liga a Alimentação para aquele aluno** (nenhuma coluna que o aluno possa editar; resolve o achado do advogado do diabo sobre `profiles.nutrition_enabled`). O aluno vê só calorias por refeição (macros só no total do dia), medida caseira primeiro e aviso de que não substitui nutricionista ou médico. Totais mostram "Total parcial" quando falta dado (leite integral na TACO, por exemplo).
- **Cortado de propósito (ponytail):** copiar plano entre alunos, trocas por equivalentes, "marquei como feito", lembretes push, medidas caseiras prontas por alimento (o Jean escreve a medida na hora), micronutrientes na tela.
- **Revisão e auditoria de segurança (feitas):** nenhum caminho deixa um aluno ler ou alterar o plano de outro, nem ligar a Alimentação para si (só o treinador cria plano). Corrigido: edição de gramas perdia foco e texto (linhas eram recriadas), mudanças agora entram numa fila, o item novo nasce com id do aparelho (tentar de novo depois de falha de rede não duplica), limites de tamanho medidos no texto cru, "atualizado em" também ao mudar metas, cópia do plano no aparelho vale 30 dias e só fica a de uma conta. **Decidido não fazer agora:** restringir a leitura dos alimentos cadastrados pelo treinador (hoje todo aluno logado consegue listá-los pela API; por isso o cadastro avisa para não pôr nome de aluno nem doença no nome do alimento) e limpar a cópia do plano também quando a sessão expira sem passar pelo botão Sair (o mesmo vale para o treino guardado, que já era assim; seria um ajudante único no login).
- **Uso da TACO (2026-11-15):** o dono confirmou que está permitido usar a TACO. A própria obra diz "É permitida a reprodução parcial ou total desta obra, desde que citada a fonte", e a fonte está citada no Perfil do aluno e no README. Não há resposta por escrito do NEPA/UNICAMP; se o dono tiver uma, guardar aqui.
- **Revisão do front, animações e micronutrientes (2026-11-16, pedido do dono):** revisão visual (agente `revisor-visual`) e redesenho das duas telas. **Aluno:** número grande de calorias (contagem de 400 ms) e macros em três números, em vez de barras (é plano prescrito, não diário para "encher"; barras só no treinador, que compara com as metas); selo "Próxima" pelo horário da refeição; ícone por refeição; refeições vazias escondidas; recado do nutricionista no topo; "parcial" numa frase só, sem lista de nutrientes; aviso trocado para "Valores aproximados. Siga também as orientações do seu médico." (o plano é do próprio nutricionista); **vitaminas e minerais do dia** num painel recolhido (soma das refeições, sem metas, nutriente sem dado em nenhum alimento some da lista, selo "parcial" nos demais). **Não seguimos** a sugestão de mostrar macros por refeição ao aluno (risco para quem tem diabetes) nem a de citar a TACO no fim do painel (o dono pediu o crédito só no Perfil). **Treinador:** resumo preso no topo ao rolar, "Salvando…/Salvo ✓", total por refeição, atalhos de 50/100/150/200 g e conta ao vivo da porção no seletor, remoção instantânea com animação de saída, modal de vitaminas e minerais com nomes técnicos e "parcial 3/4", botão de apagar plano movido para dentro de "Editar". **Animações** (só `transform` e `opacity`, nada em loop): entrada dos itens (280 ms, escalonada até 4), selo "Próxima" (240 ms), seta do painel (200 ms), saída dos alimentos (150 ms), troca de passo no seletor; tudo respeita "reduzir movimento". Os micronutrientes só são baixados com os itens do plano (a lista de busca de ~600 alimentos continua sem eles).
- **Em aberto:** (1) registro de consentimento, página de privacidade e exclusão de conta, que o app ainda não tem e o módulo herda (apontado pelo encarregado de LGPD): decidir antes de divulgar a Alimentação para muitos alunos; (2) **SQL em produção (2026-11-15):** `nutricao.sql` e `nutricao-plano.sql` foram aplicados pelo conector (3 tabelas de plano + `foods`, segurança por linha ligada, 12+4 regras de acesso, 4+4 restrições, 4 gatilhos sem EXECUTE para a API, anon sem acesso; o verificador de segurança do Supabase não apontou nada nas tabelas novas). **Seed da TACO aplicado em 2026-11-16, só com o que o app lê** (nome, grupo, calorias, proteína, gordura, carboidrato, fibra, sódio e colesterol), em formato compacto para gastar pouco: 597 linhas, 15 grupos, soma de verificação dos macros `20198ccda5c03a7a14e4235fa11fe524` (`taco_number|name|group|kcal|prot|fat|carb|fiber|sodium|chol` com 2 casas, `;` entre linhas, ordenado por `taco_number`), idêntica à do arquivo do repositório (e também por faixa: 1 a 200, 201 a 400 e 401 a 597), e as mesmas células vazias (4, 5, 5, 5, 14, 10 e 1). **Micronutrientes aplicados em 2026-11-16** (`micros`, em formato compacto, a pedido do dono para a tela de vitaminas e minerais): soma de verificação por faixa (1 a 200 `32815ce8…`, 201 a 400 `5f9c4a56…`, 401 a 597 `64880bab…`) e total `a623d5ea2073a2ae9e14bce7854a02a0` (por alimento: `taco_number:chave=valor,...` com as chaves em ordem "C"), 9587 chaves e soma 490553.25, idênticos aos do arquivo do repositório. O único alimento da TACO sem micronutrientes é o iogurte sabor abacaxi (a própria tabela o publica em branco).
- **Conector do Supabase e `drop`:** comandos com `drop ... if exists` fazem o conector pedir uma confirmação que expira em 60 s. Em objetos novos, os `drop` só servem para rodar de novo; aplicamos a versão sem eles (cada constraint, gatilho e regra criada só se ainda não existir), com o mesmo resultado, e conferimos o catálogo depois.
- **Rever quando:** o NEPA negar uso comercial da TACO (trocar de base ou pedir licença), o Jean não tiver como ter um responsável técnico (a aba vira só orientação geral/registro de refeições), ou a TBCA autorizar por escrito.

## 2026-10-31 — Descanso rotativo (o dia de descanso gira pela semana)
- **Pergunta:** o dono pediu a função "descanso rotativo" no app do Jean; ao perguntar, respondeu "dia de descanso que gira".
- **Decisão (a IA decidiu o desenho, dentro do pedido):** interruptor por aluno no construtor (`assigned_workouts.rotate_days`, só o treinador grava). Ligado, os dias marcados andam um dia a cada semana (ciclo de 7 semanas, contando a partir da segunda de 01/01/2024), então a folga gira pela semana. A regra é a mesma da rotina da semana (`weekdayThisWeek` em `week-plan.ts`): Hoje, Semana e o plano usam o dia desta semana; o treinador vê "Esta semana: ..." ao ligar. O dia base continua sendo o que o treinador marca em cada treino.
- **O que ficou em aberto:** o "primeiro app" e o "prime app" citados pelo dono não foram encontrados no GitHub (só Team-Jean, exercises-dataset e Codigo-Runner, que é um README apontando para o Replit); a função equivalente, se existir lá, não pôde ser comparada.
- **Rever quando:** o Jean disser que queria outra coisa por "rotativo" (por exemplo, folga a cada N treinos, sem depender do dia da semana).

## 2026-10-29 — Rotina da semana: dia de cada treino, reinício semanal e ordem editável (pedido do Jean)
- **Pergunta:** o Jean pediu (1) treino ligado ao dia da semana, (2) a rotação reiniciar na virada da semana (quem não fez o último treino volta ao primeiro, o de segunda, em vez de seguir do último) e (3) poder mudar a ordem dos treinos no app.
- **Opções:** A) só dia da semana; B) só reinício semanal da rotação + ordem editável; C) dois modos; D) uma regra só, com ordem (`position`) e dia opcional (`weekday`) no mesmo treino.
- **O que cada agente disse:** conselheiro: D (uma regra só; o treino perdido não some nem vira "atrasado"; qualquer treino pode ser feito fora do dia; semana começa na segunda pelo dia local; antes do SQL vale a regra atual com reinício semanal). Voz do usuário: textos sem culpa ("Hoje é dia de descansar", "Descansar também conta.", "Semana nova!"), botão "Adiantar" no descanso, botões subir/descer no construtor. Advogado do diabo: contar "feito na semana" por id E por nome (o treinador refaz o treino e o id muda), copiar dia e ordem ao refazer, tratar coluna ausente sem quebrar a tela Hoje, uma só função pura para decidir o "próximo" (Hoje e Semana), contar o que está na fila do aparelho, nunca comparar datas por texto.
- **Decisão:** D, em `src/lib/week-plan.ts` (pura, 38 verificações em `tests/contas-semana.mjs`) e `supabase/rotina-semanal.sql` (`weekday`, `position`, idempotente). Regras: em andamento primeiro; treino marcado para hoje ainda não feito na semana; em dia sem treino marcado, descanso com "Adiantar" (próximo dia marcado, depois os sem dia, por último os de dias que passaram); sem dias marcados, o primeiro da ordem ainda não feito na semana; semana completa vira "bônus". Perdido = "Ainda dá tempo esta semana", some na segunda.
- **Rever quando:** o Jean tiver aluno que treina menos vezes do que tem treinos (o último nunca aparece com o reinício na segunda: aí vale uma chave por aluno), ou pedir agenda rígida (perdeu, perdeu).

## 2026-10-29 — Animações em CSS e acesso da IA ao banco
- **Pergunta (animações):** o app parece "sem animação"; o que deve virar CSS e o que fica no Framer Motion?
- **Opções:** A) microinterações simples em CSS, Framer só para arrastar, reordenar, layout e saídas; B) manter tudo; C) migrar tudo.
- **O que cada agente disse:** animador e medidor de desempenho: A (C custa muito e não tira o Framer do pacote). Acessibilidade: ainda não até ajustar a base (movimento reduzido sem atrasos, aurora e borda giratória em loop, resumo atrasando informação). Voz do usuário: feedback curto, sem esperar para tocar, nada que enjoe o Seu Wilson.
- **Decisão:** A. Só `transform` e `opacity`; toque até 200 ms; entrada até 320 ms; nada em loop na tela de treino; sem `backdrop-blur` no painel e no aviso; com "reduzir movimento" ficam só trocas de cor e opacidade (150 ms), sem atrasos e sem confete. Barras de progresso passam a `scaleX` (`BarFill`).
- **Rever quando:** o INP no treino passar de 200 ms em celular fraco, ou o dono pedir mais movimento em alguma tela.

## 2026-10-29 — Acesso da IA ao banco de produção
- **Pergunta:** a IA pode ter acesso total ao Supabase de produção (conector da sessão)?
- **Decisão do dono:** sim, acesso total. A IA usa para aplicar os `supabase/*.sql` e conferir o resultado (colunas, avisos de segurança, erros).
- **Limites que a IA mantém por conta própria:** dados de alunos (saúde, medidas, fotos, mensalidade) só se a tarefa exigir e nunca em commits, logs ou mensagens; nada que apague ou altere dados existentes sem avisar o dono. O `.mcp.json` do repositório segue só leitura e sem SQL.
- **Rever quando:** houver outra pessoa com acesso ao repositório ou à conta, ou um incidente com dados de alunos.

## 2026-10-28 — "Trocar exercício" e a marca "Essencial" do Jean
- **Pergunta:** o que entra depois da versão curta: trocar um exercício na hora (máquina ocupada, dor) e deixar o Jean marcar o que não pode sair.
- **Decisão:** o dono pediu os dois ("faz aí"). Troca só para hoje, antes da primeira série do exercício, até 3 opções (alternativas do Jean primeiro, depois mesmo grupo muscular); essencial fica na versão curta e só troca por alternativa do Jean. A troca por dor só pré-marca a tag "Senti dor" do recado, sem texto livre.
- **Por quê:** a série já guarda o exercício feito separado do prescrito, então a prescrição do Jean nunca muda; um número (`swaps`) basta para o histórico, sem aviso nem push.
- **Cuidados:** sem o SQL o app segue funcionando (sugestão por grupo; treino salvo sem `swaps`); sem "recorde" nem "Anterior" do exercício antigo no exercício novo.
- **Rever quando:** o Jean disser que as sugestões do app atrapalham (aí só alternativas dele), ou quando a troca for muito usada para fugir do mesmo exercício.

## 2026-10-28 — "Tenho pouco tempo" e a Hoje enxuta (reunião dos agentes)
- **Pergunta:** qual inovação adicionar ao app agora e como reformar o front (revisão com a skill `design-taste-frontend` e os agentes novos).
- **Opções da inovação:** A) trocar exercício (equivalente do mesmo músculo, com GIF); B) "tenho pouco tempo" (treino de ~20 min); C) cartão semanal compartilhável; D) carga/volume pela prontidão; E) lembrete de treino inteligente (push).
- **Conselheiro:** escolheria **A** (a série já guarda o exercício feito separado do prescrito, então não precisa de SQL); B vem depois e só é bom se o app souber quais exercícios são os principais; E esbarra no plano grátis da Vercel (cron 1 vez por dia, com atraso). Na segunda rodada: a regra com "Manter" por item reduz o "corte no chute" e basta para lançar; a marca "essencial" do Jean pode vir depois; A não é pré-requisito de B. **Divergência registrada: o conselheiro prefere A.**
- **Voz do usuário:** B é a que mais agrada os três (Ana usa com um toque, Seu Wilson não é incomodado, Jean só precisa ver que foi curto). D incomoda o Seu Wilson (parece pergunta de saúde); C confunde ("para onde vai a imagem?").
- **Priorizador:** B tem o melhor retorno em adesão com o menor risco, sem SQL obrigatório; plano em dois PRs.
- **Advogado do diabo:** os riscos eram a fila e os ids ao esconder e voltar (corrigido: o corte é só na hora de desenhar, `sets` e `rowId` não mudam), o corte pela ordem do treino ser chute (corrigido: painel lista o que sai e deixa manter), o treino curto distorcer o que o treinador lê (corrigido: coluna `short_mode`, selo no histórico), e o texto de status oculto mudar o nome dos botões (corrigido: região de status à parte; os rótulos não mudam). Segunda rodada: o `short_mode` tem de ir junto da finalização, que já tem plano B se a coluna não existe, e nunca na criação da sessão; o estado no aparelho é por treino e dia; a duração é "cerca de N min", nunca promessa.
- **LGPD:** só sim/não, sem campo de motivo (motivo viraria dado de saúde); texto sem pedir dado de saúde; apagar o treino guardado e o em andamento ao sair da conta (feito no PR 1). Urgente fora deste lançamento: política de privacidade, consentimento para dados de saúde, exclusão de conta e exportação (o aluno hoje só consegue pedindo ao Jean) e retenção; isso precisa de advogado.
- **Cobrança e segurança:** push de mensalidade sem valor na tela bloqueada (feito); atraso de mês anterior some na virada do mês e desfazer pagamento não deixa rastro (**abertos, para o dono decidir**); segunda etapa de login do treinador, links de foto de 6 h, GIFs em `@main` e proteção contra senhas vazadas (**abertos**).
- **Decisão (a IA decidiu, o dono pediu "1 inovação"):** B, com os cuidados acima; a tela Hoje fica enxuta (treino + botão + recado + prontidão visíveis; recuperação muscular, "O que vem aí" e "Sua rotina" recolhidos em "Ver mais do seu dia"). A fica como a próxima.
- **Rever quando:** o Jean disser que a regra padrão corta o que não pode (aí entra a marca "essencial" por exercício, vinda do banco), ou quando poucos alunos usarem a versão curta (mede-se pelo `short_mode`).

## 2026-10-28 — Mais dez agentes e a skill de direção de arte
- **Pergunta:** instalar agentes e skill de repositórios públicos ([agency-agents](https://github.com/msitarzewski/agency-agents) e [taste-skill](https://github.com/Leonxlnx/taste-skill)) no projeto.
- **Opções:** A) instalar tudo como está (mais de 250 agentes, em inglês); B) escolher e adaptar só o que falta; C) instalar no computador do dono, fora do Git.
- **Decisão (pedido do dono):** B para os agentes e instalar a skill no projeto. Dos mais de 250 agentes, dez preenchem lacunas dos catorze que já existem (acessibilidade manual, verificação com evidência, adesão do aluno, feedback, priorização, LGPD, desempenho, dados, cobrança, Instagram). Foram reescritos em português com as regras do Team Jean e o crédito ao original (licença MIT). Os de modelo forte são `encarregado-lgpd` e `engenheiro-de-cobranca` (dinheiro e saúde).
- **Skill:** instalada com `npx skills add Leonxlnx/taste-skill` (só `design-taste-frontend`, 2,5 MB, `skills-lock.json` guarda a versão). Os scripts só falam com bancos de imagem abertos e com um servidor local, e guardam histórico em `~/.taste-skill`. Foi pensada para páginas públicas; no app, as regras do projeto mandam (paleta, WCAG, 12 px, sem foto de banco de imagens de pessoas).
- **Cuidados:** skill roda com as permissões do agente, então fica fixa em uma versão (o lock) e só atualiza por PR. Agentes só aparecem numa sessão nova do Claude Code.
- **Rever quando:** a skill puxar o app para fora da identidade Team Jean ou algum dos dez agentes quase não for usado (aí sai).

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

## 2026-10-31 — Ponytail (skill de código enxuto)
- Pergunta: vale trazer o repositório DietrichGebert/ponytail (indicado pelo dono) para o app?
- O que é: não é um app de treino; é uma skill para agentes de IA ("dev sênior preguiçoso", MIT) com regras de menor mudança, revisão ranqueada e lista de atalhos (`shortcut:`).
- Decidido: adaptar para `.claude/skills/ponytail/SKILL.md` em português, com as regras do projeto como "nunca corte". Primeira aplicação: varredura de código sem uso (removidos `PageLoader`, `FeedbackAlert`, `countInWeek`, `formatSeconds`; nenhuma dependência sobrando; nenhum `shortcut:` no código ainda).

## 2026-11-03 — Ideias do awesome-android-ui
- Pergunta: o que aproveitar da lista de bibliotecas Android (indicada pelo dono)?
- Contexto: são bibliotecas nativas, sem uso direto no PWA; só as ideias de tela servem.
- Feito: cartão "Primeira vez por aqui?" na tela Hoje (3 dicas, dispensável por aluno), no lugar do tour com tela por cima (ShowcaseView), que é mais código e mais barreira de acessibilidade.
- Já existia: anel de progresso da semana na tela Hoje (`ProgressRing`).
- Não feito: arrastar o cartão do aluno (a ação "WhatsApp" já é botão, gesto escondido briga com a rolagem e pede alternativa por botão) e puxar para atualizar (o PWA já atualiza ao abrir).

## 2026-11-17 — Front geral, segunda leva
- **Perfil:** mensalidade logo abaixo do cartão do atleta, depois ficha de saúde e medidas; "Conquistas" recolhidas (botão com contagem, 44 px); "Preferências" virou "Ajustes".
- **Hoje:** dias da semana saíram do cartão pequeno da meta e viraram faixa própria, com bolinhas de 32 px (antes 20 px, apertadas em 320 px).
- **Exercícios (treinador):** no detalhe, GIF e vídeo vêm primeiro; o 3D (WebGL, pesado) fica recolhido e só monta ao abrir (abre sozinho se não houver GIF nem vídeo).
- **Animação:** molas trocadas por curvas curtas (≤ 320 ms) nos cartões de exercícios, no pódio e nas barras da semana do painel (agora `scaleY`, não `height`).
- **Não feito, de propósito:** menu "⋯" e barra de salvar do construtor de treinos (a barra já é fixa; o menu pede decisão do dono); botão primário único (não recolorir tudo sem o dono decidir); cabeçalho de página único.

## 2026-11-17 — CRN fora da nutrição
- O dono pediu para tirar o CRN. O plano guarda só o nome do nutricionista responsável; o campo some do editor do treinador e da tela do aluno.
- Banco: `supabase/nutricao-plano.sql` agora cria `responsible_crn` opcional e, em bancos que já a tinham obrigatória, faz `alter column ... drop not null`. **O dono precisa rodar esse arquivo de novo no Supabase**; até lá, criar plano novo falha com o aviso amigável (a coluna ainda é obrigatória). Planos antigos mantêm o CRN guardado, mas ele não aparece mais.

## 2026-11-17 — Telas do treinador: revisão
- **Alunos:** no celular o cartão do aluno mostra uma linha de texto ("2 na semana · Treinou ontem") em vez de três etiquetas coloridas; as etiquetas continuam nas colunas do computador. O alerta PAR-Q segue como selo vermelho (é o que pede ação).
- **Avisos:** a prévia "Como o aluno vê" só aparece depois que o treinador começa a escrever (antes mostrava um texto de exemplo ocupando espaço).
- **Ficha do aluno, Financeiro e Radar:** revistos e mantidos; a ficha já tem sete abas rolando, e o financeiro já mostra o que está em atraso primeiro.

## 2026-11-17 — Tela "Nutrição" do treinador
- Pedido do dono: uma tela só com todos os alunos, quem tem plano e quem não tem, para administrar os planos. A entrada é o botão de salada no painel (ao lado da foto) e, no computador, o item "Nutrição" do menu lateral. No menu inferior do celular não entra (já são 5 itens).
- Tela `/admin/nutrition`: busca, filtros "Todos / Com plano / Sem plano" e uma linha por aluno (meta de kcal, número de refeições, última mudança; ou "Criar plano"). Tocar abre o mesmo editor da ficha do aluno (aba Nutrição) numa janela, então criar, ajustar e apagar plano continuam num lugar só. Ao fechar, a lista recarrega.
- Sem o SQL da nutrição a lista de alunos aparece e um aviso diz quais arquivos rodar. Sem mudança de banco.

## 2026-11-23 — Menos poluição visual no app
- Pedido do Jean: o app está "poluído". Regra: cada tela mostra primeiro o que pede ação; enfeite e repetição saem.
- **Hoje (aluno):** saíram as etiquetas de grupos musculares do cartão do treino (o boneco já mostra), a linha "treinos neste mês" e a frase motivacional do cartão da meta; "Como você está hoje" (prontidão) foi para dentro de "Ver mais do seu dia".
- **Nutrição (aluno):** saíram a marca d'água, a faixa de horários (repetia as refeições), os pontos coloridos dos macros, o grupo do alimento em cada item e o brilho da refeição "Próxima".
- **Nutrição (treinador):** saíram a marca d'água do painel de cobertura, o selo de salada no avatar e o brilho e os pontos do resumo do plano.
- **Painel do treinador:** saiu a faixa "Ações rápidas" (o botão + e o menu já levam aos mesmos lugares) e o fundo decorativo do cabeçalho.

## 2026-11-23 — Menu do aluno: Evolução ao lado do treino e Perfil no topo
- Pedido do Jean (com captura de tela): a Evolução deve ficar do lado do treino na barra do aluno, e o Perfil junto das notificações.
- Barra de baixo agora tem 4 abas: Hoje, Evolução, Histórico, Equipe. O Perfil virou um botão ao lado do sino, no cabeçalho. Para caber em celular estreito, o nome "Team Jean" encolhe e, abaixo de 340 px, vira só o logo (continua lido pelo leitor de tela).
