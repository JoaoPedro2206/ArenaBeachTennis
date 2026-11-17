import { describe, expect, it } from 'vitest';
import {
  MAX_BLOCK_DAYS,
  agendaQuerySchema,
  blockSchema,
  courtStatusSchema,
  idParamsSchema,
  pricingSchema,
  reportsQuerySchema,
} from '../../src/modules/admin/admin.schemas';

const COURT = '6f1c2b8a-3f7e-4b8e-9a51-2f0c8d4e7a10';
const OTHER = 'a3b4c5d6-1111-4222-8333-944455556666';

/** Mensagens de erro de um safeParse, para conferir o motivo da recusa */
function errors(result: { success: boolean; error?: { issues: Array<{ message: string }> } }): string[] {
  return result.success ? [] : result.error!.issues.map((i) => i.message);
}

describe('blockSchema', () => {
  const valid = { courtId: COURT, startTime: '2026-11-20T08:00:00-03:00', endTime: '2026-11-20T12:00:00-03:00', reason: ' Troca da areia ' };

  it('aceita um bloqueio válido e converte as datas', () => {
    const parsed = blockSchema.parse(valid);
    expect(parsed.startTime).toEqual(new Date('2026-11-20T11:00:00Z'));
    expect(parsed.endTime).toEqual(new Date('2026-11-20T15:00:00Z'));
    expect(parsed.reason).toBe('Troca da areia');
  });

  it('motivo é opcional', () => {
    const { reason: _reason, ...withoutReason } = valid;
    expect(blockSchema.safeParse(withoutReason).success).toBe(true);
  });

  it('fim precisa ser depois do início', () => {
    expect(errors(blockSchema.safeParse({ ...valid, endTime: valid.startTime }))).toContain('O fim precisa ser depois do início');
    expect(errors(blockSchema.safeParse({ ...valid, endTime: '2026-11-20T07:00:00-03:00' }))).toContain(
      'O fim precisa ser depois do início',
    );
  });

  it(`no máximo ${MAX_BLOCK_DAYS} dias (borda inclusiva)`, () => {
    expect(blockSchema.safeParse({ ...valid, endTime: '2026-12-21T08:00:00-03:00' }).success).toBe(true);
    expect(errors(blockSchema.safeParse({ ...valid, endTime: '2026-12-21T08:01:00-03:00' }))[0]).toContain(
      `no máximo ${MAX_BLOCK_DAYS} dias`,
    );
  });

  it('exige data/hora com fuso (e recusa sem estourar exceção)', () => {
    // Regressão: data malformada fazia o refine chamar getTime() numa string (500)
    expect(errors(blockSchema.safeParse({ ...valid, startTime: '2026-11-20T08:00:00' }))).toEqual([
      'o início: use data/hora ISO 8601 com fuso',
    ]);
    expect(blockSchema.safeParse({ ...valid, endTime: '20/11/2026 08:00' }).success).toBe(false);
    expect(blockSchema.safeParse({ ...valid, startTime: undefined }).success).toBe(false);
  });

  it('recusa quadra inválida, motivo longo e campos extras', () => {
    expect(errors(blockSchema.safeParse({ ...valid, courtId: 'quadra-1' }))).toContain('ID de quadra inválido');
    expect(errors(blockSchema.safeParse({ ...valid, reason: 'x'.repeat(201) }))).toContain('Motivo muito longo');
    expect(blockSchema.safeParse({ ...valid, status: 'CONFIRMED' }).success).toBe(false);
  });
});

