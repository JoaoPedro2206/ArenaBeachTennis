---
title: "Painel do dono: relatórios avançados, exportação e métricas de negócio"
labels: feature, admin, backend, frontend, P2
---

## Contexto

O dashboard atual (`GET /admin/reports`) responde o essencial do mês: receita (com comparação com o mês anterior), ocupação total e por quadra, ocupação por hora do dia (horários de pico), ticket médio e números de hoje. Limitações conhecidas dessa primeira versão:

- **Só um mês por vez**, sem intervalo livre, sem comparação com o mesmo período do ano anterior, sem visão semanal.
- **Ocupação mistura passado e futuro**: conta reservas futuras do mês (mostra "quanto o mês está vendido"), mas o dono também quer a **ocupação realizada** (só o que já passou) — hoje não dá para separar.
- **Aulas não entram no faturamento** (`CUSTOMER_TYPES` só inclui `REGULAR`/`OPEN_MATCH`), pois o valor é acertado direto; o dono pode querer ver a receita de aulas.
- Sem visão de **cancelamentos, no-shows, expirações (reservas não pagas), estornos** nem **taxa de conversão** (reservas criadas × pagas).
- Sem **exportação** (CSV/Excel/PDF) para contador e prestação de contas.
- Sem recorte por **dia da semana**, por **faixa de preço** (o efeito do horário nobre) ou por **canal** (app × balcão, depois da reserva manual).
- As consultas leem todas as reservas do mês em memória (`findBookingsForReport`) — ok para uma arena pequena, mas não escala para vários meses/arenas.

## Objetivo

Dar ao dono as respostas para decidir **preço, horário e promoção** — e entregar os números ao contador sem planilha manual.

## Escopo

### Métricas novas
- [ ] **Seletor de período** (hoje, 7 dias, mês, trimestre, ano, intervalo personalizado) com comparação "vs. período anterior" e "vs. mesmo período do ano anterior".
- [ ] **Ocupação realizada × projetada** (passado vs. futuro) e **ocupação por dia da semana** (mapa de calor dia × hora).
- [ ] **Receita por quadra, por faixa de preço/regra** (quanto o horário nobre rendeu), por forma de pagamento e por origem (app/balcão).
- [ ] **Funil**: reservas criadas → pagas; expiradas por falta de pagamento; canceladas (com e sem estorno); no-shows. Valor perdido por expiração/no-show.
- [ ] **Clientes**: novos × recorrentes, top clientes, frequência média, churn (quem parou de jogar há > 30 dias).
- [ ] **Aulas**: ocupação das turmas, receita estimada (alunos × preço), aulas mais/menos procuradas.
- [ ] **Sugestões acionáveis**: "Quinta 19h está 95 % ocupado — considere horário nobre", "Terça 14h está 5 % — considere promoção" (regras simples sobre os dados).

### Exportação
- [ ] CSV de reservas (período, quadra, cliente, valor, status de pagamento, forma, cupom) e de pagamentos/estornos — pronto para o contador.
- [ ] PDF/impressão do resumo mensal.
- [ ] Opção de **envio mensal automático** por e-mail ao dono.

### Desempenho e consistência
- [ ] Mover agregações para **SQL** (`GROUP BY`, `date_trunc` no fuso da arena, `generate_series`) em vez de somar em memória; índices nas colunas filtradas (`bookings(court_id, start_time)` já existe).
- [ ] Considerar tabela/materialized view de **agregados diários** por arena, atualizada por job, para períodos longos.
- [ ] Cache curto (1–5 min) nas respostas de relatório.
- [ ] Documentar **cada fórmula** (o que conta, o que não conta, fuso) em `docs/relatorios.md` para o dono confiar nos números.

### Interface
- [ ] Gráficos seguindo o guia de dataviz já adotado (uma série por gráfico, eixo único, tabela alternativa, tooltips); filtros em uma linha acima dos gráficos.
- [ ] Mapa de calor dia × hora (sequencial, uma cor).
- [ ] Estados de carregamento sem piscar ao trocar o período (já é o padrão do dashboard).

## Critérios de aceite

- [ ] Totais do relatório batem **exatamente** com a soma das reservas listadas/exportadas do mesmo período (teste automatizado com cenário montado à mão, inclusive virada de mês e fuso).
- [ ] Resposta em < 500 ms para 12 meses de dados de uma arena com 3 quadras (medido com seed grande).
- [ ] CSV abre corretamente no Excel pt-BR (separador `;`, vírgula decimal, UTF-8 com BOM) — ou oferecer as duas variantes.
- [ ] Dono de outra arena **não** acessa nenhum dado (teste de autorização).

## Fora de escopo

- Emissão de nota fiscal / integração contábil.
- BI genérico (consultas livres).

## Depende de / relacionado

- "Painel do dono: gerenciar reservas" (origem balcão, no-show, cancelamentos).
- "Pacotes e cupons" (receita por cupom).
- "Testes automatizados do backend".
