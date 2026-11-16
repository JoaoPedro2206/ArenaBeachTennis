---
title: "Crescimento: pacotes e cupons, avaliações, previsão do tempo e torneios"
labels: feature, backend, frontend, produto, P2
---

> Issue "guarda-chuva" de ideias de produto. Cada item pode virar uma issue própria quando for priorizado — a sugestão de ordem está no final.

## Contexto

Com pagamento, ranking e painel funcionando, o foco passa a ser **retenção e receita**. O código já tem ganchos para vários destes recursos.

## 1. Previsão do tempo nas quadras descobertas
- `Arena.latitude/longitude` já existem no schema, previstos para isso; `Court.isCovered` diz se a quadra é coberta.
- [ ] Integrar API de clima (Open-Meteo é gratuita e sem chave) com cache por arena/hora.
- [ ] Mostrar ícone/chance de chuva nos horários de quadras descobertas na grade de reservas.
- [ ] **Política de chuva**: reagendamento sem custo ou crédito quando a arena declarar "fechado por chuva" (o dono bloqueia o período e escolhe o que fazer com as reservas — integra com o painel de reservas).
- [ ] Aviso ao jogador (notificação) quando a previsão do seu horário piorar.

## 2. Pacotes, cupons e créditos
- [ ] **Cupom de desconto**: código, tipo (% ou valor), validade, limite de usos, restrição por quadra/horário/arena, aplicável no checkout; validação **no backend** na criação da reserva e registrada em `Booking` (valor original, desconto, cupom).
- [ ] **Pacote de horas** (ex.: 10 horas com 15 % off): compra → saldo em **carteira de créditos** (`credit_ledger` com lançamentos imutáveis); o checkout permite pagar com crédito.
- [ ] **Crédito por cancelamento/chuva** em vez de estorno (opção do dono).
- [ ] Relatórios do dono: receita por cupom/pacote, passivo de créditos a consumir.
- [ ] Programa de indicação ("convide um amigo, ganhe 1 h") com proteção contra abuso.

## 3. Avaliações
- [ ] Avaliar **aula** e **professor** (1–5 + comentário) apenas por quem participou, após a aula (já existem `LessonEnrollment` e a data da aula).
- [ ] Avaliar a **quadra/arena** após uma reserva `COMPLETED`.
- [ ] Moderação: o dono pode responder; denúncia de abuso; nota média nos cartões de professor/quadra.
- [ ] Notificação pedindo avaliação ~2 h após o jogo.

## 4. Torneios e eventos
- [ ] Modelo de **torneio** (arena, categoria, formato — eliminatória, grupos + mata-mata, rei da quadra —, vagas, inscrição paga, datas).
- [ ] Inscrição de duplas, **chaveamento automático** (com seed pelo ELO), lançamento de resultados e tabela ao vivo.
- [ ] Reserva automática de quadras para a programação (bloqueio `MAINTENANCE`/novo tipo `EVENT`) para o torneio não conflitar com reservas.
- [ ] Pontos do torneio no ELO com **K diferenciado** (partidas de torneio valem mais — o `kFactor` já é guardado por resultado).
- [ ] Página pública do torneio compartilhável.

## 5. Galeria de fotos e vídeos
- [ ] O modelo `Media` (`uploaderId`, `matchSessionId`, `storageKey`, `thumbnailUrl`) já existe sem uso, assim como `MediaType.VIDEO`.
- [ ] Upload de fotos da partida pelos participantes, galeria da partida/arena, moderação do dono; vídeo exige armazenamento/transcodificação (avaliar Cloudinary/Mux).
- [ ] Depende do storage externo (ver issue de segurança) e de limites de tamanho/cota.

## Sugestão de prioridade
1. Cupons + créditos (receita direta) e previsão do tempo (rápido, alto valor percebido).
2. Avaliações.
3. Torneios (maior esforço, maior engajamento).
4. Galeria.

## Critérios de aceite (por item, ao virar issue própria)
- [ ] Cada recurso com testes automatizados das regras de negócio (cupom não reutilizável acima do limite, crédito nunca negativo, avaliação só de quem participou).
- [ ] Regras financeiras auditáveis (lançamentos imutáveis, nenhum saldo alterado sem registro).
- [ ] Funcionalidades desativáveis por arena (flags).

## Depende de / relacionado
- "Pagamento real", "Notificações", "Painel do dono: gerenciar reservas".
