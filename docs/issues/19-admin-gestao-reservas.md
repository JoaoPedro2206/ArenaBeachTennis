---
title: "Painel do dono: gerenciar reservas (criar no balcão, cancelar, remanejar, no-show)"
labels: feature, admin, backend, frontend, P0
---

## Contexto

O painel do dono (`/admin`) hoje é de **leitura e bloqueio**: mostra a agenda do dia, relatórios e permite bloquear horários e configurar preços. Mas o dono ainda **não consegue operar as reservas**:

- Cliente liga/chama no WhatsApp para reservar → o dono não tem como lançar a reserva (só o próprio jogador reserva pelo app).
- Cliente pede para cancelar/remarcar por fora do app → o dono não consegue.
- Ao bloquear um horário que **já tem reserva**, o sistema recusa e lista os conflitos (correto, nunca derruba reserva de cliente sozinho), mas **não oferece o caminho** para resolver.
- Colocar uma quadra em manutenção avisa quantas reservas futuras existem, mas não há como vê-las e tratá-las em lote.
- `BookingStatus.NO_SHOW` e `COMPLETED` existem, mas **nada marca** reservas passadas como realizadas ou faltas (só partidas finalizadas viram `COMPLETED`).

Base disponível: `AdminService.getAgenda`, `BookingsRepository` (`cancel` com `expectedStatus`, `expireOverdue`), `PricingRule`s para o preço, política de cancelamento (`booking-policy.ts`) e diálogos da agenda (`AgendaDialogs.tsx`).

## Objetivo

O dono consegue operar o dia a dia inteiro pelo painel, sem precisar de acesso ao banco nem do app do cliente.

## Escopo

### Backend (`/admin/*`, `ARENA_ADMIN`, restrito à própria arena)
- [ ] `POST /admin/bookings` — **reserva manual** em nome de um cliente: busca por nome/e-mail/telefone ou **cliente avulso** sem conta (nome + telefone). Define status de pagamento (pago no balcão / a pagar) e forma (dinheiro/Pix/cartão presencial). Usa o **mesmo cálculo de preço** (`priceForRange`) com opção de **desconto/valor customizado** (registrando o motivo).
  - Requer decisão de modelo para cliente sem conta (ex.: `User` "convidado" com `role PLAYER` sem senha, ou campos `guestName/guestPhone` na reserva).
- [ ] `POST /admin/bookings/:id/cancel` — cancela reserva de cliente **ignorando** o prazo de 24 h (decisão do dono), com motivo e opção de estorno integral/parcial/nenhum; registra quem cancelou.
- [ ] `POST /admin/bookings/:id/reschedule { courtId, startTime }` — move para outro horário/quadra **numa transação** (cancela o antigo + cria o novo sem janela em que o horário fique livre); recalcula/mantém o valor conforme regra escolhida. (O schema já tem `Booking.rescheduledFrom/rescheduledTo`.)
- [ ] `POST /admin/bookings/:id/status { status: COMPLETED | NO_SHOW }` e **job** que marca automaticamente reservas pagas passadas como `COMPLETED` (se não houver partida/marcação manual).
- [ ] `POST /admin/bookings/:id/mark-paid` — confirmar pagamento recebido no balcão.
- [ ] `GET /admin/bookings?from=&to=&status=&q=` — lista paginada com filtros (para a tela de reservas e para resolver conflitos de bloqueio).
- [ ] **Resolver conflitos de bloqueio**: `POST /admin/block` aceita `{ resolveConflicts: 'CANCEL_AND_REFUND' | 'KEEP' }` com confirmação explícita e notificação aos clientes afetados.
- [ ] Toda ação grava **log de auditoria** (quem, o quê, quando, valores antes/depois).

### Frontend
- [ ] Na agenda: **clicar num horário livre** abre escolha entre **Reservar para cliente** e **Bloquear** (hoje só bloqueia).
- [ ] Diálogo de reserva manual com busca de cliente, preço calculado (editável com motivo), forma de pagamento.
- [ ] No detalhe da reserva: **Cancelar**, **Remarcar** (seletor de quadra/horário mostrando só horários livres), **Marcar como paga**, **Falta (no-show)**, com confirmação e resumo do impacto financeiro.
- [ ] Nova tela **Reservas** (lista/tabela com filtros e busca) e atalho "Ver reservas desta quadra" ao colocá-la em manutenção.
- [ ] Fluxo guiado para **conflito de bloqueio**: lista as reservas afetadas com ações em lote (avisar, remanejar, cancelar com estorno).

## Critérios de aceite

- [ ] Reserva manual respeita a constraint anti-sobreposição (duas ao mesmo tempo → uma recusada, teste de concorrência).
- [ ] Remanejar nunca deixa o cliente sem horário: se o novo falhar, o antigo permanece.
- [ ] Ações de admin só funcionam em reservas **da própria arena** (teste de IDOR com dois donos).
- [ ] Cancelamento com estorno chama o provedor de pagamento (quando existir) e só marca `REFUNDED` após confirmação.
- [ ] Todas as ações aparecem no log de auditoria e na linha do tempo da reserva.
- [ ] Relatórios do dashboard refletem as novas reservas/cancelamentos/no-shows.

## Fora de escopo

- Reservas recorrentes (issue separada).
- Emissão de nota fiscal.

## Depende de / relacionado

- "Pagamento real" (estornos), "Notificações" (avisar clientes), "Reservas recorrentes".
- "Testes automatizados do backend".
