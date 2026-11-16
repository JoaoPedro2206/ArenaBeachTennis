---
title: "Ranking: calibração (K dinâmico), ponderação por jogador e anti-abuso"
labels: feature, ranking, backend, P1
---

## Contexto

O algoritmo atual (`modules/rating/elo.service.ts`) é um ELO clássico de duplas:
- Força da dupla = **média** do ELO dos dois jogadores (arredondada).
- Probabilidade esperada `E = 1 / (1 + 10^((Rb − Ra)/400))`.
- **K fixo = 32** para todos.
- Todos os jogadores da dupla recebem **o mesmo delta**; soma zero; piso `MIN_ELO = 100`; vitória vale no mínimo 1 ponto.
- Todo jogador novo começa em **1000** (Iniciante).

Limitações observadas:
1. **Cálculo demora a convergir**: um jogador novo forte leva muitas partidas para chegar à categoria correta, e enquanto isso distorce o ELO dos adversários.
2. **Mesmo delta para a dupla** ignora a diferença entre parceiros: um jogador de 1800 que joga com um de 1000 e perde ganha/perde igual ao parceiro, o que é injusto com o mais fraco (que "carregou" menos) e com o mais forte.
3. **Sem proteção contra farm**: combinar partidas repetidas contra a mesma pessoa/dupla (ou entre contas de amigos) infla pontos.
4. **Sem inatividade**: quem para de jogar mantém o ELO para sempre.
5. Placar/margem de vitória não influencia (2×0 vale como 2×1).

## Objetivo

Um ranking que **converge rápido**, **resiste a manipulação** e se mantém justo — sem perder a simplicidade que o jogador entende ("vencer quem está acima vale mais").

## Escopo

### 1. Calibração (K dinâmico)
- [ ] Contar partidas pontuadas por jogador (`User.ratedMatches`, derivável de `MatchParticipant` com `eloDelta` não nulo, mas é melhor persistir).
- [ ] K maior no início: ex. **K = 48 nas primeiras 10 partidas**, 32 até 30 partidas, **24** depois (parametrizar em `elo.service.ts`).
- [ ] Na dupla, usar o K de cada jogador separadamente (jogador novo se move mais que o veterano na mesma partida) — mantendo soma aproximadamente zero ou documentando a inflação/deflação aceita.
- [ ] Mostrar no perfil "Ranking provisório (X/10 partidas)" enquanto calibra.

### 2. Ponderação por jogador na dupla
- [ ] Avaliar variante em que o delta individual é proporcional à diferença entre o ELO do jogador e a média da dupla (jogador acima da média arrisca/ganha um pouco mais; abaixo, um pouco menos), com limites para não distorcer.
- [ ] Simulador (script em `scripts/`) que roda milhares de partidas sintéticas e compara convergência/estabilidade das variantes antes de escolher.

### 3. Anti-abuso
- [ ] **Rendimento decrescente** contra o mesmo adversário/dupla: a partir da N-ésima partida na mesma semana, o delta é multiplicado por fator < 1 (ex.: 1.0, 1.0, 0.5, 0.25, 0).
- [ ] Alerta/sinalização ao dono da arena para padrões suspeitos: mesmos 4 jogadores repetidos, vitórias sempre do mesmo lado, partidas com duração implausível (`startedAt`→`finishedAt` muito curta).
- [ ] Limite diário de partidas pontuadas por jogador (ex.: 6).
- [ ] Exigir que a partida tenha uma **reserva paga** (já é regra: a sala nasce de uma reserva `CONFIRMED`) e que os 4 jogadores sejam contas distintas **com e-mail verificado**.

### 4. Inatividade
- [ ] Decaimento suave opcional para quem fica > 90 dias sem jogar (ex.: aumentar a incerteza/K na volta em vez de reduzir pontos). Decisão de produto.

### 5. Transparência
- [ ] Tela "Como funciona o ranking" explicando fórmula, K, faixas de categoria e proteções.
- [ ] `MatchResult` já guarda `kFactor` e `winnerExpected`; adicionar os fatores aplicados (calibração, anti-farm) para auditoria.

## Critérios de aceite

- [ ] Simulação mostra que jogadores novos chegam à faixa correta em **menos partidas** que o K fixo atual (métrica documentada no PR).
- [ ] Testes unitários cobrem cada fator e a soma/limites do delta.
- [ ] Repetir a mesma partida 10× entre os mesmos 4 jogadores não rende mais do que o limite configurado.
- [ ] Mudanças **não** alteram partidas já registradas (histórico imutável; novas regras valem daqui para frente).
- [ ] Documento `docs/ranking.md` com a fórmula final e os parâmetros.

## Fora de escopo

- Substituir ELO por Glicko-2/TrueSkill (pode ser uma evolução futura; esta issue mantém ELO).
- Rankings por modalidade (simples × duplas).

## Depende de / relacionado

- "Ranking: confirmação do resultado pelos adversários".
- "Testes automatizados do backend".
