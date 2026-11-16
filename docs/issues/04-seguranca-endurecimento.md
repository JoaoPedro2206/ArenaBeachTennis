---
title: "Segurança: endurecimento da API e dos uploads"
labels: security, backend, P1
---

## Contexto

Uma revisão rápida do backend encontrou uma base sólida (validação com Zod, `helmet`, JWT com algoritmo/emissor fixos, rate limit no login e no PIN, queries parametrizadas pelo Prisma), mas ainda há lacunas a fechar antes de abrir para o público.

## Itens

### 1. Rate limit global e por rota sensível
- [ ] Hoje só `/auth/*` (20/15 min por IP) e `/matches/join` (20/10 min por usuário) têm limite. Adicionar um **limite global** moderado por IP e limites específicos em: `POST /bookings` (evitar "segurar" horários em massa), uploads de foto, `/admin/*`.
- [ ] Trocar o armazenamento em memória do `express-rate-limit` por **Redis** quando houver mais de uma instância (hoje cada instância conta separado).
- [ ] Confirmar `TRUST_PROXY` configurado corretamente em produção (sem isso, todos os usuários atrás do proxy dividem um IP e são bloqueados juntos).

### 2. Abuso de reservas (negação de serviço de negócio)
- [ ] Um usuário mal-intencionado pode criar várias reservas `PENDING_PAYMENT` e travar horários por 15 min cada. Limitar **reservas pendentes simultâneas por usuário** (ex.: 2) e retornar mensagem clara.

### 3. Uploads
- [ ] A foto de perfil valida mimetype e assinatura dos bytes (bom), mas: reprocessar a imagem no servidor (ex.: `sharp`: redimensionar para 512 px, converter para WebP, **remover metadados EXIF/GPS**).
- [ ] Mover o armazenamento de `LocalDiskStorageProvider` (só dev) para S3/R2/Cloudinary atrás da interface `StorageProvider` já existente, com URLs assinadas ou CDN.
- [ ] Limite de tamanho de imagem decodificada (proteção contra "decompression bomb").

### 4. Cabeçalhos e CORS
- [ ] Revisar `helmet` com CSP explícita para o frontend em produção; `Strict-Transport-Security`.
- [ ] `CORS_ORIGINS` já é configurável: documentar e **recusar** `*` em produção.

### 5. Segredos e configuração
- [ ] `JWT_SECRET` exige ≥32 chars (bom). Adicionar checagem de que **não** é o valor do `.env.example` quando `NODE_ENV=production`.
- [ ] Remover credenciais de seed (`admin@arenabeach.test / Admin1234`) de qualquer ambiente que não seja local: o seed deve se recusar a rodar com `NODE_ENV=production`.
- [ ] Garantir que `.env` não está versionado e que há `.env.example` completo (incluir `TRUST_PROXY`).

### 6. Erros e logs
- [ ] Em produção o `errorHandler` já omite a stack; confirmar que `details` de erros 500 também não vazam informação interna.
- [ ] Nunca logar `Authorization`, senhas ou corpo de `/auth/*` (o `morgan` em modo `combined` loga URL e cabeçalhos básicos — revisar).

### 7. Autorização (revisão sistemática)
- [ ] Escrever testes que garantem que **cada rota** `/admin/*` responde 403 para PLAYER/TEACHER e que um ARENA_ADMIN **não** acessa dados de arena de outro dono.
- [ ] Revisar IDOR nas rotas de reservas, partidas e aulas (hoje respondem 404 para recurso de outro usuário — manter e testar).

### 8. Dependências
- [ ] Habilitar Dependabot (ou Renovate) e `npm audit` no CI.
- [ ] O `package.json#prisma` está **deprecado** (aviso no Prisma 6, removido no 7): migrar a configuração (seed) para `prisma.config.ts`.

## Critérios de aceite

- [ ] Cada item acima tem verificação (teste automatizado ou checklist de deploy).
- [ ] Documento `docs/security.md` com o modelo de ameaças resumido e o checklist de produção.
- [ ] `npm audit --omit=dev` sem vulnerabilidades altas/críticas.

## Fora de escopo

- Pentest externo, WAF.
- LGPD (issue separada: "Privacidade e LGPD").

## Depende de / relacionado

- "CI com GitHub Actions" (audit e testes automáticos).
- "Sessão: refresh token".
