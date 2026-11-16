import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { UpcomingBookings } from '@/components/booking/UpcomingBookings';
import { EditProfileSheet } from '@/components/profile/EditProfileSheet';
import { useAuth } from '@/hooks/useAuth';
import { maskPhone } from '@/lib/profileForm';
import { authService } from '@/services/authService';
import { MatchHistory } from '@/components/rating/MatchHistory';
import { RankCard } from '@/components/rating/RankCard';

export default function ProfilePage() {
  const { user, logout, setUser } = useAuth();
  const [editing, setEditing] = useState(false);

  // O ELO muda em partidas de outras pessoas também: recarrega ao abrir o perfil
  useEffect(() => {
    authService.me().then(setUser).catch(() => undefined);
  }, [setUser]);

  if (!user) return null;
  const memberSince = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date(user.createdAt));

  return (
    <div className="space-y-8">
      {/* Cartão de identidade */}
      <section className="relative overflow-hidden rounded-xl bg-ink p-6 text-white shadow-md sm:p-8">
        {/* Sol do logo como elemento gráfico de fundo */}
        <div aria-hidden className="absolute -top-16 -right-16 size-48 rounded-full bg-cta/90 blur-[2px]" />
        <div aria-hidden className="absolute -right-4 -bottom-20 size-40 rounded-full bg-primary/50 blur-2xl" />

        <div className="relative flex items-center gap-4">
          <Avatar name={user.name} src={user.profilePhoto} size={76} className="ring-4 ring-white/15" />
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-extrabold">{user.name}</h1>
            <p className="truncate text-sm text-white/70">{user.email}</p>
            {user.phone && <p className="truncate text-sm text-white/70 tabular-nums">{maskPhone(user.phone)}</p>}
          </div>
        </div>

        {user.bio && <p className="relative mt-5 max-w-md text-[15px] leading-relaxed text-white/85">{user.bio}</p>}

        <div className="relative mt-6 flex items-center justify-between gap-3">
          <p className="text-[13px] text-white/60">Jogador desde {memberSince}</p>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full bg-white/12 px-4 text-sm font-bold whitespace-nowrap text-white ring-1 ring-white/20 backdrop-blur transition-all hover:bg-white/20 active:scale-95"
          >
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
            Editar perfil
          </button>
        </div>
      </section>

      {/* Categoria (medalha) + progresso para a próxima */}
      <RankCard rank={user.rank} />

      <section>
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-xl font-extrabold text-ink">Últimas partidas</h2>
          <span className="text-xs font-semibold text-ink-subtle">variação no ranking</span>
        </div>
        <MatchHistory />
      </section>

      <section>
        <h2 className="mb-4 text-xl font-extrabold text-ink">Minhas reservas</h2>
        <UpcomingBookings limit={20} cancellable />
      </section>

      <Button variant="danger" onClick={logout}>
        Sair da conta
      </Button>

      {editing && <EditProfileSheet onClose={() => setEditing(false)} />}
    </div>
  );
}

