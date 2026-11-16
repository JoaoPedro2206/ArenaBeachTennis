---
title: "Pagamento real (Pix e cartão) com gateway e webhook"
labels: feature, backend, frontend, pagamentos, P0
---

## Contexto

Hoje o pagamento é **simulado**: o frontend chama `POST /bookings/:id/pay` e o backend confirma a reserva na hora, sem cobrar ninguém (`BookingsService.pay` → `BookingsRepository.confirmPayment`). O `CheckoutModal` mostra as opções Pix/Cartão, mas a escolha não vai para lugar nenhum e o aviso "Ambiente de demonstração" aparece na tela.

Sem cobrança real, o produto não gera receita. É o bloqueio nº 1 para colocar uma arena para operar de verdade.

O que já existe e deve ser **reaproveitado**:
- Janela de pagamento de 15 min (`PAYMENT_WINDOW_MIN`, `Booking.expiresAt`) e o worker de expiração (`BookingExpirationWorker`).
- `confirmPayment` já é atômico: só confirma se o status ainda é `PENDING_PAYMENT` **e** `expiresAt > now`. Pagamento e expiração nunca "ganham" os dois.
- Campos `Booking.paymentStatus` (`PENDING | PAID | REFUNDED | FAILED`) e `Booking.paymentExternalId`.
- Cancelamento já marca `REFUNDED` quando a reserva estava `PAID` (mas hoje **não estorna nada de verdade**).

## Objetivo

Cobrar de verdade via **Pix** (principal no Brasil) e **cartão**, confirmando a reserva por **webhook do gateway** (nunca pela palavra do app) e estornando de verdade no cancelamento.

## Decisão a tomar antes de começar

Escolher o gateway (sugestão: **Mercado Pago** pela cobertura de Pix e checkout transparente; alternativas: Stripe, Pagar.me, Asaas). Registrar a decisão em `docs/adr/` e implementar atrás de uma interface `PaymentProvider` para não acoplar o domínio ao fornecedor.

## Escopo

### Backend
- [ ] Interface `PaymentProvider` (`createCharge`, `getCharge`, `refund`, `verifyWebhook`) + implementação do gateway escolhido + `FakePaymentProvider` para dev/testes.
- [ ] `POST /bookings/:id/pay` passa a **iniciar** a cobrança: devolve o QR Code / código "copia e cola" do Pix (ou o token do cartão processado) e grava `paymentExternalId`. A reserva continua `PENDING_PAYMENT`.
- [ ] `POST /webhooks/payments` (rota pública, **sem** JWT): valida a assinatura do gateway, é **idempotente** (mesmo evento 2x não confirma 2x) e chama `confirmPayment`.
- [ ] Se o pagamento chegar **depois** do prazo (reserva já `CANCELLED` por expiração): estornar automaticamente e registrar o evento. Nunca deixar cliente cobrado sem reserva.
- [ ] Cancelamento de reserva `PAID` com ≥24h de antecedência chama `provider.refund`; só marca `REFUNDED` quando o gateway confirmar. Falha no estorno vira alerta/log e fica pendente de nova tentativa.
- [ ] Reconciliação: job periódico que consulta no gateway as cobranças `PENDING` com mais de X min (webhook perdido).
- [ ] Persistir um histórico de eventos de pagamento (tabela `payment_events`: id do gateway, tipo, payload, recebido em) para auditoria.
- [ ] Variáveis de ambiente validadas em `config/env.ts` (chaves, segredo do webhook, URL pública).

### Frontend
- [ ] `CheckoutModal`: tela de Pix com QR Code, botão "Copiar código", contador de 15 min (já existe) e **polling/refetch** do status da reserva até confirmar.
- [ ] Fluxo de cartão (checkout transparente / tokenização — o app **nunca** toca em número de cartão no backend próprio).
- [ ] Estados de erro: cartão recusado, Pix expirado, falha de rede durante o pagamento (não dizer "expirada" se o pagamento está em processamento).
- [ ] Remover o aviso "Ambiente de demonstração" quando em produção.

## Critérios de aceite

- [ ] Reserva só vira `CONFIRMED` após confirmação **assinada** do gateway.
- [ ] Webhook duplicado ou fora de ordem não gera estado inconsistente (teste automatizado).
- [ ] Pagamento após expiração dispara estorno automático (teste automatizado).
- [ ] Cancelamento com reembolso gera estorno real e o valor aparece no extrato do gateway sandbox.
- [ ] Nenhum dado de cartão trafega ou é armazenado no backend (PCI fora de escopo).
- [ ] Documentação: como configurar sandbox, expor o webhook em dev (ngrok/cloudflared) e as variáveis.

## Riscos e pontos de atenção

- **Corrida pagamento × expiração × cancelamento**: já há proteção no banco; os testes de concorrência devem cobrir os três.
- Webhooks chegam fora de ordem e repetidos: tratar por `paymentExternalId` + status monotônico.
- O gateway pode exigir CPF do pagador no Pix: avaliar coletar no checkout (LGPD — ver issue de privacidade).

## Fora de escopo

- Divisão do pagamento entre jogadores (issue separada: "Dividir o valor da quadra entre os jogadores").
- Repasse/split para a arena (marketplace). Definir depois que o modelo comercial estiver fechado.

## Depende de / relacionado

- Testes automatizados do backend (para cobrir a concorrência).
- Observabilidade (alertas de falha de webhook/estorno).
