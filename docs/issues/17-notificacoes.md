---
title: "Notificações: push, e-mail e WhatsApp (lembretes e eventos)"
labels: feature, backend, frontend, notificações, P1
---

## Contexto

O app é **passivo**: o usuário só descobre algo se abrir a tela. Há eventos importantes que hoje passam despercebidos:
- Reserva `PENDING_PAYMENT` prestes a expirar (15 min) e **expirada** (o horário é liberado em silêncio).
- Jogo começando em breve; sala aberta (PIN) pelo anfitrião.
- Alguém entrou na sua sala / pediu para entrar (hoje só aparece um toast se a pessoa estiver com a tela aberta).
- ELO atualizado / mudança de categoria / resultado aguardando confirmação.
- Dono da arena: nova reserva, cancelamento, pagamento pendente, horário de pico lotando.

O telefone já é coletado no perfil (opcional). Não há infraestrutura de envio (nem e-mail — ver issue de recuperação de senha).

## Objetivo

Um sistema de notificações **por eventos**, com múltiplos canais e preferências do usuário.

## Arquitetura sugerida

- Tabela `notifications` (id, userId, tipo, título, corpo, dados JSON, `readAt`, createdAt) — alimenta a **central de notificações in-app**.
- Tabela `notification_preferences` (userId, tipo, canais habilitados).
- Tabela `push_subscriptions` (userId, endpoint, chaves, userAgent).
- Um `NotificationService.notify(userId, type, payload)` que decide canais conforme as preferências e enfileira o envio (fila com retentativa: BullMQ/pg-boss; não bloquear a requisição).
- Interfaces `PushProvider`, `Mailer`, `WhatsAppProvider` para trocar fornecedores.

## Escopo

### Canais
- [ ] **In-app**: sino no cabeçalho com contador de não lidas e lista (`GET /notifications`, `POST /notifications/read`).
- [ ] **Web Push** (VAPID + service worker; depende do PWA): inscrição/cancelamento, permissão pedida **no momento certo** (ex.: após a 1ª reserva, nunca no primeiro acesso).
- [ ] **E-mail** transacional (reaproveita o `Mailer` da issue de recuperação de senha).
- [ ] **WhatsApp** (API oficial/Twilio/Z-API — avaliar custo e política de templates) para lembretes de jogo. Exige consentimento explícito (`optIn`).

### Eventos iniciais
- [ ] Lembrete de jogo **2 h** e **24 h** antes (job agendado).
- [ ] Reserva a pagar: aviso aos **5 min** do fim do prazo; aviso de **expirada**.
- [ ] Pagamento confirmado / estorno efetuado.
- [ ] Sala: alguém entrou, pedido de entrada, jogo iniciado, resultado para confirmar, ELO atualizado, subiu/caiu de categoria.
- [ ] Aula: inscrição confirmada, aula amanhã, aula cancelada.
- [ ] Dono: nova reserva do dia, cancelamento, contestação de resultado.

### Preferências
- [ ] Página **Perfil → Notificações** com liga/desliga por tipo e canal; padrões sensatos.
- [ ] Link de **descadastrar** em todo e-mail; respeitar `optOut` imediatamente.
- [ ] **Horário silencioso** (não enviar push/WhatsApp de madrugada, exceto transacional crítico).

## Critérios de aceite

- [ ] Eventos geram exatamente **uma** notificação por canal (idempotência por chave de evento; teste com reprocessamento).
- [ ] Falha de um canal não impede os outros e é retentada com backoff; falhas definitivas vão para log/alerta.
- [ ] Usuário que desativou um tipo/canal **nunca** recebe.
- [ ] Notificação de lembrete respeita o **fuso da arena** nos horários exibidos.
- [ ] Nenhum dado sensível no corpo de push/WhatsApp além do necessário.
- [ ] Documentação dos tipos de evento e como adicionar um novo.

## Fora de escopo

- Campanhas de marketing em massa.
- Chat entre jogadores.

## Depende de / relacionado

- "PWA" (Web Push), "Recuperação de senha" (Mailer), "Tempo real" (canal in-app ao vivo).
- "Privacidade e LGPD" (consentimento por canal).
