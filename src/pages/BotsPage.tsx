import { Copy, Pencil, Play, Trash2 } from 'lucide-react';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { Bot, BacktestResult } from '../types';
import { formatPercent, uid } from '../utils/formatters';

type BotsPageProps = {
  bots: Bot[];
  results: BacktestResult[];
  onCreate: () => void;
  onEdit: (bot: Bot) => void;
  onDelete: (botId: string) => void;
  onDuplicate: (bot: Bot) => void;
  onBacktest: (bot: Bot) => void;
};

export function duplicateBot(bot: Bot): Bot {
  const now = new Date().toISOString();
  return {
    ...bot,
    id: uid('bot'),
    name: `${bot.name} cópia`,
    createdAt: now,
    updatedAt: now,
  };
}

export function BotsPage({ bots, results, onCreate, onEdit, onDelete, onDuplicate, onBacktest }: BotsPageProps) {
  const resultByBot = new Map(results.map((result) => [result.botId, result]));

  return (
    <>
      <PageHeader
        title="Bots"
        description="Gerencie métodos, duplique variações e rode backtests em jogos históricos mockados."
        action={<Button onClick={onCreate}>Novo bot</Button>}
      />

      {bots.length === 0 ? (
        <EmptyState
          title="Sua bancada de métodos está vazia"
          description="Crie um bot com regras ao vivo ou pré-live para habilitar backtest, ranking e relatórios."
          action={<Button onClick={onCreate}>Criar bot</Button>}
        />
      ) : (
        <Card>
          <div className="table-scroll">
            <table className="min-w-[980px] w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th className="px-3 py-3">Nome</th>
                  <th className="px-3 py-3">Modo</th>
                  <th className="px-3 py-3">Mercado</th>
                  <th className="px-3 py-3">BACK/LAY</th>
                  <th className="px-3 py-3">Odd</th>
                  <th className="px-3 py-3">Minuto</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">ROI</th>
                  <th className="px-3 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/8">
                {bots.map((bot) => {
                  const result = resultByBot.get(bot.id);
                  return (
                    <tr key={bot.id} className="text-slate-300">
                      <td className="px-3 py-4">
                        <p className="font-semibold text-white">{bot.name}</p>
                        <p className="line-clamp-1 text-xs text-slate-500">{bot.description || 'Sem descrição'}</p>
                      </td>
                      <td className="px-3 py-4">{bot.mode}</td>
                      <td className="px-3 py-4">{bot.market}</td>
                      <td className="px-3 py-4">{bot.side}</td>
                      <td className="px-3 py-4">{bot.minOdd.toFixed(2)} - {bot.maxOdd.toFixed(2)}</td>
                      <td className="px-3 py-4">{bot.entryMinute}' até {bot.limitMinute}'</td>
                      <td className="px-3 py-4">
                        <span className={`rounded-full px-2.5 py-1 text-xs ${bot.isActive ? 'bg-emerald-500/12 text-emerald-300' : 'bg-slate-500/12 text-slate-400'}`}>
                          {bot.isActive ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className={`px-3 py-4 font-semibold ${(result?.roi ?? 0) >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                        {result ? formatPercent(result.roi) : '-'}
                      </td>
                      <td className="px-3 py-4">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" className="px-2" title="Editar" onClick={() => onEdit(bot)} icon={<Pencil className="h-4 w-4" />} />
                          <Button variant="ghost" className="px-2" title="Duplicar" onClick={() => onDuplicate(bot)} icon={<Copy className="h-4 w-4" />} />
                          <Button variant="ghost" className="px-2" title="Rodar backtest" onClick={() => onBacktest(bot)} icon={<Play className="h-4 w-4" />} />
                          <Button variant="danger" className="px-2" title="Excluir" onClick={() => onDelete(bot.id)} icon={<Trash2 className="h-4 w-4" />} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
