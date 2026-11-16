---
title: "Observabilidade: logs estruturados, monitoramento de erros e métricas"
labels: infra, backend, frontend, P1
---

## Contexto

Em produção, hoje, só saberíamos de um problema quando um usuário reclamasse:
- Logs são `console.log/error` e `morgan` em texto livre; difícil filtrar por usuário/requisição.
- Erros 500 são impressos no console do processo e se perdem.
- No frontend, erros de renderização caem na `RouteErrorPage` (que faz `console.error`), sem nenhum registro central.
- Falhas silenciosas já existiram (ex.: arquivo de foto antigo não apagado — agora só vai para `console.error`).
- O worker de expiração só imprime quantas reservas cancelou.

## Objetivo

Ver o que acontece em produção e ser avisado **antes** do cliente.

## Escopo

### Logs estruturados (backend)
- [ ] Trocar `console.*` e `morgan` por **pino** (`pino-http`): JSON, nível configurável, **ID de requisição** (`X-Request-Id`, propagado e devolvido no erro) e `userId` quando autenticado.
- [ ] **Redação** automática de campos sensíveis (`authorization`, `password`, `token`, cookies, corpo de `/auth/*`) — ver issue de LGPD.
- [ ] Logar duração de consultas lentas do Prisma (evento `query` acima de um limite).

### Erros
- [ ] **Sentry** (ou equivalente) no backend (apenas erros 5xx e exceções não tratadas, não 4xx) e no frontend (inclui `RouteErrorPage`, `unhandledrejection`). Enviar `release` (versão do commit) e ambiente. Mapas de origem do Vite enviados no CI.
- [ ] O `errorHandler` devolve o `requestId` na resposta de erro para o usuário informar ao suporte.

### Métricas e saúde
- [ ] `/api/v1/health` já informa o banco; separar **liveness** (processo vivo) de **readiness** (banco ok) para o orquestrador.
- [ ] Métricas Prometheus (`/metrics`, protegida): latência e taxa de erro por rota, reservas criadas/confirmadas/expiradas, pagamentos aprovados/recusados, partidas finalizadas, tamanho do pool do banco.
- [ ] Heartbeat do worker de expiração (alerta se ficar > 5 min sem rodar).

### Alertas
- [ ] Alertas mínimos: taxa de 5xx elevada, banco indisponível, **webhook de pagamento falhando**, estorno pendente há mais de X min, worker parado.
- [ ] Canal de notificação (e-mail/Slack/Telegram).

### Frontend
- [ ] Registrar erros de API relevantes (5xx e rede) com contexto (rota, `requestId`), sem dados pessoais.
- [ ] Web Vitals (LCP/INP/CLS) básicos.

## Critérios de aceite

- [ ] Dado um erro 500 em produção, é possível chegar do `requestId` mostrado ao usuário até o log e o evento no Sentry.
- [ ] Nenhum dado sensível aparece nos logs (teste automatizado que loga uma requisição de login e verifica a redação).
- [ ] Painel (Grafana/Datadog/Better Stack) com as métricas acima.
- [ ] Runbook curto: "o que fazer quando o alerta X dispara".

## Fora de escopo

- APM com tracing distribuído completo.

## Depende de / relacionado

- "Deploy: Docker e ambientes".
- "Privacidade e LGPD" (o que pode ser logado).
- "Pagamento real" (alertas de webhook).
