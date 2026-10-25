-- =============================================================================
-- Team Jean — Casamento dos exercícios JÁ CADASTRADOS com os GIFs da biblioteca
-- =============================================================================
-- ATENÇÃO: este arquivo é ESPECÍFICO do banco do Team Jean. Os nomes abaixo
-- são os exercícios que existiam em produção em 25/10/2026, casados um a um
-- (por nome e equipamento) com um item de public/exercicios/biblioteca.json.
-- Em outro banco ele não faz mal (só não acha os nomes), mas também não serve.
--
-- Como usar:
--   1. Rode antes (ou depois, tanto faz) o supabase/exercicios.sql.
--   2. Supabase → SQL Editor → cole este arquivo → Run.
--   3. Pode ser rodado mais de uma vez: só preenche quem ainda está sem GIF
--      ("media_id is null"); nunca troca um GIF já escolhido pelo treinador e
--      nunca renomeia exercício.
--
-- Ficaram SEM GIF (sem equivalente seguro na biblioteca; o treinador pode
-- vincular um à mão em Biblioteca → exercício → Editar → Vincular GIF):
--   Abdução de quadril na polia · Agachamento Tempo 3-2-1 · BICEPS 45 ·
--   BICEPS CURL COMP · Crossover Polia Alta · Elevação Pélvica ·
--   Flexão Nórdica Reversa · Kelson Schurgs · Leg Press Horizontal ·
--   LEVAN. TERRA PAUSA 3 SEC · Prancha · Remada Articulada Neutra ·
--   Remada Articulada Pronada · Supino Pausa Longa 3 segundos ·
--   Supino Tempo 3-2-1
--
-- GIFs: © Gym visual — https://gymvisual.com/
-- =============================================================================

-- A coluna é do supabase/exercicios.sql; repetida aqui para este arquivo
-- funcionar em qualquer ordem.
alter table public.exercises add column if not exists media_id text;

