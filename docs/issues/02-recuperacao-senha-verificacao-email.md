---
title: "Recuperação de senha e verificação de e-mail"
labels: feature, backend, frontend, autenticação, P0
---

## Contexto

Hoje, quem esquece a senha **perde a conta**: não existe fluxo de recuperação. Também não há verificação de e-mail, então qualquer pessoa pode se cadastrar com o e-mail de outra (`AuthService.register` só checa se o e-mail já existe).

Situação atual relevante:
- Autenticação por e-mail + senha, bcrypt (`bcryptjs`), JWT HS256 de 1 dia.
- Rate limit de 20 tentativas / 15 min por IP em `/auth/register` e `/auth/login`.
- Não há nenhum envio de e-mail no projeto (nem provedor, nem templates).
- O telefone (opcional) é coletado, mas não verificado.

## Objetivo

1. Permitir redefinir a senha com segurança por e-mail.
2. Confirmar que o e-mail pertence a quem se cadastrou.

## Escopo

### Infra de e-mail (pré-requisito)
- [ ] Interface `Mailer` + implementação SMTP/API (Resend, SES, Mailgun — escolher) + `ConsoleMailer` para dev (imprime o link no terminal).
- [ ] Templates em português (texto + HTML simples), com a identidade visual da marca.
- [ ] Variáveis `MAIL_FROM`, credenciais e `APP_URL` (para montar os links) validadas em `config/env.ts`.

### Recuperação de senha
- [ ] Tabela `password_reset_tokens` (id, userId, **hash** do token, expiresAt, usedAt, createdAt). Guardar só o hash (SHA-256) — o token em si vai apenas no e-mail.
- [ ] `POST /auth/forgot-password { email }`: **sempre** responde 202 com a mesma mensagem, exista ou não o e-mail (não revelar cadastro). Gera token aleatório de 32 bytes, válido por 30 min.
- [ ] `POST /auth/reset-password { token, password }`: valida token (existe, não usado, não expirado), aplica as mesmas regras de senha do cadastro, marca o token como usado e **invalida sessões anteriores** (ver nota sobre `tokenVersion`).
- [ ] Rate limit próprio por e-mail **e** por IP (evitar spam de e-mails e enumeração por tempo de resposta).
- [ ] Frontend: páginas `/esqueci-senha` e `/redefinir-senha?token=…`, link "Esqueci minha senha" no login, mensagens de erro claras (link expirado → pedir outro).

### Verificação de e-mail
- [ ] Campo `User.emailVerifiedAt` + tabela de tokens (pode reaproveitar a de reset com um campo `type`).
- [ ] Envio do e-mail de confirmação no cadastro; `GET/POST /auth/verify-email?token=…`.
- [ ] `POST /auth/resend-verification` com rate limit.
- [ ] Decisão de produto: o que **exige** e-mail verificado? Sugestão: poder **pagar/reservar** exige; navegar e ver a agenda não. Banner no app "Confirme seu e-mail" enquanto pendente.
- [ ] Migração: usuários existentes e do seed ficam como verificados (ou forçar verificação no próximo login — decidir).

## Critérios de aceite

- [ ] Fluxo completo funciona ponta a ponta em dev usando o `ConsoleMailer`.
- [ ] Token de reset é de uso único, expira em 30 min e não é gravado em texto puro.
- [ ] Resposta e tempo de `forgot-password` são indistinguíveis entre e-mail existente e inexistente.
- [ ] Após redefinir a senha, tokens JWT emitidos antes **deixam de valer**.
- [ ] Testes automatizados: token expirado, reutilizado, inválido, e-mail inexistente, rate limit.

## Notas técnicas

- Para invalidar sessões antigas sem lista de revogação: adicionar `User.tokenVersion` (int) no JWT e conferir em `ensureAuthenticated` (que já busca o usuário no banco a cada requisição, então o custo é zero).
- `ensureAuthenticated` já valida `isActive` no banco; o mesmo ponto serve para `emailVerifiedAt` se for exigido.

## Fora de escopo

- Login social (Google/Apple) — issue futura.
- 2FA.
- Verificação de telefone/WhatsApp por SMS.

## Depende de / relacionado

- "Sessão: refresh token e expiração" (compartilham `tokenVersion`).
- "Segurança: endurecimento" (rate limit global).
