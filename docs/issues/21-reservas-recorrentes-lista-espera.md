---
title: "Reservas recorrentes (mensalistas) e lista de espera"
labels: feature, backend, frontend, P2
---

## Contexto

Dois comportamentos muito comuns em arenas ainda não existem:

1. **Mensalistas / horário fixo**: "toda quinta às 19h na Quadra 1". Hoje o jogador precisa reservar semana a semana (e pagar 15 min depois de cada uma). As **aulas** já têm recorrência (`seriesId`, tudo-ou-nada, N semanas), mas as reservas comuns não.
2. **Lista de espera**: quando o horário desejado está ocupado, o jogador simplesmente desiste. Se a reserva é cancelada (ou expira o pagamento — o worker libera o horário), ninguém é avisado.

Base técnica: constraint anti-sobreposição (`bookings_no_overlap`), `expireOverdue` (libera horários), `priceForRange` (preço por faixa), `LessonsService.createLesson` (padrão de série tudo-ou-nada).

## Objetivo

Reduzir o atrito de quem joga sempre no mesmo horário e recuperar reservas perdidas.

## Escopo

### A. Reservas recorrentes
- [ ] Modelo: `BookingSeries` (id, userId, courtId, dia da semana, horário, duração, início, fim/nº de semanas, status, política de pagamento) e `Booking.seriesId`.
- [ ] `POST /bookings/series` cria as próximas **N ocorrências** (sugestão: 4–12 semanas) numa transação; **recusa tudo** se alguma data conflitar e informa quais (padrão das aulas).
- [ ] **Política de pagamento** (decisão de produto): (a) pagar cada ocorrência com antecedência (ex.: 72 h antes; se não pagar, a ocorrência é liberada **sem derrubar a série**); (b) pagar o mês adiantado com desconto; (c) assinatura recorrente no gateway.
- [ ] Preço **congelado** na criação (preço de mensalista) ou segue as regras vigentes? Decidir e documentar; reservas já criadas mantêm o valor.
- [ ] Gerar novas ocorrências continuamente (job que mantém sempre "N semanas à frente").
- [ ] Cancelar **uma** ocorrência (respeitando a regra de 24 h) ou **a série** a partir de uma data; pular feriado.
- [ ] Dono também pode criar séries para clientes (integra com o painel de reservas) e bloquear série para manutenção.
- [ ] Tela "Meus horários fixos" para o jogador, com próximas ocorrências e status de pagamento de cada uma.

### B. Lista de espera
- [ ] `WaitlistEntry` (userId, courtId ou "qualquer quadra", data, faixa de horário, createdAt, status).
- [ ] No horário ocupado, botão **"Avisar-me se liberar"**.
- [ ] Quando um horário é liberado (cancelamento, expiração, bloqueio removido), notificar a fila **em ordem**, com janela exclusiva curta (ex.: 10 min) para o primeiro reservar; depois passa ao próximo. Evita corrida entre vários notificados.
- [ ] Remover automaticamente a entrada quando o horário passa ou o usuário reserva.
- [ ] Limite de entradas por usuário.

## Critérios de aceite

- [ ] Série com conflito em qualquer semana não cria nenhuma ocorrência (teste automatizado).
- [ ] Cancelar uma ocorrência não afeta as demais; cancelar a série remove só as futuras.
- [ ] Duas pessoas na fila: a segunda só é notificada se a primeira não reservar dentro da janela.
- [ ] Horário liberado e reservado por terceiro fora da fila funciona (a fila não bloqueia o horário permanentemente).
- [ ] Todos os horários exibidos respeitam o fuso da arena, inclusive em mudança de horário de verão (testes de timezone).

## Fora de escopo

- Cobrança por assinatura no gateway (opção (c)) na primeira versão.
- Pacotes de horas pré-pagas (issue de pacotes/cupons).

## Depende de / relacionado

- "Pagamento real", "Notificações", "Painel do dono: gerenciar reservas".
- "Testes automatizados do backend".
