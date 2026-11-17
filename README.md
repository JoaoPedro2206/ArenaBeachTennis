# 🏖️ Arena Beach

**Plataforma de beach tennis para arenas e jogadores:** reserva de quadras com pagamento, aulas com professores, partidas ao vivo com código PIN e ranking ELO que define a categoria de cada jogador.

![Node](https://img.shields.io/badge/Node-20%2B-339933?logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss&logoColor=white)

---

## Sumário

- [Funcionalidades](#funcionalidades)
- [Stack](#stack)
- [Arquitetura](#arquitetura)
- [Como rodar](#como-rodar)
- [Testes](#testes)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Regras de negócio](#regras-de-negócio)
- [API](#api)
- [Decisões técnicas](#decisões-técnicas)
- [Solução de problemas](#solução-de-problemas)
- [Próximos passos](#próximos-passos)

---

## Funcionalidades

| Módulo | O que faz |
|---|---|
| **Agendamento** | Grade de horários por quadra e dia (no fuso da arena), reserva com checagem de conflito e duas proteções contra reserva dupla: no código e no banco. |
| **Pagamento com prazo** | A reserva nasce *aguardando pagamento* e segura o horário por **15 minutos**, com timer regressivo no app. Se não for paga no prazo, é cancelada sozinha e o horário volta a ficar livre. O pagamento é **simulado** por enquanto. |
| **Cancelamento** | O jogador cancela a própria reserva: sempre, se ainda não pagou; com reembolso, se pagou e faltam **24h ou mais** para o horário. |
| **Aulas** | Professores, aulas avulsas ou semanais, inscrição com limite de vagas. Cada aula ocupa a quadra e bloqueia o horário na grade. |
| **Partidas ao Vivo** | Quem reservou abre uma sala e recebe um **PIN de 6 dígitos**; os outros entram digitando o código. Os jogadores aparecem na sala em tempo real (a tela consulta o servidor a cada 3s). |
| **Ranking ELO** | O anfitrião informa as duplas e quem venceu. O ELO é transferido entre os times conforme a diferença de nível, e a **categoria (Iniciante, D, C, B, A) é calculada pelo ELO**, sem que o jogador possa escolher. |
| **Perfil** | Foto (upload), nome, telefone e bio. Medalha da categoria, barra de progresso ("faltam 45 pontos para a Categoria C") e histórico de partidas com a variação de pontos em cada uma. |
| **Autenticação** | Cadastro e login com JWT, rotas protegidas, sessão sincronizada entre abas, logout quando o token expira e nova tentativa quando a rede oscila. |

> Interface **mobile-first**, pensada para ser usada na quadra, sob o sol: botões grandes, alto contraste e navegação por abas com o botão central **Ao Vivo** em destaque.

## Stack

**Backend:** Node.js · Express 5 · TypeScript · Prisma 6 · PostgreSQL 16 · Zod · JWT (`jsonwebtoken` + `bcryptjs`) · Multer · Helmet · express-rate-limit

**Frontend:** React 19 · Vite 6 · TypeScript · Tailwind CSS 4 · React Router 7 · Axios · Context API

**Infra (dev):** Docker Compose (PostgreSQL)

## Arquitetura

```
┌──────────────┐   /api (proxy do Vite)   ┌───────────────────────────────┐      ┌────────────┐
│   Frontend   │ ───────────────────────▶ │ Backend (Express)             │ ───▶ │ PostgreSQL │
│ React + Vite │                          │ routes → controller → service │      │ (Docker)   │
└──────────────┘ ◀─────────────────────── │          → repository         │ ◀─── │            │
                         JSON             └───────────────────────────────┘      └────────────┘
```

O backend separa as responsabilidades em camadas:
- **controller:** só traduz HTTP e valida a entrada com Zod;
- **service:** contém as regras de negócio;
- **repository:** é a única camada que fala com o Prisma.

Regras puras (ELO, faixas de categoria, grade de horários) ficam em funções sem acesso a banco, fáceis de testar.

```
Arena/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma          # modelo de dados
│   │   ├── migrations/            # histórico de migrations (algumas ajustadas à mão — ver "Decisões técnicas")
│   │   └── seed.ts                # arena, quadras, professores e aulas de exemplo
│   ├── uploads/                   # fotos enviadas em dev (ignorado pelo git)
│   └── src/
│       ├── config/env.ts          # variáveis de ambiente validadas com Zod (falha rápido)
│       ├── modules/
│       │   ├── auth/              # cadastro, login
│       │   ├── users/             # perfil, foto
│       │   ├── courts/            # quadras
│       │   ├── bookings/          # grade, reservas, pagamento, cancelamento, expiração
│       │   ├── lessons/           # professores, aulas, inscrições
│       │   ├── matches/           # partidas ao vivo (PIN, sala, resultado)
│       │   └── rating/            # algoritmo ELO e faixas de categoria
│       ├── shared/                # erros, middlewares (auth, upload, erros), provedores (storage)
│       ├── routes/index.ts
│       ├── app.ts
│       └── server.ts
└── frontend/
    └── src/
        ├── pages/                 # Início, Agendar, Ao Vivo, Aulas, Perfil, Login, Cadastro
        ├── components/            # booking/, live/, lessons/, rating/, profile/, layout/, ui/
        ├── contexts/              # AuthContext, ToastContext
        ├── services/              # api.ts (axios) + um serviço por domínio
        ├── hooks/                 # useAuth, useAsync, useCountdown, useLiveMatch, useToast
        ├── types/  lib/  routes/
        └── styles/index.css       # design system (cores da marca, espaçamentos, sombras)
```

## Como rodar

### Pré-requisitos

- **Node.js 20+**
- **Docker Desktop** (para o PostgreSQL), aberto e rodando

> Os comandos abaixo funcionam no **PowerShell** e no **Prompt de Comando** do Windows, assim como no terminal do Linux/macOS (exceto onde indicado).

### 1. Banco de dados

```bash
cd backend
docker compose up -d
```

O PostgreSQL sobe na porta **5433**, e não na 5432, para não conflitar com outros Postgres da máquina.

### 2. Backend

```bash
cd backend
npm install
```

Crie o arquivo `.env` a partir do exemplo:

```powershell
# Windows (PowerShell)
Copy-Item .env.example .env
```

```bash
# Linux/macOS
cp .env.example .env
```

Abra o `.env` e troque o `JWT_SECRET` por um valor aleatório de 32 caracteres ou mais. Para gerar um:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Crie as tabelas, carregue os dados de exemplo e suba a API:

```bash
npx prisma migrate deploy
npx prisma db seed
npm run dev
```

A API fica em **http://localhost:3333/api/v1**. Para conferir, abra `GET /api/v1/health`, que deve responder `"database": "up"`.

### 3. Frontend

Em outro terminal:

```bash
cd frontend
npm install
npm run dev
```

Abra **http://localhost:5173**. Se a porta estiver ocupada, o Vite usa a próxima (5174…) e tudo continua funcionando, porque as chamadas à API passam pelo proxy do Vite.

### Contas de teste

O seed cria um **admin da arena** e **dois professores**. Os e-mails e as senhas, que valem só para uso local, estão nos comentários de [`backend/prisma/seed.ts`](backend/prisma/seed.ts): o admin no topo do arquivo e os professores na seção "Professores e aulas". Para jogar, crie uma conta em **Cadastro**: todo jogador novo começa como Iniciante, com 1000 pontos.

### Scripts úteis

| Onde | Comando | O que faz |
|---|---|---|
| backend | `npm run dev` | API com recarga automática |
| backend | `npm run build` / `npm start` | Compila para `dist/` / roda a versão compilada |
| backend | `npm run typecheck` | Verifica tipos |
| backend | `npx prisma studio` | Interface visual do banco |
| backend | `npm test` | Roda todos os testes (ver [Testes](#testes)) |
| frontend | `npm run dev` | App com recarga automática |
| frontend | `npm run build` | Build de produção em `dist/` |

## Testes

O backend usa **Vitest** + **supertest**, em duas suítes:

| Suíte | Onde | O que cobre | Precisa de banco? |
|---|---|---|---|
| `unit` | `backend/tests/unit/` e `backend/tests/*.test.ts` | Funções puras: ELO, categorias, grade de horários, fuso horário, preços, validações do painel, fluxos de auth com fakes | Não |
| `integration` | `backend/tests/integration/` | Rotas e serviços contra um **PostgreSQL real**: concorrência em reservas, pagamento × expiração, cancelamento × pagamento, salas de partida, ELO, painel admin, relatórios, cadastro e login | Sim |

A integração usa Postgres de verdade (não SQLite nem mocks) porque as regras críticas dependem da `EXCLUDE USING gist` de reservas e de `SELECT … FOR UPDATE`.

### Rodando

```bash
cd backend
npm run test:db:up   # sobe o Postgres de teste (porta 5434, dados em memória)
npm test             # unitários + integração
```

| Comando | O que faz |
|---|---|
| `npm test` | Tudo, uma vez |
| `npm run test:unit` | Só os unitários (não precisa de Docker) |
| `npm run test:integration` | Só a integração |
| `npm run test:watch` | Modo watch |
| `npm run test:coverage` | Tudo + relatório de cobertura em `backend/coverage/` (falha se as regras puras ficarem abaixo de 90%) |
| `npm run test:db:down` | Para o Postgres de teste |

### Como funciona o banco de teste

- É o serviço `postgres-test` do [`backend/docker-compose.yml`](backend/docker-compose.yml): separado do banco de desenvolvimento (porta 5434, banco `arenabeach_test`), com os dados em `tmpfs`. Parar o container apaga tudo.
- Antes da suíte, o `prisma migrate deploy` aplica as migrations. Antes de **cada teste**, todas as tabelas são truncadas.
- Por segurança, a suíte se recusa a rodar se o `DATABASE_URL` não apontar para um banco terminado em `_test`.
- No CI (ou com outro Postgres), defina `TEST_DATABASE_URL`, por exemplo `postgresql://postgres:postgres@localhost:5432/arenabeach_test`.

### Escrevendo testes

- **Fábricas** em [`backend/tests/integration/helpers/factories.ts`](backend/tests/integration/helpers/factories.ts): `makeUser`, `makeArena`, `makeCourt`, `makeBooking`, `makeMatch`, mais `authHeader(user)` (JWT pronto para o supertest) e `localSlot(dias, minutos)` (horário local da arena).
- **Relógio injetável:** os services aceitam `now` como último parâmetro. Passe uma data fixa em vez de depender do relógio real.
- **Concorrência:** dispare as operações com `Promise.allSettled([...])` e verifique o **estado final no banco**, não só as respostas.

### Regra: todo bug corrigido entra com um teste de regressão

O teste deve falhar sem a correção e passar com ela. Use "regressão" no nome do teste e explique em um comentário qual cenário quebrava. Veja exemplos em `tests/integration/bookings.test.ts` (cancelamento × pagamento) e `tests/unit/admin-schemas.test.ts` (data malformada no bloqueio).

## Variáveis de ambiente

### `backend/.env`

| Variável | Obrigatória | Padrão | Descrição |
|---|---|---|---|
| `DATABASE_URL` | ✅ | — | Conexão com o PostgreSQL |
| `JWT_SECRET` | ✅ | — | Segredo dos tokens (mín. 32 caracteres) |
| `JWT_EXPIRES_IN` | | `1d` | Validade do login |
| `PORT` | | `3333` | Porta da API |
| `CORS_ORIGINS` | | `http://localhost:5173` | Origens permitidas, separadas por vírgula |
| `BOOKING_EXPIRATION_SWEEP_MS` | | `30000` | Intervalo do worker que cancela reservas não pagas |
| `NODE_ENV` | | `development` | `development`, `test` ou `production` |

### `frontend/.env` (opcional)

| Variável | Padrão | Descrição |
|---|---|---|
| `VITE_API_URL` | `/api/v1` | Em dev, deixe o padrão (proxy). Em produção, a URL completa da API |
| `VITE_USE_MOCKS` | `false` | `true` usa dados falsos de quadras e reservas, sem backend |

## Regras de negócio

| Regra | Valor | Onde ajustar |
|---|---|---|
| Prazo para pagar uma reserva | 15 min | `backend/src/modules/bookings/booking-policy.ts` |
| Antecedência mínima para cancelar reserva paga | 24 h | `booking-policy.ts` |
| Antecedência máxima para reservar | 60 dias | `bookings/slot-rules.ts` |
| Sala ao vivo pode ser aberta | até 2 h antes do horário reservado | `matches/match-policy.ts` |
| Formatos pontuados no ranking | 1x1 ou 2x2 | `match-policy.ts` |
| Tentativas de PIN | 20 a cada 10 min por usuário | `matches/matches.routes.ts` |
| Fator K do ELO / ELO mínimo | 32 / 100 | `rating/elo.service.ts` |

**Categorias por ELO** (fonte única em [`rating/categories.ts`](backend/src/modules/rating/categories.ts)):

| Categoria | ELO |
|---|---|
| Iniciante | < 1200 |
| D | 1200 – 1399 |
| C | 1400 – 1599 |
| B | 1600 – 1799 |
| A | ≥ 1800 |

**Como o ELO é calculado:** a força de cada dupla é a média do ELO dos jogadores. A chance de vitória é `E = 1 / (1 + 10^((Rb − Ra) / 400))` e a variação é `K × (resultado − E)`. Vencer uma dupla mais forte rende mais pontos; perder para uma mais fraca custa mais. O que uma dupla ganha, a outra perde.

## API

Base: `/api/v1`. 🔒 = exige `Authorization: Bearer <token>`.

<details>
<summary><strong>Autenticação e usuários</strong></summary>

| Método | Rota | |
|---|---|---|
| POST | `/auth/register` | Cadastro |
| POST | `/auth/login` | Login (retorna o JWT) |
| GET | `/users/me` | 🔒 Perfil, com ELO e categoria calculada (`rank`) |
| PATCH | `/users/profile` | 🔒 Nome, telefone, bio |
| POST | `/users/profile/photo` | 🔒 Upload da foto (multipart, campo `photo`) |
| DELETE | `/users/profile/photo` | 🔒 Remove a foto |

</details>

<details>
<summary><strong>Quadras e reservas</strong></summary>

| Método | Rota | |
|---|---|---|
| GET | `/courts` | Quadras da arena |
| GET | `/courts/:id/availability?date=AAAA-MM-DD` | Grade de horários do dia |
| POST | `/bookings` | 🔒 Cria reserva (aguardando pagamento) |
| POST | `/bookings/:id/pay` | 🔒 Pagamento simulado (410 se o prazo expirou) |
| PATCH | `/bookings/:id/cancel` | 🔒 Cancela a própria reserva |
| GET | `/bookings/me?scope=upcoming\|past` | 🔒 Minhas reservas |

</details>

<details>
<summary><strong>Aulas</strong></summary>

| Método | Rota | |
|---|---|---|
| GET | `/teachers` | Professores |
| GET | `/lessons?level=&teacherId=&days=` | Próximas aulas |
| POST | `/lessons` | 🔒 Cria aula avulsa ou semanal (professor ou admin) |
| POST | `/lessons/:id/enroll` | 🔒 Inscrever-se |
| DELETE | `/lessons/:id/enroll` | 🔒 Sair da turma |

</details>

<details>
<summary><strong>Partidas ao vivo e ranking</strong></summary>

| Método | Rota | |
|---|---|---|
| GET | `/matches/current` | 🔒 Sala ativa do usuário |
| GET | `/matches/eligible-bookings` | 🔒 Reservas que podem virar sala |
| GET | `/matches/history` | 🔒 Últimas partidas pontuadas |
| GET | `/matches/:id` | 🔒 Estado da sala (usado pelo polling) |
| POST | `/matches/create` | 🔒 Abre a sala e gera o PIN `{ bookingId }` |
| POST | `/matches/join` | 🔒 Entra pelo PIN `{ pin }` |
| POST | `/matches/start` | 🔒 Inicia o jogo `{ matchId }` |
| POST | `/matches/:id/result/preview` | 🔒 Prévia: chance de vitória e +X/−Y `{ team1, team2 }` |
| POST | `/matches/:id/result` | 🔒 Registra o resultado e aplica o ELO `{ team1, team2, winnerTeam }` |
| POST | `/matches/finish` | 🔒 Encerra **sem** pontuar `{ matchId }` |
| POST | `/matches/leave` / `/matches/cancel` | 🔒 Sair da sala / cancelar antes de iniciar |

</details>

Os erros seguem sempre o formato `{ "status": "error", "code": "...", "message": "...", "details"?: {...} }`.

## Decisões técnicas

- **Reserva dupla é impossível também no banco.** Além da checagem no código, uma regra do PostgreSQL (`EXCLUDE USING gist`) recusa reservas sobrepostas na mesma quadra. Duas pessoas clicando no mesmo horário ao mesmo tempo nunca ficam com a mesma vaga. As aulas usam a mesma proteção, porque cada aula ocupa a quadra como uma reserva do tipo `CLASS`.
- **Operações disputadas são travadas.** Inscrição em aula, entrada na sala e registro do resultado usam transação com `SELECT … FOR UPDATE`. Vagas não estouram e o ELO nunca é aplicado duas vezes.
- **O prazo de pagamento vale no segundo exato.** Um worker cancela reservas vencidas a cada 30s, e a grade e a criação de reservas também liberam as vencidas na hora da consulta.
- **Algumas migrations foram ajustadas à mão** para preservar dados: renomear um status em vez de recriar o enum, e converter a categoria antiga em ELO antes de remover a coluna. Os comentários em cada `migration.sql` explicam o motivo.
- **O upload é independente do provedor.** As fotos passam pela interface `StorageProvider`: hoje vão para o disco local e, em produção, para S3 ou Cloudinary. Trocar é uma linha em `shared/providers/storage/index.ts`. O tipo real do arquivo é conferido pelos primeiros bytes, e não só pelo `Content-Type` enviado.
- **Fuso horário:** o banco guarda tudo em UTC, e a grade e o horário de funcionamento são calculados no fuso da arena (`America/Sao_Paulo`).

## Solução de problemas

| Sintoma | Causa provável / solução |
|---|---|
| `Can't reach database server` | Docker Desktop fechado ou container parado: `docker compose up -d` em `backend/` |
| `EPERM … query_engine-windows.dll.node` no `prisma generate` | O backend está rodando e travando o arquivo (Windows). Pare o `npm run dev` e rode de novo |
| Porta 3333 ocupada mesmo após parar o backend | Sobrou um processo `tsx watch` no Windows: `npx kill-port 3333` |
| Classes do Tailwind não aplicadas em um componente novo | Reinicie o `npm run dev` do frontend (o build de produção não é afetado) |
| Login dá "Erro inesperado" | A API não está no ar: confira o terminal do backend e `GET /api/v1/health` |
| `Não foi possível preparar o banco de teste` no `npm test` | O Postgres de teste não está no ar: `npm run test:db:up` em `backend/` (com o Docker Desktop aberto) |

## Próximos passos

- [ ] Gateway de pagamento real (Mercado Pago ou Stripe) com confirmação por webhook e divisão do valor
- [ ] Atualização da sala em tempo real com WebSocket (hoje: polling a cada 3s)
- [X] Painel administrativo da arena (horários, faturamento, bloqueio de quadras, alunos)
- [ ] Alerta de chuva para os horários reservados (API de clima)
- [ ] Galeria de fotos e vídeos das partidas
- [ ] Fator K maior nas primeiras partidas de cada jogador
- [X] Testes automatizados (unitários das regras de ELO e de horários; integração das rotas)
- [ ] CI com GitHub Actions rodando a suíte de testes
- [ ] Testes do frontend e E2E
- [ ] Refresh token em cookie `httpOnly` (hoje o JWT fica no `localStorage`)

## Licença

Ainda não definida. Até que uma licença seja adicionada, todos os direitos são reservados ao autor.
