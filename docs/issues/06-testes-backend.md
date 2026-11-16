---
title: "Testes automatizados do backend (unitários e de integração)"
labels: tech-debt, testes, backend, P0
---

## Contexto

O projeto **não tem nenhum teste automatizado** (não há script `test` nem framework instalado). Já houve bugs de concorrência e de regra de negócio corrigidos só por revisão manual (cancelar × pagar, entrar duas vezes na sala, iniciar × cancelar partida). Sem testes, qualquer refatoração é arriscada, e as regras mais sensíveis — dinheiro, ranking e horários — não têm rede de segurança.

O código foi escrito pensando nisso: há funções **puras** fáceis de testar e serviços que recebem `now` como parâmetro.

## Objetivo

Montar a infraestrutura de testes e cobrir primeiro o que dói mais se quebrar.

## Escopo

### Infraestrutura
- [ ] Adicionar **Vitest** + `supertest`; scripts `test`, `test:watch`, `test:coverage`.
- [ ] Banco de teste **PostgreSQL real** (as regras críticas dependem de `EXCLUDE USING gist` e `FOR UPDATE`, que SQLite/mocks não reproduzem). Usar o `docker-compose.yml` existente (serviço separado ou schema `test`), com `prisma migrate deploy` antes da suíte e limpeza entre testes.
- [ ] Helpers de fábrica (`makeUser`, `makeCourt`, `makeBooking`, `makeMatch`) e relógio injetável (os services já aceitam `now`).
- [ ] `createApp()` já existe separado de `server.ts` exatamente para `supertest` — usar.

### Unitários (funções puras — rápidos)
- [ ] `rating/elo.service.ts`: probabilidade esperada, delta, soma zero, piso `MIN_ELO`, vitória de zebra vale mais, times 1x1 e 2x2.
- [ ] `rating/categories.ts`: **todas as bordas** (1199/1200, 1399/1400, 1599/1600, 1799/1800), `progress`, `pointsToGo`, categoria máxima.
- [ ] `bookings/slot-rules.ts`: grade de horários, slots de 90 min, fechamento à meia-noite, alinhamento, duração máxima, antecedência máxima, passado.
- [ ] `shared/utils/timezone.ts`: conversões local↔UTC, **dias de horário de verão** (23 h / 25 h), virada de dia.
- [ ] `pricing/pricing.ts`: precedência (quadra > arena, maior preço no empate), janelas que cruzam a meia-noite (`00:00`), reserva que atravessa duas faixas de preço (17h–19h com nobre às 18h).
- [ ] `admin/admin.schemas.ts`: validação das regras de preço e dos bloqueios.

### Integração (com banco real)
- [ ] **Reservas**: dois `POST /bookings` simultâneos para o mesmo horário → um 201 e um 409 (constraint `bookings_no_overlap`).
- [ ] **Pagamento × expiração**: `confirmPayment` e `expireOverdue` concorrentes nunca deixam `CONFIRMED` + `CANCELLED`.
- [ ] **Cancelamento × pagamento** (bug já corrigido: `cancel` com `expectedStatus`) — regressão.
- [ ] **Partidas**: entrar duas vezes na mesma sala (idempotente), sala cheia sob concorrência, `start` × `cancel` simultâneos, `recordResult` duas vezes (segundo → 409 e ELO aplicado **uma vez**).
- [ ] **Admin**: 403 para não-admin em **todas** as rotas `/admin/*`; admin A não enxerga arena do admin B; bloqueio recusado quando há reserva; `PUT /pricing` transacional (falha no meio não aplica nada).
- [ ] **Relatórios**: números conferidos contra um cenário pequeno montado à mão (faturamento, ocupação com bloqueio descontado, hora de pico).
- [ ] **Auth**: cadastro com e-mail duplicado simultâneo → 409 amigável; login com e-mail inexistente e senha errada têm a mesma resposta.

## Critérios de aceite

- [ ] `npm test` roda tudo localmente e no CI em < 2 min.
- [ ] Cobertura mínima de **90 %** nas funções puras listadas e **todos** os cenários de concorrência acima presentes.
- [ ] Cada bug corrigido no futuro entra com um teste de regressão (adicionar ao guia de contribuição).
- [ ] README explica como subir o banco de teste.

## Fora de escopo

- Testes de interface (issue separada: testes do frontend e E2E).
- Testes de carga.

## Depende de / relacionado

- "CI com GitHub Actions" (roda esta suíte).
