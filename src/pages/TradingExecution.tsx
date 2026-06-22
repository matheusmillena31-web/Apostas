import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { liveEntryPreview } from '../services/backtest';
import { Bot } from '../types';

type TradingExecutionProps = {
  bots: Bot[];
};

export function TradingExecution({ bots }: TradingExecutionProps) {
  const previews = liveEntryPreview(bots);
  const approved = previews.filter((item) => item.decision.passed);

  return (
    <>
      <PageHeader
        title="Trading em execução"
        description="Monitor simulado dos bots ativos contra os jogos ao vivo mockados."
      />
      {approved.length === 0 ? (
        <EmptyState
          title="Nenhuma entrada em execução"
          description="Os bots ativos estão monitorando os jogos simulados, mas nenhuma regra foi batida neste minuto."
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {approved.map(({ game, bot, snapshot, decision }) => (
            <Card key={`${game.id}-${bot.id}`} title={bot.name} subtitle={`${game.homeTeam} x ${game.awayTeam}`}>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-md bg-ink-900 p-3">
                  <p className="text-xs text-slate-500">Minuto</p>
                  <p className="text-xl font-semibold text-white">{snapshot.minute}'</p>
                </div>
                <div className="rounded-md bg-ink-900 p-3">
                  <p className="text-xs text-slate-500">Mercado</p>
                  <p className="text-xl font-semibold text-white">{bot.market ?? 'Match Odds'}</p>
                </div>
                <div className="rounded-md bg-ink-900 p-3">
                  <p className="text-xs text-slate-500">Odd</p>
                  <p className="text-xl font-semibold text-white">{decision.odd.toFixed(2)}</p>
                </div>
              </div>
              <p className="mt-4 text-sm text-slate-300">{decision.reason}</p>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
