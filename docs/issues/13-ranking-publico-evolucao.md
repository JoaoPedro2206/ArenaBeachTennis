---
title: "Ranking público por arena, evolução do ELO e conquistas"
labels: feature, ranking, backend, frontend, P1
---

## Contexto

O jogador vê **seu** ELO, a medalha da categoria e a barra de progresso no perfil, mais as últimas 20 partidas com a variação de pontos. Mas **não existe ranking coletivo**: não dá para ver quem lidera, em que posição você está na sua arena, nem como sua pontuação evoluiu no tempo. Competição social é o que faz as pessoas voltarem.

Dados já disponíveis: `User.eloScore`, e por partida `MatchParticipant.eloBefore/eloAfter/eloDelta`, `MatchResult.winnerExpected` (permite identificar "zebras") e `finishedAt`.

## Objetivo

Criar o ciclo "jogo → subo no ranking → quero jogar mais", com visibilidade controlada pela privacidade do jogador.

## Escopo

### Backend
- [ ] `GET /rankings?arenaId=&category=&period=` — lista paginada ordenada por ELO, com posição, nome, foto, categoria, ELO e variação no período. Filtros: arena, categoria (A–D, Iniciante), período (semana / mês / geral).
- [ ] Definir **o que é "da arena"**: jogadores que jogaram partidas pontuadas em reservas daquela arena (derivável de `MatchSession → Booking → Court → Arena`). Evitar consulta pesada: avaliar tabela/materialized view `arena_player_stats` atualizada na aplicação do resultado.
- [ ] `GET /users/:id/rating-history` — série temporal de ELO (um ponto por partida pontuada).
- [ ] `GET /users/:id/stats` — partidas, vitórias, derrotas, % de vitória, maior sequência, zebras, parceiros mais frequentes.
- [ ] Índices para os filtros (já existe `@@index([eloScore])` em `User`).
- [ ] **Privacidade**: `User.showInRankings` (padrão `true`); quem optar por sair não aparece em listas públicas e perfis de terceiros mostram só o primeiro nome.

### Frontend
- [ ] Nova aba/página **Ranking** (ou seção em Início) com filtros de categoria e período, destaque do pódio (top 3) e a **sua posição** fixa no rodapé ("Você: 12º").
- [ ] **Gráfico de evolução do ELO** no perfil (linha, com marcadores nas viradas de categoria e tooltip por partida) — seguir o guia de dataviz já usado no painel (um gráfico, eixo único, grade discreta, tabela acessível).
- [ ] Cartões de estatísticas no perfil (vitórias, % de vitória, sequência, zebras).
- [ ] **Conquistas** (badges): "Primeira vitória", "5 vitórias seguidas", "Zebra" (vencer com < 40% de chance), "Subiu de categoria", "10/50/100 partidas". Persistir em `user_achievements` e mostrar no perfil; notificar ao desbloquear.
- [ ] Compartilhar cartão de conquista/subida de categoria como imagem (Web Share API) — bom para divulgação orgânica.

## Critérios de aceite

- [ ] Ranking de 1.000 jogadores responde em < 300 ms (paginado).
- [ ] Jogador que desativa `showInRankings` some das listas imediatamente.
- [ ] Gráfico mostra todas as partidas pontuadas e coincide com `eloAfter` da última.
- [ ] Conquistas são concedidas **uma única vez** e de forma idempotente (aplicação do resultado pode ser reprocessada sem duplicar).
- [ ] Páginas funcionam em 375 px e têm versão acessível (tabela para leitores de tela).

## Fora de escopo

- Ligas, temporadas e premiações (possível evolução, junto com torneios).
- Ranking nacional entre arenas.

## Depende de / relacionado

- "Ranking: confirmação do resultado" (só resultados confirmados entram).
- "Notificações".
- "Privacidade e LGPD" (opt-out).
