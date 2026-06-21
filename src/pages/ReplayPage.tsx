import { useEffect, useMemo, useState } from 'react';
import { Pause, Play, RotateCcw, SkipBack, SkipForward } from 'lucide-react';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Select } from '../components/FormControls';
import { PageHeader } from '../components/PageHeader';
import { historicalGames } from '../data/mockGames';
import { shouldEnter } from '../services/backtest';
import { Bot } from '../types';

type ReplayPageProps = {
  bots: Bot[];
  delay: number;
};

export function ReplayPage({ bots, delay }: ReplayPageProps) {
  const [gameId, setGameId] = useState(historicalGames[0]?.id ?? '');
  const [minute, setMinute] = useState(0);
  const [playing, setPlaying] = useState(false);
  const game = useMemo(() => historicalGames.find((item) => item.id === gameId) ?? historicalGames[0], [gameId]);
  const snapshot = game.snapshots[minute];
  const entrants = bots
    .filter((bot) => bot.isActive)
    .map((bot) => ({ bot, decision: shouldEnter(bot, game, snapshot) }))
    .filter((item) => item.decision.passed);

  useEffect(() => {
    if (!playing) return;
    const interval = window.setInterval(() => {
      setMinute((current) => {
        if (current >= 90) {
          setPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, delay);
    return () => window.clearInterval(interval);
  }, [playing, delay]);

  return (
    <>
      <PageHeader
        title="Replay de jogos"
        description="Escolha um jogo histórico e avance minuto a minuto para ver odds, estatísticas, eventos e bots que entrariam."
      />
      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <Card title="Controle do replay">
          <div className="grid gap-4 md:grid-cols-[1fr_auto]">
            <Select
              value={gameId}
              onChange={(event) => {
                setGameId(event.target.value);
                setMinute(0);
                setPlaying(false);
              }}
            >
              {historicalGames.map((item) => (
                <option key={item.id} value={item.id}>{item.homeTeam} x {item.awayTeam}</option>
              ))}
            </Select>
            <div className="flex gap-2">
              <Button variant="secondary" className="px-3" onClick={() => setMinute((value) => Math.max(0, value - 1))} icon={<SkipBack className="h-4 w-4" />} />
              <Button onClick={() => setPlaying((value) => !value)} icon={playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}>
                {playing ? 'Pausar' : 'Play'}
              </Button>
              <Button variant="secondary" className="px-3" onClick={() => setMinute((value) => Math.min(90, value + 1))} icon={<SkipForward className="h-4 w-4" />} />
              <Button variant="ghost" className="px-3" onClick={() => setMinute(0)} icon={<RotateCcw className="h-4 w-4" />} />
            </div>
          </div>

          <div className="mt-5 rounded-lg bg-ink-900 p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-slate-400">{game.league}</p>
                <h2 className="mt-1 text-xl font-semibold text-white">{game.homeTeam} x {game.awayTeam}</h2>
              </div>
              <div className="text-right">
                <p className="text-sm text-slate-400">Minuto</p>
                <p className="text-3xl font-semibold text-electric-500">{minute}'</p>
              </div>
            </div>
            <div className="mt-6 grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-sm text-slate-400">{game.homeTeam}</p>
                <p className="text-4xl font-semibold text-white">{snapshot.scoreHome}</p>
              </div>
              <div className="self-center text-sm text-slate-500">placar</div>
              <div>
                <p className="text-sm text-slate-400">{game.awayTeam}</p>
                <p className="text-4xl font-semibold text-white">{snapshot.scoreAway}</p>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-md bg-ink-900 p-3 text-sm">Over 1.5 <strong className="block text-white">{snapshot.over15Odd}</strong></div>
            <div className="rounded-md bg-ink-900 p-3 text-sm">Over 2.5 <strong className="block text-white">{snapshot.over25Odd}</strong></div>
            <div className="rounded-md bg-ink-900 p-3 text-sm">Under 2.5 <strong className="block text-white">{snapshot.under25Odd}</strong></div>
            <div className="rounded-md bg-ink-900 p-3 text-sm">Ambas <strong className="block text-white">{snapshot.bttsOdd}</strong></div>
          </div>
        </Card>

        <div className="space-y-5">
          <Card title="Estatísticas do minuto">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <p>Finalizações: <span className="text-white">{snapshot.stats.shots}</span></p>
              <p>No alvo: <span className="text-white">{snapshot.stats.shotsOnTarget}</span></p>
              <p>Ataques perigosos: <span className="text-white">{snapshot.stats.dangerousAttacks}</span></p>
              <p>Escanteios: <span className="text-white">{snapshot.stats.corners}</span></p>
              <p>Posse: <span className="text-white">{snapshot.stats.possession}%</span></p>
              <p>Cartões: <span className="text-white">{snapshot.stats.cards}</span></p>
              <p>Pressão: <span className="text-white">{snapshot.stats.offensivePressure}</span></p>
              <p>Chutes recentes: <span className="text-white">{snapshot.stats.recentShots}</span></p>
            </div>
          </Card>
          <Card title="Eventos">
            {snapshot.events.length ? (
              <ul className="space-y-2 text-sm text-white">
                {snapshot.events.map((event) => <li key={event}>{event}</li>)}
              </ul>
            ) : (
              <p className="text-sm text-slate-400">Nenhum evento relevante neste minuto.</p>
            )}
          </Card>
          <Card title="Bots que entrariam">
            {entrants.length ? (
              <div className="space-y-3">
                {entrants.map(({ bot, decision }) => (
                  <div key={bot.id} className="rounded-md bg-emerald-500/10 p-3 text-sm">
                    <p className="font-semibold text-emerald-300">{bot.name}</p>
                    <p className="text-slate-300">{bot.market} {bot.side} @ {decision.odd.toFixed(2)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400">Nenhum bot ativo entraria agora.</p>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
