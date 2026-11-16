---
title: "Painel do dono: cadastro de quadras e arenas, professores e aulas"
labels: feature, admin, backend, frontend, P1
---

## Contexto

Tudo que define a operação da arena (a arena, suas quadras, horários de funcionamento, professores e aulas) só pode ser criado **pelo seed ou direto no banco**. O dono não tem tela para isso. Pontos específicos do código:

- **Arena**: não existe CRUD; o painel usa a primeira arena do dono em ordem alfabética (`AdminRepository.findOwnedArena`), sem seletor de arena. O schema já suporta várias arenas (SaaS), mas o app assume uma.
- **Quadras** (`Court`): nome, superfície (areia/sintética), coberta, iluminação, status, preço, **duração do slot** (60/90 min), `openTime`/`closeTime`. Só o **status** (manutenção) e o **preço** são editáveis hoje no painel.
- **Aulas**: o backend **já tem** `LessonsService.createLesson` (aula avulsa ou recorrente semanal, tudo-ou-nada, com bloqueio de quadra via `Booking` tipo `CLASS`) e a rota `POST /lessons` para `TEACHER/ARENA_ADMIN`, mas **não há nenhuma tela** para criar/editar/cancelar aulas nem para cadastrar professores. O texto do app diz que o valor da aula "é acertado diretamente com a arena".
- Vários campos do schema não têm interface: `Arena.description/phone/address/latitude/longitude/timezone`, `Teacher.bio/levels`.

## Objetivo

O dono configura e mantém a arena inteira pelo painel.

## Escopo

### Arenas
- [ ] Seletor de arena no painel (e `?arenaId=` já aceito pelas rotas `/admin/*`) quando o dono tiver mais de uma; lembrar a última escolhida.
- [ ] Editar dados da arena: nome, descrição, endereço, cidade/UF, telefone, **fuso horário** (validar contra `Intl`), coordenadas (com busca por endereço/mapa — base para a previsão do tempo), foto/logo, ativar/desativar.
- [ ] Criar nova arena (futuro SaaS): `POST /admin/arenas` com `slug` único gerado do nome.

### Quadras
- [ ] CRUD de quadras: nome (único por arena — `@@unique([arenaId, name])`), superfície, coberta, iluminação, **duração do slot**, **horário de funcionamento** (com suporte a fechamento à meia-noite `00:00`), preço base, status.
- [ ] Validações: horários coerentes, slot que cabe na janela, **alterar slot/horário com reservas futuras** exige aviso e regra clara (não pode quebrar reservas existentes — recusar ou só valer a partir de uma data).
- [ ] **Inativar** (`INACTIVE`) em vez de excluir quando há histórico (`Booking.court` é `Restrict`).
- [ ] Horários especiais: feriados/fechamentos ("hoje abrimos às 10h") — bloqueio por período já existe; avaliar atalho "fechar o dia/arena inteira".

### Professores
- [ ] Convidar/vincular professor: associar um usuário existente (por e-mail) à arena com `role TEACHER` e criar o `Teacher` (bio, níveis atendidos). Convite por e-mail para quem ainda não tem conta (depende do Mailer).
- [ ] Ativar/desativar professor; ver aulas futuras antes de desativar.

### Aulas
- [ ] Tela **Aulas** no painel: calendário/lista com criar aula (professor, quadra, data/hora, duração, nível, capacidade, preço por aluno, **repetir por N semanas**), editar, cancelar uma ocorrência ou a série inteira.
- [ ] Mostrar **conflitos** antes de salvar (o backend já lista as datas ocupadas: "Quadra ocupada nas datas: …").
- [ ] Lista de alunos por aula, com contato e opção de remover aluno; aviso automático aos alunos quando a aula é cancelada (depende de Notificações).
- [ ] Preço das aulas passa a entrar nos relatórios financeiros? (decisão: hoje aulas **não** contam no faturamento — `CUSTOMER_TYPES` só inclui `REGULAR`/`OPEN_MATCH`).
- [ ] Professor (`TEACHER`) enxerga **só as próprias** aulas e pode criá-las (o backend já permite), numa área reduzida do painel.

## Critérios de aceite

- [ ] Dono cria uma quadra nova e ela aparece imediatamente na grade pública e na agenda do painel.
- [ ] Não é possível excluir/alterar de forma que quebre reservas futuras (teste automatizado).
- [ ] Dono A não vê nem altera arenas/quadras/aulas do dono B (teste de IDOR).
- [ ] Criar aula recorrente com uma data em conflito não cria nenhuma ocorrência (tudo-ou-nada preservado).
- [ ] Alterar o fuso da arena é recusado se houver reservas futuras (ou recalcula com segurança) — decidir e documentar.

## Fora de escopo

- Onboarding self-service de novas arenas com cobrança de assinatura (SaaS comercial).
- Gestão de funcionários com permissões granulares (recepcionista etc.) — ver issue de papéis, se criada.

## Depende de / relacionado

- "Painel do dono: gerenciar reservas".
- "Recuperação de senha e verificação de e-mail" (convites).
- "Notificações".
