---
title: "Sessão: refresh token, logout real e tratamento de backend indisponível"
labels: feature, bug, backend, frontend, autenticação, P1
---

## Contexto

A sessão hoje é um **único JWT de 1 dia** (`JWT_EXPIRES_IN=1d`) guardado em `localStorage` (`tokenStorage`). Consequências:

1. **O usuário é derrubado no meio do uso** quando o token vence (o `AuthContext` agenda `endSession` no instante da expiração).
2. **Logout não revoga nada**: o token continua válido no servidor até vencer. Se for roubado, não há como invalidá-lo.
3. Token em `localStorage` é legível por qualquer script (risco em caso de XSS).
4. **Backend fora do ar no carregamento**: o app fica cerca de **15 s** na tela de carregamento (4 retentativas com espera de 1/2/4/8 s no `AuthContext`) e depois cai na tela de login **sem explicar o motivo**, embora a sessão seja válida.

## Objetivo

Sessão longa e segura, sem derrubar o usuário, com revogação real e comportamento claro quando a API está indisponível.

## Escopo

### Backend
- [ ] **Access token curto (15 min)** + **refresh token** opaco de longa duração (30 dias), com **rotação** a cada uso (cada refresh emite um novo e invalida o anterior).
- [ ] Tabela `refresh_tokens` (id, userId, hash do token, família, expiresAt, revokedAt, userAgent, ip, createdAt). Guardar apenas o hash.
- [ ] **Detecção de reuso**: apresentar um refresh já rotacionado revoga a família inteira (sinal de roubo).
- [ ] `POST /auth/refresh`, `POST /auth/logout` (revoga a família), `POST /auth/logout-all`.
- [ ] Refresh token em cookie `HttpOnly; Secure; SameSite=Lax` (ajustar CORS `credentials` — já está `true`) — o access token fica só em memória no frontend.
- [ ] `tokenVersion` no usuário para "sair de todos os aparelhos" e invalidar sessões ao trocar senha (compartilhado com a issue de recuperação de senha).
- [ ] Listar sessões ativas (`GET /auth/sessions`) e permitir encerrar uma específica.

### Frontend
- [ ] Interceptor do axios: ao receber 401 por expiração, tenta `refresh` **uma vez** (com fila para requisições concorrentes) e repete a original. Só desloga se o refresh falhar com 401.
- [ ] Remover o `localStorage` do access token (migrar quem já está logado sem forçar novo login, se possível).
- [ ] Logout chama o backend (revoga) antes de limpar o estado.
- [ ] **Backend indisponível no boot**: em vez de mandar para o login, mostrar uma tela "Não conseguimos conectar ao servidor" com **Tentar novamente** e manter a sessão. Reduzir o tempo de espera visível (hoje ~15 s).
- [ ] Tela em Perfil: "Aparelhos conectados" com botão "Sair deste aparelho".

## Critérios de aceite

- [ ] Usuário ativo nunca é deslogado por expiração do access token.
- [ ] Logout invalida o refresh token no servidor (teste: reutilizar após logout → 401).
- [ ] Reuso de refresh token rotacionado revoga a família (teste automatizado).
- [ ] Duas abas renovando ao mesmo tempo não derrubam a sessão (concorrência no refresh).
- [ ] Com o backend desligado, o app mostra erro de conexão com botão de nova tentativa e **não** limpa a sessão.
- [ ] Documentar o fluxo em `docs/auth.md`.

## Notas técnicas

- `ensureAuthenticated` já consulta o banco a cada requisição (valida `isActive` e role), então checar `tokenVersion` ali não adiciona consulta.
- Sincronização entre abas já existe via evento `storage` no `AuthContext`; com token em memória, trocar por `BroadcastChannel`.
- Atenção a CSRF ao usar cookie: o refresh deve ser `POST` e checar `Origin`.

## Fora de escopo

- 2FA, login social.

## Depende de / relacionado

- "Recuperação de senha e verificação de e-mail".
- "Segurança: endurecimento".
