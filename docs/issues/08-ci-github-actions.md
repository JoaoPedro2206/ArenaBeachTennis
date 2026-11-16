---
title: "CI com GitHub Actions: typecheck, build, testes e verificação de migrações"
labels: infra, tech-debt, P0
---

## Contexto

O repositório não tem `.github/`: nada roda automaticamente a cada commit/PR. Já aconteceu de o servidor de desenvolvimento esconder um problema que só o build de produção revelou (classes do Tailwind não geradas), e de migrações ficarem pendentes no banco sem ninguém perceber.

## Objetivo

Todo PR é verificado automaticamente; `main` nunca fica quebrada.

## Escopo

### Workflow `ci.yml` (em push e pull_request)
- [ ] **Backend**: `npm ci` → `prisma generate` → `tsc --noEmit` → testes (com serviço PostgreSQL no job) → `npm audit --omit=dev --audit-level=high`.
- [ ] **Frontend**: `npm ci` → `tsc --noEmit` → testes → `vite build` (o build de produção pega erros que o dev server não mostra).
- [ ] **Prisma**: `prisma validate` e **`prisma migrate diff --from-migrations --to-schema-datamodel --exit-code`** para falhar quando o `schema.prisma` mudou sem migração correspondente.
- [ ] **Migrações aplicáveis do zero**: subir um Postgres limpo e rodar `prisma migrate deploy` (garante que a cadeia de migrações — incluindo a `EXCLUDE USING gist` — funciona num banco novo).
- [ ] Cache de dependências (`actions/setup-node` com `cache: npm`).
- [ ] Jobs em paralelo; cancelar execuções antigas do mesmo PR (`concurrency`).
- [ ] E2E (quando existir) em job separado, com upload de traces/vídeos em falha.

### Qualidade de código
- [ ] Adicionar **ESLint** (+ `typescript-eslint`, `react-hooks`, `jsx-a11y`) e **Prettier**; scripts `lint` e `format:check`; rodar no CI.
- [ ] `.editorconfig` e hook opcional de pre-commit (lint-staged) — não obrigatório.

### Governança do repositório
- [ ] Proteção da branch `main`: exigir CI verde e revisão antes do merge.
- [ ] Template de PR (`.github/pull_request_template.md`) com checklist: testes, migração, variáveis de ambiente novas, impacto em dados existentes.
- [ ] Templates de issue (bug / feature).
- [ ] **Dependabot** (`.github/dependabot.yml`) para npm e GitHub Actions, agrupando atualizações menores.
- [ ] `CODEOWNERS` (opcional).

## Critérios de aceite

- [ ] PR com erro de tipo, teste quebrado ou migração faltando **não** pode ser mesclado.
- [ ] Tempo total do CI < 8 min.
- [ ] Badge de status no README.
- [ ] Documentar no README como reproduzir cada etapa localmente.

## Notas técnicas

- Usar Node 20+ (alinhar com `engines` do `package.json`).
- O backend já separa `createApp()` de `server.ts`, então os testes de integração não abrem porta.
- Variáveis do CI (`DATABASE_URL`, `JWT_SECRET` ≥ 32 chars) via `env:` do job — nunca segredos reais.

## Fora de escopo

- Deploy automático (issue "Deploy e ambientes").

## Depende de / relacionado

- "Testes automatizados do backend" e "Testes do frontend".
