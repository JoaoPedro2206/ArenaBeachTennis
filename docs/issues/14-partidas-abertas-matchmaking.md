---
title: "Partidas abertas: encontrar jogadores da sua categoria"
labels: feature, partidas, backend, frontend, P1
---

## Contexto

Hoje uma partida só nasce de uma reserva **do próprio anfitrião** e só entra quem recebe o PIN dele de forma privada. Quem não tem turma fixa não tem como jogar. O schema **já prevê** o matchmaking e boa parte está sem uso:

- `MatchSession.isPublic`, `minLevel`, `maxLevel`, `requiresApproval`, `title`, `description`, `format` (`SINGLES`/`DOUBLES`), `maxPlayers`.
- `MatchParticipant.status` (`PENDING`, `CONFIRMED`, `DECLINED`, `LEFT`).
- `BookingType.OPEN_MATCH`.

O que existe de lobby: PIN de 6 dígitos, entrada por PIN, polling da sala, início, registro de resultado com ELO.

## Objetivo

Permitir publicar uma vaga ("falta 1 para fechar quarteto") e descobrir partidas abertas compatíveis com a categoria do jogador.

## Escopo

### Backend
- [ ] Ao abrir a sala, opção **"Tornar pública"** com: título, descrição curta, faixa de categoria aceita (`minLevel`–`maxLevel`, default = categoria do anfitrião ±1) e se requer aprovação.
- [ ] `GET /matches/open?arenaId=&date=&category=` — salas públicas `WAITING` com vagas, ordenadas por proximidade de horário e compatibilidade de categoria; **não expor o PIN**.
- [ ] `POST /matches/:id/request-join` — entra direto (`CONFIRMED`) ou como `PENDING` quando `requiresApproval`; **valida a faixa de categoria** pelo ELO atual (a categoria é derivada, não é coluna).
- [ ] `POST /matches/:id/participants/:userId/approve|decline` (anfitrião).
- [ ] Respeitar a regra existente: **uma partida ao vivo por vez** por jogador (`ensureNotInAnotherMatch`) e a lotação com trava `FOR UPDATE` (já usada em `join`).
- [ ] Expirar salas públicas quando o horário passa (o `cancelStale` já existe).
- [ ] Anfitrião pode **remover** participante antes de iniciar.

### Frontend
- [ ] Nova seção "Partidas abertas" em **Ao Vivo**: cartões com quadra, horário, vagas (`2/4`), categorias aceitas, avatares de quem já entrou, botão **Pedir para entrar / Entrar**.
- [ ] Filtros: dia, categoria, arena.
- [ ] No lobby do anfitrião: lista de **pedidos pendentes** com aprovar/recusar.
- [ ] Mensagens claras de elegibilidade ("Esta partida é para as categorias C e B — você é D").
- [ ] Estado vazio útil: "Nenhuma partida aberta — abra a sua reserva e publique a vaga."

### Regras de negócio a fechar
- [ ] Uma reserva pode virar partida pública **antes** do horário de abertura da sala (hoje a sala abre 2 h antes — `LOBBY_OPENS_BEFORE_MIN`)? Provável: separar "publicar vaga" (a qualquer momento) de "abrir sala/PIN".
- [ ] Reserva `OPEN_MATCH` vs `REGULAR`: usar o tipo existente para distinguir.

## Critérios de aceite

- [ ] Jogador fora da faixa de categoria recebe 422 com mensagem clara (teste automatizado).
- [ ] Duas pessoas pedindo a última vaga ao mesmo tempo: só uma entra (teste de concorrência).
- [ ] PIN nunca aparece na listagem pública.
- [ ] Anfitrião recebe aviso quando alguém pede para entrar (depende de Notificações; até lá, contador na tela).
- [ ] Fluxo existente de PIN continua funcionando sem alterações.

## Fora de escopo

- Pagamento dividido entre os jogadores (issue separada).
- Reputação/avaliação de jogadores.

## Depende de / relacionado

- "Dividir o valor da quadra entre os jogadores".
- "Notificações".
- "WebSocket no lugar do polling".
