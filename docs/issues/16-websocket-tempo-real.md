---
title: "Tempo real: WebSocket no lugar do polling da sala ao vivo"
labels: tech-debt, feature, backend, frontend, partidas, P2
---

## Contexto

A sala ao vivo atualiza por **polling de 3 s** (`useLiveMatch`): cada jogador faz uma requisição `GET /matches/:id` a cada ciclo, que consulta o banco com vários joins (`matchSelect`). Funciona e é simples, mas:

- **Custo cresce linearmente**: 100 salas × 4 jogadores = ~133 req/s só de polling, mesmo sem nada mudar.
- Latência de até 3 s para ver alguém entrar ou o jogo começar.
- Bateria/dados do celular na quadra (4G ruim).
- Não serve para o que vem depois: placar ao vivo, notificações in-app, painel do dono em tempo real.

O hook já está bem isolado (`match`, `apply`, `newcomers`) e trata detalhes importantes que devem ser **preservados**: uma consulta por vez, pausa com aba oculta, descarte de resposta velha após ação do usuário e `onGone` em 404.

## Objetivo

Empurrar mudanças da sala do servidor para os clientes, mantendo o polling como **fallback**.

## Escopo

### Backend
- [ ] Servidor de WebSocket (Socket.IO ou `ws`) no mesmo processo da API, **autenticado** com o access token (no handshake) e verificando `isActive` como `ensureAuthenticated` faz.
- [ ] "Room" por partida; só participantes entram (mesma regra do `getById`: quem não está na sala não enxerga nada).
- [ ] Emitir `match:updated` (estado completo ou diff) quando: alguém entra/sai, início, cancelamento, resultado registrado/confirmado. Pontos de emissão: serviços de partida, **depois** do commit da transação.
- [ ] Escala horizontal: adaptador Redis (pub/sub) quando houver mais de uma instância.
- [ ] Limites: conexões por usuário, tamanho de mensagem, heartbeat/ping.

### Frontend
- [ ] `useLiveMatch` usa WebSocket quando disponível e **cai para polling** se a conexão falhar/ficar instável; reconexão com backoff e **ressincronização** (busca o estado completo ao reconectar).
- [ ] Indicador discreto de "reconectando…".
- [ ] Manter a animação de recém-chegados e os toasts atuais.

### Outros usos (preparar a base, não implementar tudo)
- [ ] Canal por usuário para notificações in-app.
- [ ] Canal para a agenda do dono (mudanças de reserva ao vivo).

## Critérios de aceite

- [ ] Jogador que entra aparece para os demais em < 500 ms.
- [ ] Com o WebSocket bloqueado (proxy corporativo), a sala continua funcionando via polling.
- [ ] Desligar e religar a rede do cliente não deixa a tela desatualizada.
- [ ] Teste de integração: dois clientes na mesma sala recebem o evento; cliente de outra sala **não** recebe.
- [ ] Carga: 500 conexões simultâneas estáveis num ambiente de staging, medindo CPU/memória.

## Riscos

- Proxies/balanceadores precisam suportar upgrade de conexão e "sticky sessions" (ou Redis adapter).
- Estado duplicado entre polling e socket: sempre tratar o servidor como fonte da verdade e usar versão/`updatedAt` para ignorar mensagens antigas.

## Fora de escopo

- Placar ao vivo (set a set) — issue futura que usa esta base.

## Depende de / relacionado

- "Observabilidade" (métricas de conexões).
- "Partidas abertas", "Notificações".
