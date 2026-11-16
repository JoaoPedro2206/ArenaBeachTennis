---
title: "PWA: instalável, rápido na areia e com suporte offline básico"
labels: feature, frontend, P2
---

## Contexto

O app é **mobile-first** e usado em quadra de areia, muitas vezes com sol forte, 4G instável e uma mão só. Hoje é um site comum: sem ícone na tela inicial, sem tela de abertura, sem cache — cada visita baixa tudo de novo, e sem internet aparece a tela de erro do navegador.

Já existe uma boa base: code splitting por rota (`lazy`), Tailwind, logo e `favicon.png`, `100dvh`/safe areas tratadas no layout.

## Objetivo

Experiência de aplicativo instalável, carregamento instantâneo nas visitas seguintes e degradação elegante sem rede.

## Escopo

- [ ] `manifest.webmanifest` (nome, `short_name`, cores da marca, `display: standalone`, `start_url`, orientação, ícones 192/512 **maskable**, atalhos: "Reservar", "Ao vivo").
- [ ] Gerar ícones e *splash screens* a partir do logo oficial (sem editar o arquivo da marca, usar os mesmos recortes do componente `Logo`).
- [ ] **Service worker** via `vite-plugin-pwa` (Workbox):
  - precache do *app shell* e dos chunks de rota;
  - `stale-while-revalidate` para fotos de perfil e imagens estáticas;
  - **API: network-first com fallback** apenas para leituras seguras (ex.: "Minhas reservas", últimos dados do ranking) — **nunca** cachear respostas autenticadas sensíveis de forma compartilhada, nem rotas de escrita;
  - tela **"Você está offline"** amigável com o que ainda funciona.
- [ ] Banner "Instalar app" no momento certo (evento `beforeinstallprompt`, e instruções para iOS/Safari), dispensável e sem repetir.
- [ ] **Atualização de versão**: avisar "Nova versão disponível — Atualizar" em vez de forçar recarga no meio de um pagamento.
- [ ] Web Push (integra com a issue de notificações): registrar o service worker com handler de `push` e `notificationclick`.
- [ ] Ajustes de desempenho medidos com Lighthouse (alvo ≥ 90 em Performance/PWA/Acessibilidade no mobile): imagens do hero otimizadas (WebP/AVIF, `srcset`), fontes com `font-display: swap`, preconnect.
- [ ] Cor da barra de status (`theme-color`) coerente com o tema.

## Critérios de aceite

- [ ] Lighthouse PWA "instalável" ✔ e ícone correto no Android e iOS.
- [ ] Segunda visita carrega o shell em < 1 s mesmo em rede lenta (throttling "Slow 4G").
- [ ] Sem internet: o app abre, mostra a tela offline e **não** exibe dados de outro usuário após logout (limpar caches ao sair).
- [ ] Deploy de nova versão não quebra quem está com o app aberto (aviso de atualização testado).
- [ ] Nenhuma requisição `POST/PUT/PATCH/DELETE` é servida do cache.

## Cuidados

- Interação com o fluxo de pagamento: o service worker nunca pode servir um checkout/estado de reserva antigo.
- Garantir que o `Cache-Control` do HTML permita atualização (assets com hash são imutáveis; `index.html` não).

## Fora de escopo

- App nativo (React Native/Capacitor).
- Sincronização offline de escritas (fila de ações).

## Depende de / relacionado

- "Notificações" (Web Push).
- "Deploy: Docker e ambientes" (cabeçalhos de cache).
