---
title: "Privacidade e LGPD: exclusão de conta, exportação de dados e consentimento"
labels: feature, security, backend, frontend, legal, P1
---

## Contexto

O app coleta dados pessoais (nome, e-mail, telefone, foto, bio, histórico de reservas e partidas, pontuação ELO). Para operar no Brasil é preciso atender à **LGPD**: o titular deve conseguir acessar, corrigir, exportar e **excluir** seus dados, e o consentimento/termos devem ser registrados.

Hoje:
- Não há "Excluir minha conta" nem "Baixar meus dados".
- Não há Termos de Uso / Política de Privacidade nem registro de aceite no cadastro.
- `MatchParticipant`, `Booking` e `MatchResult` referenciam `User` com `onDelete: Restrict` ou `Cascade` de forma mista: apagar um usuário hoje **falharia** (reservas, resultados registrados) ou apagaria histórico de outras pessoas (participações).

## Objetivo

Cumprir os direitos básicos do titular sem corromper o histórico de outros usuários e das arenas (ranking, financeiro).

## Escopo

### Consentimento
- [ ] Páginas públicas **Termos de Uso** e **Política de Privacidade** (conteúdo a ser fornecido/validado juridicamente).
- [ ] No cadastro: checkbox obrigatório de aceite; gravar `User.termsAcceptedAt` e `User.termsVersion`.
- [ ] Reaceite quando a versão dos termos mudar.

### Exportação ("Baixar meus dados")
- [ ] `GET /users/me/export` gera um JSON (ou ZIP) com: perfil, reservas, participações em partidas, resultados/ELO, matrículas em aulas. Sem dados de terceiros (nomes de adversários só pelo primeiro nome, como já é no histórico).
- [ ] Botão em Perfil → "Privacidade".

### Exclusão de conta
- [ ] `DELETE /users/me` com confirmação por senha.
- [ ] **Anonimização** em vez de apagar linhas: substituir nome por "Jogador removido", e-mail por um valor inerte, apagar telefone, bio e foto (incluindo o arquivo no storage), `isActive=false`, invalidar sessões. Isso preserva a integridade de reservas, partidas e ranking de terceiros.
- [ ] Reservas futuras pagas: bloquear a exclusão com mensagem ("cancele suas reservas antes") ou cancelar com estorno seguindo a política — **decisão de produto**.
- [ ] Dono de arena (`ARENA_ADMIN`) e professor: exigir transferência/desativação antes (a FK `Arena.ownerId` é `Restrict`).
- [ ] Período de arrependimento opcional (ex.: 7 dias antes da anonimização definitiva).

### Retenção e logs
- [ ] Definir prazo de retenção para dados financeiros (obrigação fiscal) vs. dados de perfil.
- [ ] Garantir que logs de aplicação não contenham dados pessoais (ver issue de observabilidade).

## Critérios de aceite

- [ ] Usuário consegue exportar e excluir a conta pela interface.
- [ ] Após a exclusão: login impossível, foto removida do storage, nenhum dado pessoal restante em `users`, histórico de outros jogadores intacto (teste automatizado verificando o ranking de um adversário).
- [ ] Aceite dos termos registrado com versão e data.
- [ ] Documento `docs/lgpd.md` com o inventário de dados pessoais (o que, por quê, onde, por quanto tempo).

## Notas técnicas

- Revisar as relações do `schema.prisma` (`onDelete`) e decidir por soft-delete/anonimização; **não** trocar para `Cascade` para "fazer funcionar".
- `StorageProvider.delete` já existe e é usado na troca de foto.

## Fora de escopo

- Redação jurídica dos termos.
- Encarregado de dados (DPO) e canal de atendimento ao titular — processo da empresa.

## Depende de / relacionado

- "Recuperação de senha e verificação de e-mail".
- "Pagamento real" (dados financeiros).
