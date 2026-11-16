---
title: "Dívida técnica: cache de leituras no frontend, worker, documentação e organização"
labels: tech-debt, backend, frontend, docs, P2
---

## Contexto

Lista de melhorias de manutenção encontradas nas revisões de código. Nenhuma é urgente isoladamente, mas juntas reduzem o custo de evoluir o projeto. Cada item pode ser feito em um PR pequeno.

## Frontend

- [ ] **Cache de leituras**: o hook `useAsync` refaz a requisição a cada montagem, não compartilha dados entre telas e não deduplica. Migrar para **TanStack Query** (cache, `staleTime`, invalidação após mutações, atualização otimista, retentativas) — remove vários `reload()` manuais e simplifica o `AuthContext`/telas.
- [ ] **Camada de erros única**: hoje cada tela trata `ApiError` por conta própria (`err instanceof ApiError ? err.message : '…'` repetido). Criar helper `errorMessage(err)` e um mapa `code → mensagem`.
- [ ] **Estados padrão**: componentes `EmptyState`, `ErrorState` e `Skeleton` compartilhados (hoje há variações por tela).
- [ ] `useLiveMatch`/`useAsync`: cobertos por testes (ver issue de testes) e documentados.
- [ ] **Boot sem backend**: o `AuthContext` espera ~15 s (4 retentativas) e cai no login sem explicar — ver issue de sessão.
- [ ] Remover `mocks/bookingMocks.ts` e a flag `VITE_USE_MOCKS` se não forem mais usados (ou garantir que são só de desenvolvimento).
- [ ] Revisar o `window.location.reload()` da `RouteErrorPage` (perde estado) — avaliar `router.revalidate()`.
- [ ] ESLint com `react-hooks/exhaustive-deps` ligado: vários efeitos omitem dependências de propósito (`useAsync`, `useLiveMatch`, toast de recém-chegados) — documentar cada exceção ou refatorar.
- [ ] Padronizar formatadores (`lib/format.ts`, `lib/adminFormat.ts`, `lib/dates.ts`) e evitar duplicação de lógica de fuso (`minutesInZone` na agenda do painel duplica o que o backend já calcula).

## Backend

- [ ] **Worker de expiração em processo**: `BookingExpirationWorker` usa `setInterval` na própria API. Com várias instâncias todas varrem; mover para job agendado (pg-boss/BullMQ/`pg_cron`) — ver issue de deploy. Adicionar também jobs de: confirmação automática de resultados, `COMPLETED`/`NO_SHOW` de reservas passadas, geração de séries recorrentes, lembretes.
- [ ] **Camada de serviço no `CourtsController`**: hoje consulta o repositório direto ("dispensa service") — manter, mas padronizar quando ganhar regra de negócio (ex.: filtro por arena ativa).
- [ ] **Paginação** nas listagens que hoje têm `take` fixo (`findByUser` = 50, aulas = 200, histórico = 20): cursor/paginação padronizada.
- [ ] **Constantes duplicadas** entre backend e frontend (`PAYMENT_WINDOW_MIN`, `CANCELLATION_MIN_HOURS`, faixas de categoria em `PLAYER_LEVELS`, regra de preço em `lib/pricing.ts`): gerar tipos/contratos a partir de uma fonte única (OpenAPI/zod-to-openapi ou pacote `shared`) para não divergirem.
- [ ] **Documentação da API**: gerar OpenAPI (a partir dos schemas Zod) + Swagger UI em dev; exemplos de erro (`code`, `details`).
- [ ] **Migração do `package.json#prisma`** para `prisma.config.ts` (deprecado, removido no Prisma 7).
- [ ] Revisar índices do banco com `EXPLAIN` nas consultas de agenda, relatórios e ranking.
- [ ] **Constraints no banco**: já existem para sobreposição de reservas e dias de regra de preço; avaliar `CHECK` adicionais (ELO ≥ 0, preços ≥ 0, `maxPlayers` ∈ {2,4}).
- [ ] Scripts utilitários em `scripts/` (reset do banco de dev, seed grande para testes de desempenho).

## Documentação e processo

- [ ] **README** completo: visão geral, arquitetura (diagrama dos módulos), como rodar (backend, frontend, banco), variáveis de ambiente, contas de teste do seed, comandos úteis.
- [ ] `CONTRIBUTING.md`: fluxo de branch/PR, convenção de commits, como escrever migrações, **regra de regressão** (todo bug corrigido ganha teste), checklist de PR.
- [ ] **ADRs** (`docs/adr/`) para as decisões já tomadas: bloqueio de manutenção como `Booking` tipo `MAINTENANCE`, categorias derivadas do ELO, preço por faixa com precedência, polling × websocket, pagamento simulado.
- [ ] `docs/arquitetura.md` com os fluxos críticos: reserva → pagamento → expiração; partida → resultado → ELO; preço dinâmico.
- [ ] Glossário de domínio (arena, quadra, slot, reserva, bloqueio, partida, sala, PIN, ELO, categoria).
- [ ] `CHANGELOG.md` e versionamento semântico das releases.

## Critérios de aceite

- [ ] Cada item marcado vira PR pequeno e referenciado nesta issue (pode ser quebrada em issues menores conforme a priorização).
- [ ] Um desenvolvedor novo consegue subir o projeto e rodar os testes seguindo apenas o README, em < 15 min.
- [ ] Nenhuma constante de regra de negócio duplicada à mão entre backend e frontend (ou há teste que as compara).

## Fora de escopo

- Reescrita de módulos que funcionam.
- Troca de framework.

## Depende de / relacionado

- "CI com GitHub Actions", "Testes do backend/frontend", "Deploy", "Sessão: refresh token".
