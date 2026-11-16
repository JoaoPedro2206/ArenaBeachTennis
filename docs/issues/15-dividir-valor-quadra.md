---
title: "Dividir o valor da quadra entre os jogadores (rachar via Pix)"
labels: feature, pagamentos, partidas, backend, frontend, P2
---

## Contexto

Quem reserva a quadra paga **sozinho** o valor inteiro e depois "acerta" com os amigos por fora do app. Rachar a conta é uma dor real e um ótimo diferencial. O schema já tem os campos preparados, hoje sem uso:

- `MatchSession.pricePerPlayer` (cota individual) — default 0.
- `MatchParticipant.amountDue`, `paymentStatus` (`PENDING/PAID/REFUNDED/FAILED`) e `paymentExternalId`.

## Objetivo

Cada jogador da sala paga a sua parte pelo app; o anfitrião recebe o reembolso do que adiantou (ou paga só a sua cota, conforme o modelo escolhido).

## Decisão de modelo (definir primeiro)

**A — Anfitrião adianta e os outros reembolsam (recomendado para começar).** A reserva continua paga pelo anfitrião (fluxo atual). Cada convidado paga sua cota via Pix para o anfitrião (ou para a plataforma, que repassa). Menos mudanças, sem segurar reserva em aberto.

**B — Pagamento compartilhado antes da confirmação.** A reserva só confirma quando todas as cotas entram dentro da janela de 15 min. Mais complexo (e se um não paga? devolve tudo?).

Esta issue assume o modelo **A**; B fica como evolução.

## Escopo (modelo A)

### Backend
- [ ] Ao abrir a sala, calcular `pricePerPlayer = booking.totalPrice / maxPlayers` (centavos, com a sobra de arredondamento atribuída ao anfitrião) e gravar `amountDue` de cada participante ao entrar (`status CONFIRMED`).
- [ ] `POST /matches/:id/payments` — gera a cobrança Pix da cota do participante (via `PaymentProvider`, ver issue de pagamento real).
- [ ] Webhook confirma `MatchParticipant.paymentStatus = PAID`; idempotente.
- [ ] Anfitrião vê o status de cada cota; opção de **marcar como pago por fora** (dinheiro na mão) — com registro de quem marcou.
- [ ] Se um participante sai da sala **antes de iniciar**, a cota é reembolsada/cancelada e a divisão recalculada para os restantes? (regra a decidir; sugerir: não recalcular, anfitrião absorve).
- [ ] Repasse ao anfitrião: avaliar split do gateway ou repasse manual (depende do modelo comercial).

### Frontend
- [ ] Lobby: mostrar "Cota de cada um: R$ 30,00" e o status (pago / pendente) por jogador, com avatar.
- [ ] Botão **Pagar minha parte** para o convidado (Pix: QR + copia e cola).
- [ ] Anfitrião: "Cobrar quem falta" (reenvia notificação) e "Marcar como pago".
- [ ] Resumo ao final: "Você pagou R$ 30,00 · Quadra 1 · 19h".

## Critérios de aceite

- [ ] A soma das cotas é **exatamente** o valor da reserva (sem perder centavos).
- [ ] Pagamento da cota duplicado ou fora de ordem não gera estado inconsistente (teste automatizado).
- [ ] Sair da sala não deixa cobrança órfã.
- [ ] Participante só vê o status financeiro dos demais de forma resumida (pago/pendente), sem valores de outras transações.
- [ ] Feature desativável por flag (arenas podem não querer).

## Fora de escopo

- Modelo B (confirmação condicionada ao pagamento de todos).
- Gorjeta, cupons e promoções (issue separada).

## Depende de / relacionado

- **"Pagamento real (Pix e cartão)"** — pré-requisito.
- "Partidas abertas".
- "Notificações".