describe('pricingSchema', () => {
  const nobre = { name: 'Nobre', courtId: null, daysOfWeek: [5, 1, 3, 1], startTime: '18:00', endTime: '22:00', pricePerHour: 15_000 };
  const valid = { courts: [{ courtId: COURT, pricePerHour: 10_000 }], rules: [nobre] };

  it('aceita a configuração e normaliza os dias (sem repetição, ordenados)', () => {
    const parsed = pricingSchema.parse(valid);
    expect(parsed.rules[0].daysOfWeek).toEqual([1, 3, 5]);
    expect(parsed.rules[0].courtId).toBeNull();
  });

  it('regra de uma quadra específica', () => {
    expect(pricingSchema.safeParse({ ...valid, rules: [{ ...nobre, courtId: OTHER }] }).success).toBe(true);
  });

  it('fim "00:00" (meia-noite) é aceito', () => {
    expect(pricingSchema.safeParse({ ...valid, rules: [{ ...nobre, startTime: '22:00', endTime: '00:00' }] }).success).toBe(true);
  });

  it('janela vazia ou invertida é recusada', () => {
    for (const window of [
      { startTime: '18:00', endTime: '18:00' },
      { startTime: '22:00', endTime: '18:00' },
      { startTime: '23:00', endTime: '01:00' }, // cruzar a meia-noite não é suportado: use duas regras
    ]) {
      expect(errors(pricingSchema.safeParse({ ...valid, rules: [{ ...nobre, ...window }] }))).toContain(
        'O horário final precisa ser depois do inicial',
      );
    }
  });

  it('o dia inteiro (00:00–00:00) é aceito', () => {
    expect(pricingSchema.safeParse({ ...valid, rules: [{ ...nobre, startTime: '00:00', endTime: '00:00' }] }).success).toBe(true);
  });

  it.each([
    ['24:00', 'hora inexistente'],
    ['7:30', 'sem zero à esquerda'],
    ['18:60', 'minuto inexistente'],
  ])('horário "%s" é recusado (%s)', (time) => {
    expect(errors(pricingSchema.safeParse({ ...valid, rules: [{ ...nobre, startTime: time }] }))).toContain('Use o formato HH:mm');
  });

  it('dias da semana: ao menos um, entre 0 e 6', () => {
    expect(errors(pricingSchema.safeParse({ ...valid, rules: [{ ...nobre, daysOfWeek: [] }] }))).toContain('Escolha ao menos um dia');
    expect(pricingSchema.safeParse({ ...valid, rules: [{ ...nobre, daysOfWeek: [7] }] }).success).toBe(false);
    expect(pricingSchema.safeParse({ ...valid, rules: [{ ...nobre, daysOfWeek: [-1] }] }).success).toBe(false);
  });

  it('preço: inteiro em centavos, não negativo, até R$ 10.000/h', () => {
    const withPrice = (pricePerHour: unknown) => pricingSchema.safeParse({ ...valid, rules: [{ ...nobre, pricePerHour }] });
    expect(withPrice(0).success).toBe(true);
    expect(withPrice(1_000_000).success).toBe(true);
    expect(errors(withPrice(-1))).toContain('O preço não pode ser negativo');
    expect(errors(withPrice(150.5))).toContain('Preço em centavos');
    expect(errors(withPrice(1_000_001))).toContain('Preço acima do limite de R$ 10.000/h');
    expect(errors(withPrice(undefined))).toContain('Informe o preço');
    // o preço base da quadra segue a mesma regra
    expect(pricingSchema.safeParse({ ...valid, courts: [{ courtId: COURT, pricePerHour: -5 }] }).success).toBe(false);
  });

  it('nome obrigatório e curto', () => {
    expect(errors(pricingSchema.safeParse({ ...valid, rules: [{ ...nobre, name: '   ' }] }))).toContain('Dê um nome à regra');
    expect(errors(pricingSchema.safeParse({ ...valid, rules: [{ ...nobre, name: 'x'.repeat(61) }] }))).toContain('Nome muito longo');
  });

  it('no máximo 50 regras', () => {
    expect(pricingSchema.safeParse({ ...valid, rules: Array(50).fill(nobre) }).success).toBe(true);
    expect(errors(pricingSchema.safeParse({ ...valid, rules: Array(51).fill(nobre) }))).toContain('Máximo de 50 regras de preço');
  });

  it('recusa campos desconhecidos (ex.: arenaId forjado)', () => {
    expect(pricingSchema.safeParse({ ...valid, rules: [{ ...nobre, arenaId: OTHER }] }).success).toBe(false);
    expect(pricingSchema.safeParse({ ...valid, extra: true }).success).toBe(false);
  });
});

describe('demais schemas do painel', () => {
  it('agenda: data real no formato YYYY-MM-DD', () => {
    expect(agendaQuerySchema.safeParse({ date: '2026-02-28' }).success).toBe(true);
    expect(errors(agendaQuerySchema.safeParse({ date: '2026-02-30' }))).toContain('Data inválida');
    expect(errors(agendaQuerySchema.safeParse({ date: '28/02/2026' }))).toContain('Use o formato YYYY-MM-DD');
    expect(agendaQuerySchema.safeParse({}).success).toBe(true);
  });

  it('relatórios: mês YYYY-MM válido', () => {
    expect(reportsQuerySchema.safeParse({ month: '2026-12' }).success).toBe(true);
    expect(reportsQuerySchema.safeParse({ month: '2026-13' }).success).toBe(false);
    expect(reportsQuerySchema.safeParse({ month: '2026-1' }).success).toBe(false);
    expect(errors(reportsQuerySchema.safeParse({ arenaId: 'x' }))).toContain('ID de arena inválido');
  });

  it('status da quadra: só ACTIVE ou MAINTENANCE', () => {
    expect(courtStatusSchema.safeParse({ status: 'MAINTENANCE' }).success).toBe(true);
    expect(errors(courtStatusSchema.safeParse({ status: 'INACTIVE' }))).toContain('Status deve ser ACTIVE ou MAINTENANCE');
  });

  it('id na URL precisa ser UUID', () => {
    expect(idParamsSchema.safeParse({ id: COURT }).success).toBe(true);
    expect(errors(idParamsSchema.safeParse({ id: '1' }))).toContain('ID inválido');
  });
});
