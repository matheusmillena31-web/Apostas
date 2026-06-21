import { Play } from 'lucide-react';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { PageHeader } from '../components/PageHeader';
import { liveGames } from '../data/mockGames';
import { Bot } from '../types';
import { shouldEnter } from '../services/backtest';

type LiveGamesProps = {
  bots: Bot[];
};

export function LiveGames({ bots }: LiveGamesProps) {
  const activeBots = bots.filter((bot) => bot.isActive);

  return (
    <>
      <PageHeader
        title="Jogos ao vivo"
        description="Partidas simuladas em andamento, com odds e estatísticas mockadas para testar entradas sem conexão externa."
      />
      <div className="grid gap-4 xl:grid-cols-2">
        {liveGames.map((game) => {
          const snapshot = game.snapshots[game.currentMinute];
          const candidateBots = activeBots
            .map((bot) => ({ bot, decision: shouldEnter(bot, game, snapshot) }))
            .filter((item) => item.decision.passed);

          return (
            <Card key={game.id} title={`${game.homeTeam} x ${game.awayTeam}`} subtitle={`${game.league} | ${game.currentMinute}'`}>
              <div className="mb-4 flex items-center justify-between rounded-lg bg-ink-900 p-4">
                <div className="text-center">
                  <p className="text-sm text-slate-400">{game.homeTeam}</p>
                  <p className="mt-1 text-2xl font-semibold text-white">{snapshot.scoreHome}</p>
                </div>
                <span className="text-sm text-slate-500">ao vivo</span>
                <div className="text-center">
                  <p className="text-sm text-slate-400">{game.awayTeam}</p>
                  <p className="mt-1 text-2xl font-semibold text-white">{snapshot.scoreAway}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-sm">
                <div className="rounded-md bg-ink-900 p-3">Casa <strong className="block text-white">{snapshot.homeOdd}</strong></div>
                <div className="rounded-md bg-ink-900 p-3">Empate <strong className="block text-white">{snapshot.drawOdd}</strong></div>
                <div className="rounded-md bg-ink-900 p-3">Fora <strong className="block text-white">{snapshot.awayOdd}</strong></div>
              </div>
              <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                <p>Finalizações: <span className="text-white">{snapshot.stats.shots}</span></p>
                <p>No alvo: <span className="text-white">{snapshot.stats.shotsOnTarget}</span></p>
                <p>Ataques perigosos: <span className="text-white">{snapshot.stats.dangerousAttacks}</span></p>
                <p>Escanteios: <span className="text-white">{snapshot.stats.corners}</span></p>
                <p>Posse: <span className="text-white">{snapshot.stats.possession}%</span></p>
                <p>Pressão: <span className="text-white">{snapshot.stats.offensivePressure}</span></p>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-slate-400">
                  {candidateBots.length ? `${candidateBots.length} bot(s) entrariam agora.` : 'Nenhum bot ativo entraria neste minuto.'}
                </p>
                <Button variant="secondary" icon={<Play className="h-4 w-4" />}>Simular entrada</Button>
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}
