import type { ReactNode } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { BacktestResult, Bot } from '../types';

type ReportsProps = {
  results: BacktestResult[];
  bots: Bot[];
};

const chartColors = ['#2388ff', '#34d399', '#f87171', '#fbbf24', '#a78bfa', '#22d3ee'];

export function Reports({ results, bots }: ReportsProps) {
  const botById = new Map(bots.map((bot) => [bot.id, bot]));
  const entries = results.flatMap((result) => result.entries);
  const profitByDay = entries.reduce<Record<string, number>>((map, entry) => {
    const day = new Date(entry.date).toLocaleDateString('pt-BR');
    map[day] = (map[day] ?? 0) + entry.profit;
    return map;
  }, {});
  const entriesByMarket = entries.reduce<Record<string, number>>((map, entry) => {
    map[entry.market] = (map[entry.market] ?? 0) + 1;
    return map;
  }, {});
  const profitByLeague = entries.reduce<Record<string, number>>((map, entry) => {
    map[entry.league] = (map[entry.league] ?? 0) + entry.profit;
    return map;
  }, {});

  const lineData = Object.entries(profitByDay).map(([day, profit]) => ({ day, profit: Number(profit.toFixed(2)) }));
  const roiData = results.map((result) => ({ name: result.botName, roi: result.roi }));
  const marketData = Object.entries(entriesByMarket).map(([name, value]) => ({ name, value }));
  const greenRedData = [
    { name: 'Greens', value: entries.filter((entry) => entry.result === 'green').length },
    { name: 'Reds', value: entries.filter((entry) => entry.result === 'red').length },
  ];
  const leagueData = Object.entries(profitByLeague).map(([league, profit]) => ({ league, profit: Number(profit.toFixed(2)) }));
  const modeData = results.map((result) => {
    const mode = botById.get(result.botId)?.mode;
    return { name: result.botName, preLive: mode === 'pre-live' ? result.roi : 0, aoVivo: mode === 'live' ? result.roi : 0 };
  });

  return (
    <>
      <PageHeader
        title="Relatórios"
        description="Gráficos de performance simulada a partir dos backtests salvos localmente."
      />
      {entries.length === 0 ? (
        <EmptyState title="Sem dados para gráficos" description="Rode pelo menos um backtest para gerar relatórios." />
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          <ChartCard title="Lucro por dia">
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={lineData}>
                <CartesianGrid stroke="#243244" strokeDasharray="3 3" />
                <XAxis dataKey="day" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip contentStyle={{ background: '#101620', border: '1px solid rgba(255,255,255,.1)' }} />
                <Line type="monotone" dataKey="profit" stroke="#2388ff" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="ROI por método">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={roiData}>
                <CartesianGrid stroke="#243244" strokeDasharray="3 3" />
                <XAxis dataKey="name" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip contentStyle={{ background: '#101620', border: '1px solid rgba(255,255,255,.1)' }} />
                <Bar dataKey="roi" fill="#34d399" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Entradas por mercado">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={marketData} dataKey="value" nameKey="name" outerRadius={96} label>
                  {marketData.map((_, index) => <Cell key={index} fill={chartColors[index % chartColors.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: '#101620', border: '1px solid rgba(255,255,255,.1)' }} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Greens e reds">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={greenRedData} dataKey="value" nameKey="name" outerRadius={96} label>
                  <Cell fill="#34d399" />
                  <Cell fill="#f87171" />
                </Pie>
                <Tooltip contentStyle={{ background: '#101620', border: '1px solid rgba(255,255,255,.1)' }} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Lucro por liga">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={leagueData}>
                <CartesianGrid stroke="#243244" strokeDasharray="3 3" />
                <XAxis dataKey="league" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip contentStyle={{ background: '#101620', border: '1px solid rgba(255,255,255,.1)' }} />
                <Bar dataKey="profit" fill="#2388ff" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Pré-live vs ao vivo">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={modeData}>
                <CartesianGrid stroke="#243244" strokeDasharray="3 3" />
                <XAxis dataKey="name" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip contentStyle={{ background: '#101620', border: '1px solid rgba(255,255,255,.1)' }} />
                <Bar dataKey="preLive" fill="#a78bfa" radius={[6, 6, 0, 0]} />
                <Bar dataKey="aoVivo" fill="#22d3ee" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      )}
    </>
  );
}

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return <Card title={title}>{children}</Card>;
}
