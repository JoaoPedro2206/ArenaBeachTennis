---
title: "Testes do frontend (componentes) e E2E com Playwright"
labels: tech-debt, testes, frontend, P1
---

## Contexto

O frontend (React 19 + Vite + Tailwind 4) não tem testes. Os fluxos mais críticos — reservar e pagar, entrar na sala por PIN, registrar resultado, painel do dono — só foram verificados à mão. Já apareceram bugs de estado que só um teste de interface pega (modal roubando foco a cada envio, prévia de resultado exibindo a formação anterior, "reserva expirada" mostrado para pagamento em processamento).

## Objetivo

Rede de segurança em duas camadas: testes rápidos de componentes/hooks e poucos testes E2E dos caminhos que não podem quebrar.

## Escopo

### Componentes e hooks (Vitest + Testing Library)
- [ ] Configurar Vitest com `jsdom`, `@testing-library/react`, `@testing-library/user-event`, e **MSW** para simular a API (inclui cenários de erro 5xx, rede caindo e 401).
- [ ] `useAsync`: carrega, erro, `reload`, cancelamento ao trocar dependências (resposta antiga não sobrescreve a nova), `enabled=false`.
- [ ] `useLiveMatch`: polling sequencial (sem sobreposição), pausa com aba oculta, descarte de resposta velha após ação do usuário, 404 chama `onGone`.
- [ ] `useCountdown`: dispara `onExpire` uma única vez.
- [ ] `AuthContext`: sessão válida, 401 desloga, backend caído **não** desloga, sincronização entre abas.
- [ ] `Modal`: foco preso, Esc fecha só se `dismissible`, foco volta ao elemento anterior.
- [ ] `CheckoutModal`: estados review → checkout → pago; prazo expira; erro de pagamento.
- [ ] `ResultSheet`: monta times, prévia só da formação atual, falha da prévia não bloqueia o registro.
- [ ] `AdminPricingPage`: validação de regras, aviso de alterações não salvas, mapa de preços reflete as regras.
- [ ] `lib/pricing.ts` e `lib/profileForm.ts` (puros).
- [ ] Guards: `AdminRoute` redireciona PLAYER; `PrivateRoute` redireciona visitante.

### E2E (Playwright)
- [ ] Subir backend + frontend + banco de teste com seed determinístico (`webServer` do Playwright).
- [ ] **Jornada do jogador**: cadastro → ver agenda → reservar → pagar (provider fake) → reserva aparece em "Minhas reservas" → cancelar.
- [ ] **Partida ao vivo com 2 contextos de navegador**: anfitrião abre a sala, convidado entra por PIN (aparece em tempo real), anfitrião inicia, registra resultado, ELO atualiza para os dois.
- [ ] **Painel do dono**: login como admin → bloquear horário na agenda → horário some da grade pública → remover bloqueio; criar regra de horário nobre → preço mudou na grade pública.
- [ ] **Autorização**: jogador acessando `/admin` é redirecionado.
- [ ] Viewports mobile (375 px) e desktop nos fluxos principais.
- [ ] Capturas de tela/vídeo em caso de falha, anexadas ao CI.

### Acessibilidade
- [ ] `@axe-core/playwright` nas páginas principais (violações sérias falham o teste).

## Critérios de aceite

- [ ] `npm test` (frontend) e `npm run test:e2e` funcionam localmente e no CI.
- [ ] Suíte E2E estável (sem flakiness): rodar 20× seguidas sem falha.
- [ ] Os 4 fluxos E2E acima cobertos.
- [ ] Documentação de como rodar e depurar (`--ui`, trace viewer).

## Fora de escopo

- Testes visuais de regressão (screenshot diff) — avaliar depois.

## Depende de / relacionado

- "Testes automatizados do backend" (banco de teste e seed).
- "CI com GitHub Actions".
