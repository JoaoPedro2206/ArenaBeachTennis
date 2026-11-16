---
title: "UX e acessibilidade: auditoria WCAG, dark mode, empty states e performance"
labels: frontend, acessibilidade, tech-debt, P2
---

## Contexto

O frontend já segue boas práticas em vários pontos: `aria-live` nos toasts, modal com foco preso, `radiogroup` com navegação por setas na seleção de datas, skeletons de carregamento, estados de erro com "Tentar novamente", `role="meter"`/`progressbar` e tabela alternativa nos gráficos do painel. Mas **nunca foi feita uma auditoria sistemática**, e há dívidas conhecidas.

## Itens

### 1. Auditoria de acessibilidade (WCAG 2.1 AA)
- [ ] Rodar axe/Lighthouse em todas as telas (jogador e painel) e corrigir violações; adicionar `@axe-core/playwright` ao E2E.
- [ ] **Contraste**: validar tokens de cor (texto `ink-subtle` sobre `surface-muted`, textos sobre `primary/15`, `cta` amarelo com texto preto) para ≥ 4.5:1.
- [ ] **Alvos de toque** ≥ 44 px (vários botões "pílula" e ícones de 36 px) e espaçamento entre alvos.
- [ ] **Teclado**: toda a agenda do painel (grade de horários e eventos) navegável e operável por teclado, com ordem de foco lógica e `:focus-visible` consistente; atalhos para trocar de dia.
- [ ] **Leitores de tela**: rótulos de grupos/tabelas, anúncios de mudança de estado (ex.: "Bloqueio criado"), `aria-busy` nas áreas que recarregam; texto alternativo das fotos.
- [ ] Respeitar `prefers-reduced-motion` (há várias animações: `animate-rise`, `slide-up`, `pulse`).
- [ ] Não depender só de cor (já feito na agenda com textura/legenda — replicar o critério nas outras telas, como o selo de status das reservas).

### 2. Tema escuro
- [ ] Os tokens já estão em variáveis CSS (`--background`, `--surface`, `--ink`…). Criar a paleta escura, `prefers-color-scheme` + alternador manual salvo em `localStorage`.
- [ ] Revisar a medalha de categoria e o `glass` (`rgb(255 255 255 / .72)` fixo) para o escuro.
- [ ] Gráficos do painel validados no escuro.

### 3. Estados vazios, erros e feedback
- [ ] Revisar **todas** as telas para: vazio, carregando, erro de rede, erro de permissão (403/404), sessão expirada. Padronizar um componente `EmptyState`/`ErrorState` (hoje cada tela monta o seu).
- [ ] Mensagens de erro de API: mapear `code` → texto amigável em um único lugar.
- [ ] Confirmações antes de ações destrutivas e **desfazer** onde fizer sentido (ex.: remover bloqueio).
- [ ] Rascunho de formulários longos (ex.: regras de preço) preservado ao navegar sem salvar (já há aviso de saída).

### 3.1 Onboarding
- [ ] Primeiro acesso do jogador: tour curto (reservar → abrir sala → ranking).
- [ ] Primeiro acesso do dono: checklist "configure sua arena" (quadras, horários, preços, professores).

### 4. Internacionalização
- [ ] Todos os textos estão em português, fixos no código. Se houver expansão (turistas em arenas de praia, espanhol/inglês): extrair para `react-i18next`, formatos de data/moeda via `Intl` (já usado) e fuso por arena.
- [ ] Decisão: vale a pena agora? Se não, só **centralizar strings** para facilitar o futuro.

### 5. Performance percebida
- [ ] Metas Lighthouse mobile ≥ 90; acompanhar tamanho do bundle por rota (o painel já é carregado sob demanda).
- [ ] Imagens otimizadas (o hero é um JPG), `loading="lazy"`, dimensões explícitas (evitar CLS).
- [ ] **Cache de leituras** no cliente (TanStack Query ou similar) para evitar refetch em cada navegação e permitir atualização otimista — hoje `useAsync` refaz a requisição sempre.
- [ ] Prefetch das rotas mais prováveis (ex.: Agendar a partir do Início).

## Critérios de aceite

- [ ] Relatório de auditoria anexado ao PR com antes/depois.
- [ ] Zero violações **sérias/críticas** do axe nas telas principais.
- [ ] Navegação completa do fluxo de reserva e da agenda do painel **apenas por teclado**.
- [ ] Dark mode sem textos ilegíveis (checado por contraste automatizado).

## Fora de escopo

- Redesenho visual da marca.
- App nativo.

## Depende de / relacionado

- "Testes do frontend e E2E" (axe no CI).
- "PWA" (Lighthouse).
