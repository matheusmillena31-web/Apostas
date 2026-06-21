import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { MethodRanking } from '../types';
import { formatCurrency, formatPercent } from '../utils/formatters';

type RankingProps = {
  rankings: MethodRanking[];
};

export function Ranking({ rankings }: RankingProps) {
  return (
    <>
      <PageHeader title="Ranking de métodos" description="Comparativo dos bots ordenados por ROI em backtest local." />
      {rankings.length === 0 ? (
        <EmptyState title="Ranking vazio" description="Crie bots para gerar um ranking de métodos." />
      ) : (
        <Card>
          <div className="table-scroll">
            <table className="min-w-[960px] w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th className="px-3 py-3">#</th>
                  <th className="px-3 py-3">Bot</th>
                  <th className="px-3 py-3">ROI</th>
                  <th className="px-3 py-3">Lucro</th>
                  <th className="px-3 py-3">Entradas</th>
                  <th className="px-3 py-3">Greens</th>
                  <th className="px-3 py-3">Reds</th>
                  <th className="px-3 py-3">Assertividade</th>
                  <th className="px-3 py-3">Modo</th>
                  <th className="px-3 py-3">Mercado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/8">
                {rankings.map((item, index) => (
                  <tr key={item.botId}>
                    <td className="px-3 py-4 text-slate-500">{index + 1}</td>
                    <td className="px-3 py-4 font-semibold text-white">{item.botName}</td>
                    <td className={`px-3 py-4 font-semibold ${item.roi >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>{formatPercent(item.roi)}</td>
                    <td className={`px-3 py-4 font-semibold ${item.profit >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>{formatCurrency(item.profit)}</td>
                    <td className="px-3 py-4 text-slate-300">{item.entries}</td>
                    <td className="px-3 py-4 text-emerald-300">{item.greens}</td>
                    <td className="px-3 py-4 text-red-300">{item.reds}</td>
                    <td className="px-3 py-4 text-slate-300">{formatPercent(item.accuracy)}</td>
                    <td className="px-3 py-4 text-slate-300">{item.mode}</td>
                    <td className="px-3 py-4 text-slate-300">{item.market}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
