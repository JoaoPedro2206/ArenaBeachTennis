---
title: "Deploy: Docker, ambientes (staging/produção) e migrações"
labels: infra, backend, frontend, P1
---

## Contexto

Hoje só o PostgreSQL tem Docker (`backend/docker-compose.yml`). Não existe imagem do backend, nem forma documentada de publicar o frontend, nem separação entre ambientes. Algumas armadilhas já conhecidas precisam entrar no processo de deploy:

- **Migrações**: em dev usa-se `prisma migrate dev`; em produção deve ser `prisma migrate deploy` (nunca `dev`). Uma migração pendente no banco derruba rotas em runtime.
- **Worker de expiração** (`BookingExpirationWorker`) roda **dentro do processo** da API com `setInterval`. Com mais de uma instância, todas varrem juntas (a query é idempotente, então é seguro, mas desperdiça).
- **Uploads** vão para o disco local (`LocalDiskStorageProvider`, só dev): em contêineres efêmeros as fotos somem.
- **Atrás de proxy** é obrigatório configurar `TRUST_PROXY`, senão o rate limit trata todos como um só IP.
- O seed cria contas com senha conhecida: **nunca** pode rodar em produção.

## Objetivo

Publicar o sistema de forma repetível, com staging e produção, e sem passos manuais perigosos.

## Escopo

### Containerização
- [ ] `Dockerfile` do backend multi-stage (build com `tsc` → imagem final enxuta, usuário não-root, `NODE_ENV=production`, `HEALTHCHECK` em `/api/v1/health`).
- [ ] `Dockerfile` do frontend (build do Vite servido por Nginx/Caddy com fallback de SPA para `index.html` e cache de assets com hash).
- [ ] `docker-compose.yml` na raiz: `db`, `backend`, `frontend` para subir tudo com um comando em dev.
- [ ] `.dockerignore` em cada projeto.

### Ambientes
- [ ] Definir hospedagem (ex.: Railway/Fly.io/Render para a API, Neon/Supabase/RDS para o PostgreSQL, Cloudflare Pages/Vercel para o frontend, R2/S3 para fotos) e registrar a decisão em `docs/adr/`.
- [ ] **Staging** com dados de teste e **produção**, variáveis separadas, `.env.example` completo e documentado (`DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGINS`, `TRUST_PROXY`, `VITE_API_URL`, credenciais de e-mail/pagamento/storage).
- [ ] Domínio + HTTPS; frontend e API em origens definidas (ajustar CORS e `VITE_API_URL`).

### Banco e migrações
- [ ] Etapa de release que roda `prisma migrate deploy` **antes** de subir a nova versão da API.
- [ ] Política de migrações compatíveis (expand/contract) para deploy sem downtime.
- [ ] **Backups automáticos** do PostgreSQL + teste de restauração documentado.
- [ ] Recusar `prisma db seed` quando `NODE_ENV=production`.

### Processos em segundo plano
- [ ] Extrair o worker de expiração para um processo/cron separado (ou `pg_cron`) quando houver mais de uma instância da API; manter a opção "embutido" para dev.

### Entrega contínua
- [ ] Workflow de deploy automático para staging a cada merge na `main`; produção por tag/aprovação manual.
- [ ] Rollback documentado (imagem anterior + migração reversível ou plano de correção).

## Critérios de aceite

- [ ] `docker compose up` sobe o sistema completo localmente.
- [ ] Deploy em staging a partir da `main` sem passos manuais.
- [ ] Runbook em `docs/deploy.md`: primeiro deploy, deploy normal, rollback, restauração de backup, rotação de segredos.
- [ ] Health check usado pelo orquestrador (já existe `/api/v1/health`, que reporta o banco).

## Fora de escopo

- Kubernetes, multi-região.

## Depende de / relacionado

- "CI com GitHub Actions".
- "Segurança: endurecimento" (uploads em storage externo, segredos).
- "Observabilidade".