-- nome no app → exercício da biblioteca (em inglês e em português)
-- Supino Reto com Barra → barbell bench press (Supino Reto com Barra)
update public.exercises set media_id = '0025-EIeI8Vf' where lower(name) = lower('Supino Reto com Barra') and media_id is null;
-- SUPINO INCLINADO BARRA → barbell incline bench press (Supino Inclinado com Barra)
update public.exercises set media_id = '0047-3TZduzM' where lower(name) = lower('SUPINO INCLINADO BARRA') and media_id is null;
-- Supino Inclinado com Halteres → dumbbell incline bench press (Supino Inclinado com Halteres)
update public.exercises set media_id = '0314-ns0SIbU' where lower(name) = lower('Supino Inclinado com Halteres') and media_id is null;
-- Supino Inclinado Máquina → lever incline chest press (Supino Inclinado na Máquina)
update public.exercises set media_id = '1299-jHAnWmT' where lower(name) = lower('Supino Inclinado Máquina') and media_id is null;
-- Crucifixo com Halteres → dumbbell fly (Crucifixo Reto com Halteres)
update public.exercises set media_id = '0308-yz9nUhF' where lower(name) = lower('Crucifixo com Halteres') and media_id is null;
-- Crucifixo Máquina → lever seated fly (Crucifixo Sentado na Máquina (Peck Deck))
update public.exercises set media_id = '0596-v3xmPAR' where lower(name) = lower('Crucifixo Máquina') and media_id is null;
-- Crossover na Polia → cable standing up straight crossovers (Crossover em Pé na Polia)
update public.exercises set media_id = '1269-UKWTJWR' where lower(name) = lower('Crossover na Polia') and media_id is null;
-- Puxada Frontal → cable pulldown (Puxada na Polia)
update public.exercises set media_id = '0198-RVwzP10' where lower(name) = lower('Puxada Frontal') and media_id is null;
-- Puxada Frontal (Pulldown) → cable pulldown (Puxada na Polia)
update public.exercises set media_id = '0198-RVwzP10' where lower(name) = lower('Puxada Frontal (Pulldown)') and media_id is null;
-- Puxada alta com Triângulo → cable lateral pulldown with v-bar (Puxada na Polia com Barra V)
update public.exercises set media_id = '2616-4c9BhzB' where lower(name) = lower('Puxada alta com Triângulo') and media_id is null;
-- PUXADA ALTA COM TRIANGULO → cable lateral pulldown with v-bar (Puxada na Polia com Barra V)
update public.exercises set media_id = '2616-4c9BhzB' where lower(name) = lower('PUXADA ALTA COM TRIANGULO') and media_id is null;
-- Barra Fixa → pull-up (Barra Fixa)
update public.exercises set media_id = '0652-lBDjFxJ' where lower(name) = lower('Barra Fixa') and media_id is null;
-- Pull over com Halter → dumbbell pullover (Pullover com Halteres)
update public.exercises set media_id = '0375-9XjtHvS' where lower(name) = lower('Pull over com Halter') and media_id is null;
-- Pull over na polia → cable straight arm pulldown (Pulldown com Braço Estendido na Polia)
update public.exercises set media_id = '0238-x69MAlq' where lower(name) = lower('Pull over na polia') and media_id is null;
-- Remada Baixa → cable low seated row (Remada Baixa Sentado na Polia)
update public.exercises set media_id = '0180-hvV79Si' where lower(name) = lower('Remada Baixa') and media_id is null;
-- Remada Curvada → barbell bent over row (Remada Curvada com Barra)
update public.exercises set media_id = '0027-eZyBC3j' where lower(name) = lower('Remada Curvada') and media_id is null;
-- Remada Curvada com Barra → barbell bent over row (Remada Curvada com Barra)
update public.exercises set media_id = '0027-eZyBC3j' where lower(name) = lower('Remada Curvada com Barra') and media_id is null;
-- Remada Pendlay → barbell pendlay row (Remada Pendlay com Barra)
update public.exercises set media_id = '3017-r0z6xzQ' where lower(name) = lower('Remada Pendlay') and media_id is null;
-- REMADA T → lever t bar row (Remada Cavalinho na Máquina)
update public.exercises set media_id = '0606-aaXr7ld' where lower(name) = lower('REMADA T') and media_id is null;
-- Hiperextensão Lombar no Banco Romano → hyperextension (Extensão Lombar)
update public.exercises set media_id = '0489-zhMwOwE' where lower(name) = lower('Hiperextensão Lombar no Banco Romano') and media_id is null;
-- Desenvolvimento com Halteres → dumbbell seated shoulder press (Desenvolvimento Sentado com Halteres)
update public.exercises set media_id = '0405-znQUdHY' where lower(name) = lower('Desenvolvimento com Halteres') and media_id is null;
-- Desenvolvimento Máquina → lever shoulder press (Desenvolvimento de Ombros na Máquina)
update public.exercises set media_id = '0603-67n3r98' where lower(name) = lower('Desenvolvimento Máquina') and media_id is null;
-- Elevação Lateral → dumbbell lateral raise (Elevação Lateral com Halteres)
update public.exercises set media_id = '0334-DsgkuIt' where lower(name) = lower('Elevação Lateral') and media_id is null;
-- ELEVAÇÃO FRONTAL → dumbbell front raise (Elevação Frontal com Halteres)
update public.exercises set media_id = '0310-3eGE2JC' where lower(name) = lower('ELEVAÇÃO FRONTAL') and media_id is null;
-- Crucifixo Invertido → dumbbell reverse fly (Crucifixo Inverso com Halteres)
update public.exercises set media_id = '0383-EAs3xL9' where lower(name) = lower('Crucifixo Invertido') and media_id is null;
-- Crucifixo Inverso Máquina → lever seated reverse fly (Crucifixo Inverso Sentado na Máquina)
update public.exercises set media_id = '0602-myfUsKf' where lower(name) = lower('Crucifixo Inverso Máquina') and media_id is null;
-- Rosca Direta com Barra → barbell curl (Rosca Direta com Barra)
update public.exercises set media_id = '0031-25GPyDY' where lower(name) = lower('Rosca Direta com Barra') and media_id is null;
-- Rosca Martelo → dumbbell hammer curl (Rosca Martelo com Halteres)
update public.exercises set media_id = '0313-slDvUAU' where lower(name) = lower('Rosca Martelo') and media_id is null;
-- Tríceps na Polia com Corda → cable pushdown (with rope attachment) (Tríceps Pulley com Corda)
update public.exercises set media_id = '0200-dU605di' where lower(name) = lower('Tríceps na Polia com Corda') and media_id is null;
-- Tríceps Pulley (Corda) → cable pushdown (with rope attachment) (Tríceps Pulley com Corda)
update public.exercises set media_id = '0200-dU605di' where lower(name) = lower('Tríceps Pulley (Corda)') and media_id is null;
-- Tríceps Testa → barbell lying triceps extension skull crusher (Tríceps Testa com Barra)
update public.exercises set media_id = '0060-h8LFzo9' where lower(name) = lower('Tríceps Testa') and media_id is null;
-- TRICEPS FRANCES → dumbbell seated triceps extension (Tríceps Francês Sentado com Halteres)
update public.exercises set media_id = '2188-kont8Ut' where lower(name) = lower('TRICEPS FRANCES') and media_id is null;
-- Barra Paralela → triceps dip (Mergulho para Tríceps)
update public.exercises set media_id = '0814-X6C6i5Y' where lower(name) = lower('Barra Paralela') and media_id is null;
-- Agachamento Livre → barbell full squat (Agachamento Completo com Barra)
update public.exercises set media_id = '0043-qXTaZnJ' where lower(name) = lower('Agachamento Livre') and media_id is null;
-- Leg Press 45º → sled 45° leg press (Leg Press 45)
update public.exercises set media_id = '0739-10Z2DXU' where lower(name) = lower('Leg Press 45º') and media_id is null;
-- Leg press → sled 45° leg press (Leg Press 45)
update public.exercises set media_id = '0739-10Z2DXU' where lower(name) = lower('Leg press') and media_id is null;
-- Leg Press Horizontal Unilateral → lever horizontal one leg press (Leg Press Horizontal Unilateral na Máquina)
update public.exercises set media_id = '2611-9KU9TYF' where lower(name) = lower('Leg Press Horizontal Unilateral') and media_id is null;
-- Hack squat → sled hack squat (Hack)
update public.exercises set media_id = '0743-Qa55kX1' where lower(name) = lower('Hack squat') and media_id is null;
-- Búlgaro com Halteres → dumbbell single leg split squat (Agachamento Búlgaro Unilateral com Halteres)
update public.exercises set media_id = '0410-qx4fgX7' where lower(name) = lower('Búlgaro com Halteres') and media_id is null;
-- Búlgaro no Smith → smith single leg split squat (Agachamento Búlgaro Unilateral no Smith)
update public.exercises set media_id = '0768-wWFspEi' where lower(name) = lower('Búlgaro no Smith') and media_id is null;
-- Cadeira Extensora → lever leg extension (Cadeira Extensora na Máquina)
update public.exercises set media_id = '0585-my33uHU' where lower(name) = lower('Cadeira Extensora') and media_id is null;
-- Cadeira Flexora → lever seated leg curl (Cadeira Flexora na Máquina)
update public.exercises set media_id = '0599-Zg3XY7P' where lower(name) = lower('Cadeira Flexora') and media_id is null;
-- Mesa Flexora → lever lying leg curl (Mesa Flexora Deitado na Máquina)
update public.exercises set media_id = '0586-17lJ1kr' where lower(name) = lower('Mesa Flexora') and media_id is null;
-- Stiff com Barra → barbell straight leg deadlift (Stiff com Barra)
update public.exercises set media_id = '0116-hrVQWvE' where lower(name) = lower('Stiff com Barra') and media_id is null;
-- RDL → barbell romanian deadlift (Stiff Romeno com Barra)
update public.exercises set media_id = '0085-wQ2c4XD' where lower(name) = lower('RDL') and media_id is null;
-- Levantamento Terra Convencional → barbell deadlift (Levantamento Terra com Barra)
update public.exercises set media_id = '0032-ila4NZS' where lower(name) = lower('Levantamento Terra Convencional') and media_id is null;
-- Cadeira Abdutora → lever seated hip abduction (Cadeira Abdutora na Máquina)
update public.exercises set media_id = '0597-CHpahtl' where lower(name) = lower('Cadeira Abdutora') and media_id is null;
-- Cadeira adutora → lever seated hip adduction (Cadeira Adutora na Máquina)
update public.exercises set media_id = '0598-oHsrypV' where lower(name) = lower('Cadeira adutora') and media_id is null;
-- Extensão de quadril na polia → cable standing hip extension (Extensão de Quadril em Pé na Polia)
update public.exercises set media_id = '0228-Kpajagk' where lower(name) = lower('Extensão de quadril na polia') and media_id is null;
-- Panturrilha em Pé → lever standing calf raise (Panturrilha em Pé na Máquina)
update public.exercises set media_id = '0605-ykUOVze' where lower(name) = lower('Panturrilha em Pé') and media_id is null;
-- Abdominal Supra → crunch floor (Abdominal no Chão)
update public.exercises set media_id = '0274-TFqbd8t' where lower(name) = lower('Abdominal Supra') and media_id is null;
