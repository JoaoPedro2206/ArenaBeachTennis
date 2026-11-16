---
title: "Ranking: confirmação do resultado pelos adversários e contestação"
labels: feature, ranking, backend, frontend, P0
---

## Contexto

O ELO é o diferencial do produto, e a credibilidade dele depende de o resultado ser honesto. Hoje **só o anfitrião** (quem abriu a sala) registra o resultado (`MatchesService.recordResult` → `findHosted`): ele escolhe as duplas e quem venceu, e o ELO dos 4 jogadores é aplicado imediatamente, sem ninguém concordar.

Isso permite:
- o anfitrião **inverter o vencedor** ou montar duplas falsas para subir de categoria (ou derrubar um desafeto);
- erro honesto (clicou na dupla errada) **sem como desfazer** — o `MatchResult` é imutável e a sala já está encerrada;
- combinar partidas falsas entre amigos para "farmar" pontos (ver issue de anti-abuso).

O que já existe: tela `ResultSheet` com prévia de pontos, `MatchResult` (com `winnerDelta`, `loserDelta`, `kFactor`), snapshot por jogador (`eloBefore/eloAfter/eloDelta`) e transação com travas `FOR UPDATE`.

## Objetivo

O resultado só vale depois que os **adversários** concordam (ou o prazo de contestação passa), e erros podem ser corrigidos com rastreabilidade.

## Proposta de fluxo

1. Anfitrião registra o resultado → estado **`PENDING_CONFIRMATION`** (nenhum ELO muda ainda).
2. Notificar os jogadores do **time adversário ao do anfitrião** (e, opcionalmente, o parceiro): "Confirme: sua dupla perdeu por X".
3. **Um** jogador de cada dupla adversária confirma → resultado **aplicado** (ELO atualizado numa transação, como hoje).
4. Se alguém **contesta**: estado `DISPUTED`, ninguém pontua, e o caso vai para análise do dono da arena (`ARENA_ADMIN`), que decide (confirmar como está / corrigir / anular).
5. Se ninguém responde em **24–48 h**: confirmação automática (para não travar o ranking quando alguém some) — prazo configurável.
6. Time que **perdeu** confirmando é o caso comum e deve ser de 1 toque.

## Escopo

### Backend
- [ ] Novos estados na partida/resultado (ex.: `MatchResult.status`: `PENDING | CONFIRMED | DISPUTED | VOIDED`) + `confirmedById`, `confirmedAt`, `disputedById`, `disputeReason`.
- [ ] `recordResult` passa a **propor**; novo `POST /matches/:id/result/confirm` e `POST /matches/:id/result/dispute { reason }`.
- [ ] A aplicação do ELO (hoje dentro de `recordResult`) é extraída para `applyResult(matchId)` chamada na confirmação — **mesma transação travada** e mesma garantia de aplicar uma única vez.
- [ ] Job de confirmação automática por prazo (reaproveitar o padrão do `BookingExpirationWorker`).
- [ ] Admin: `GET /admin/disputes` e `POST /admin/disputes/:id/resolve { action: CONFIRM | CORRECT | VOID, teams?, winnerTeam? }`.
- [ ] **Anular/corrigir resultado já aplicado**: reverter o ELO usando o snapshot (`eloBefore`) e recalcular as partidas posteriores dos mesmos jogadores **ou** (mais simples e recomendado) aplicar um **ajuste compensatório** registrado em tabela `elo_adjustments` (motivo, quem, quando), preservando o histórico.
- [ ] Auditoria: todo registro/confirmação/contestação/resolução gera linha em log de auditoria.

### Frontend
- [ ] Sala: após o anfitrião propor, mostrar aos demais "Aguardando confirmação" e, para o adversário, um cartão grande **Confirmar** / **Contestar**.
- [ ] Tela de contestação com motivo curto.
- [ ] Painel do dono: fila de contestações com os dados da partida (jogadores, ELO, quem registrou) e ações.
- [ ] Histórico do perfil: partidas pendentes aparecem como "aguardando confirmação" (sem delta ainda).

## Critérios de aceite

- [ ] Nenhum ELO muda enquanto o resultado está `PENDING` (teste automatizado).
- [ ] Confirmar duas vezes não aplica o ELO duas vezes (concorrência).
- [ ] Anfitrião não consegue confirmar o próprio resultado (precisa de alguém do outro time).
- [ ] Confirmação automática após o prazo funciona e é auditada.
- [ ] Resultado contestado e anulado deixa o ranking consistente com o histórico (teste: ELO final = ELO sem a partida).
- [ ] `ResultSheet` continua mostrando a prévia de pontos.

## Decisões de produto a fechar

- Prazo de confirmação automática (sugestão: 24 h).
- Quem precisa confirmar: 1 jogador adversário (sugestão) ou ambos.
- Reservas sem adversário cadastrado no app (ex.: convidado sem conta) — ficam fora do ranking.

## Fora de escopo

- Partidas amistosas sem ranking (já existe "Encerrar sem pontuar").
- Detecção automática de fraude (ver issue de anti-abuso).

## Depende de / relacionado

- "Notificações" (avisar quem precisa confirmar).
- "Ranking: calibração, K dinâmico e anti-abuso".
- "Testes automatizados do backend".
