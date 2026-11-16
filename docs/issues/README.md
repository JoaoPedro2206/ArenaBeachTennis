# Backlog do ArenaBeach (issues)

Cada arquivo `NN-*.md` desta pasta é uma issue pronta para o GitHub: contexto (com o que já existe no código), objetivo, escopo em checklist, critérios de aceite, riscos e dependências.

## Publicar no GitHub

1. Instale o [GitHub CLI](https://cli.github.com) e autentique: `gh auth login`.
2. Veja o que será criado, sem enviar nada:

   ```powershell
   .\scripts\create-issues.ps1 -DryRun
   ```

3. Crie as issues (cria os labels, pula títulos que já existem — pode rodar de novo sem duplicar):

   ```powershell
   .\scripts\create-issues.ps1
   ```

   Só algumas: `.\scripts\create-issues.ps1 -Only 1,6,8`

> Sem o `gh`, copie o conteúdo de cada arquivo (sem o cabeçalho entre `---`) para uma nova issue e use `title`/`labels` do cabeçalho.

## Prioridades

- **P0** — bloqueia colocar uma arena para operar de verdade.
- **P1** — necessário logo após o lançamento / reduz risco.
- **P2** — melhora e crescimento.

## Ordem sugerida

| # | Issue | Prioridade | Área |
|---|-------|:---:|------|
| 08 | CI com GitHub Actions | P0 | infra |
| 06 | Testes automatizados do backend | P0 | testes |
| 01 | Pagamento real (Pix e cartão) | P0 | pagamentos |
| 02 | Recuperação de senha e verificação de e-mail | P0 | autenticação |
| 19 | Painel do dono: gerenciar reservas | P0 | admin |
| 11 | Ranking: confirmação do resultado pelos adversários | P0 | ranking |
| 03 | Sessão: refresh token e backend indisponível | P1 | autenticação |
| 04 | Segurança: endurecimento | P1 | segurança |
| 05 | Privacidade e LGPD | P1 | legal |
| 07 | Testes do frontend e E2E | P1 | testes |
| 09 | Deploy: Docker e ambientes | P1 | infra |
| 10 | Observabilidade | P1 | infra |
| 12 | Ranking: calibração e anti-abuso | P1 | ranking |
| 13 | Ranking público, evolução do ELO e conquistas | P1 | ranking |
| 14 | Partidas abertas | P1 | partidas |
| 17 | Notificações | P1 | notificações |
| 20 | Painel do dono: quadras, arenas, professores e aulas | P1 | admin |
| 15 | Dividir o valor da quadra | P2 | pagamentos |
| 16 | WebSocket no lugar do polling | P2 | partidas |
| 18 | PWA | P2 | frontend |
| 21 | Reservas recorrentes e lista de espera | P2 | produto |
| 22 | Pacotes, cupons, avaliações, clima e torneios | P2 | produto |
| 23 | UX e acessibilidade | P2 | frontend |
| 24 | Painel do dono: relatórios avançados | P2 | admin |
| 25 | Dívida técnica geral | P2 | tech-debt |

## Dependências principais

```
08 CI ─┬─ 06 Testes backend ─┬─ 01 Pagamento ─── 15 Dividir valor
       │                     └─ 11 Confirmação ─ 12 Anti-abuso ─ 13 Ranking público
       └─ 07 Testes frontend
02 E-mail ─┬─ 03 Sessão
           └─ 17 Notificações ─┬─ 14 Partidas abertas
                               └─ 21 Recorrentes/lista de espera
19 Gestão de reservas ─ 20 Cadastros ─ 24 Relatórios
09 Deploy ─ 10 Observabilidade
```
