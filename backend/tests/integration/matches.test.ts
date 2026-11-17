import { describe, expect, it } from 'vitest';
import { prisma } from '../../src/shared/database/prisma';
import { MatchesService } from '../../src/modules/matches/matches.service';
import { makeMatch, makeUser } from './helpers/factories';

const service = new MatchesService();

const rejectionsOf = (results: PromiseSettledResult<unknown>[]) =>
  results.filter((r): r is PromiseRejectedResult => r.status === 'rejected').map((r) => r.reason);

describe('entrar na sala', () => {
  it('toque duplo em "Entrar": as duas chamadas funcionam e o jogador entra uma vez só', async () => {
    const { match } = await makeMatch();
    const guest = await makeUser();

    const results = await Promise.allSettled([service.join(guest.id, match.pinCode!), service.join(guest.id, match.pinCode!)]);

    expect(rejectionsOf(results)).toEqual([]);
    expect(await prisma.matchParticipant.count({ where: { matchSessionId: match.id, userId: guest.id } })).toBe(1);
    expect(await prisma.matchParticipant.count({ where: { matchSessionId: match.id } })).toBe(2);
  });

  it('entrar de novo depois de já estar na sala é idempotente', async () => {
    const guest = await makeUser();
    const { match } = await makeMatch({ players: [guest] });
    const view = await service.join(guest.id, match.pinCode!);
    expect(view.participants).toHaveLength(2);
  });

  it('sala cheia sob concorrência: nunca passa do limite', async () => {
    const { match } = await makeMatch({ maxPlayers: 4 }); // anfitrião + 3 vagas
    const guests = await Promise.all(Array.from({ length: 7 }, () => makeUser()));

    const results = await Promise.allSettled(guests.map((g) => service.join(g.id, match.pinCode!)));

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(3);
    const errors = rejectionsOf(results);
    expect(errors).toHaveLength(4);
    for (const error of errors) expect(error).toMatchObject({ statusCode: 409, message: 'A sala está cheia' });
    expect(await prisma.matchParticipant.count({ where: { matchSessionId: match.id } })).toBe(4);
  });

  it('PIN de sala encerrada não funciona', async () => {
    const { match } = await makeMatch({ status: 'CANCELLED' });
    await expect(service.join((await makeUser()).id, match.pinCode!)).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('iniciar × cancelar', () => {
  it('simultâneos: só um vence e a sala termina num estado coerente', async () => {
    for (let i = 0; i < 10; i++) {
      const guest = await makeUser();
      const { match, host } = await makeMatch({ players: [guest] });

      const [start, cancel] = await Promise.allSettled([service.start(host.id, match.id), service.cancel(host.id, match.id)]);

      expect([start.status, cancel.status].sort()).toEqual(['fulfilled', 'rejected']);
      expect(rejectionsOf([start, cancel])[0]).toMatchObject({ statusCode: 409 });

      const final = await prisma.matchSession.findUniqueOrThrow({ where: { id: match.id } });
      if (start.status === 'fulfilled') {
        expect(final).toMatchObject({ status: 'IN_PROGRESS' });
        expect(final.startedAt).not.toBeNull();
      } else {
        // cancelada nunca "ressuscita" como iniciada
        expect(final).toMatchObject({ status: 'CANCELLED', pinCode: null, startedAt: null });
      }
    }
  });
});

describe('registrar resultado', () => {
  const inProgress1x1 = async () => {
    const guest = await makeUser({ eloScore: 1000 });
    const host = await makeUser({ eloScore: 1000 });
    const { match, booking } = await makeMatch({ host, players: [guest], status: 'IN_PROGRESS' });
    return { match, booking, host, guest, result: { team1: [host.id], team2: [guest.id], winnerTeam: 1 as const } };
  };

  it('duas vezes ao mesmo tempo: uma vence, a outra 409, e o ELO é aplicado uma vez', async () => {
    const { match, booking, host, guest, result } = await inProgress1x1();

    const results = await Promise.allSettled([
      service.recordResult(host.id, match.id, result),
      service.recordResult(host.id, match.id, result),
    ]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(rejectionsOf(results)[0]).toMatchObject({ statusCode: 409, message: 'O resultado desta partida já foi registrado' });

    const [winner, loser] = await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { id: host.id } }),
      prisma.user.findUniqueOrThrow({ where: { id: guest.id } }),
    ]);
    expect(winner.eloScore).toBe(1016);
    expect(loser.eloScore).toBe(984);
    expect(await prisma.matchResult.count({ where: { matchSessionId: match.id } })).toBe(1);
    expect(await prisma.matchSession.findUniqueOrThrow({ where: { id: match.id } })).toMatchObject({ status: 'FINISHED', pinCode: null });
    expect(await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).toMatchObject({ status: 'COMPLETED' });
  });

  it('segunda chamada depois da primeira também é 409 e não mexe no ELO', async () => {
    const { match, host, guest, result } = await inProgress1x1();
    await service.recordResult(host.id, match.id, result);

    await expect(service.recordResult(host.id, match.id, result)).rejects.toMatchObject({ statusCode: 409 });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: guest.id } })).eloScore).toBe(984);
  });

  it('grava a "foto" antes/depois de cada jogador', async () => {
    const { match, host, guest, result } = await inProgress1x1();
    const view = await service.recordResult(host.id, match.id, result);

    expect(view.participants.find((p) => p.userId === host.id)).toMatchObject({ team: 1, eloBefore: 1000, eloAfter: 1016, eloDelta: 16 });
    expect(view.participants.find((p) => p.userId === guest.id)).toMatchObject({ team: 2, eloBefore: 1000, eloAfter: 984, eloDelta: -16 });
  });

  it('ELO no piso: o delta gravado é o realmente aplicado', async () => {
    const guest = await makeUser({ eloScore: 105 });
    const host = await makeUser({ eloScore: 105 });
    const { match } = await makeMatch({ host, players: [guest], status: 'IN_PROGRESS' });

    const view = await service.recordResult(host.id, match.id, { team1: [host.id], team2: [guest.id], winnerTeam: 1 });
    expect(view.participants.find((p) => p.userId === guest.id)).toMatchObject({ eloAfter: 100, eloDelta: -5 });
  });

  it('só o anfitrião registra', async () => {
    const { match, guest, result } = await inProgress1x1();
    await expect(service.recordResult(guest.id, match.id, result)).rejects.toMatchObject({ statusCode: 403 });
  });
});
