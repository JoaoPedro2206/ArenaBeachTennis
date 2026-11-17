# Como contribuir

## Antes de abrir um PR

No `backend/`:

```bash
npm run typecheck
npm run test:db:up   # uma vez por sessão (Postgres de teste)
npm test
```

Detalhes da suíte, das fábricas e do banco de teste estão na seção [Testes do README](README.md#testes).

## Testes obrigatórios

- **Todo bug corrigido entra com um teste de regressão.** Ele deve falhar sem a correção e passar com ela. Coloque "regressão" no nome do teste e explique num comentário qual cenário quebrava.
- **Regra de negócio nova** (preço, horário, ELO, prazos) começa por uma função pura com teste unitário. As funções de `rating/`, `bookings/slot-rules.ts`, `pricing/pricing.ts`, `shared/utils/timezone.ts` e `admin/admin.schemas.ts` têm cobertura mínima de 90%, e o `npm run test:coverage` falha abaixo disso.
- **Concorrência:** quando duas requisições puderem disputar o mesmo recurso (horário, vaga na sala, pagamento), escreva um teste de integração que dispare as duas com `Promise.allSettled` e confira o estado final no banco.
- Nada de depender do relógio real: passe `now` para os services.
