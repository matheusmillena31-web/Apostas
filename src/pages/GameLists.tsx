import { Card } from '../components/Card';
import { PageHeader } from '../components/PageHeader';
import { mockGames } from '../data/mockGames';

export function GameLists() {
  return (
    <>
      <PageHeader
        title="Listas de jogos"
        description="Base local com jogos históricos e jogos ao vivo mockados, pronta para futura integração com APIs oficiais."
      />
      <Card>
        <div className="table-scroll">
          <table className="min-w-[820px] w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="px-3 py-3">Liga</th>
                <th className="px-3 py-3">Jogo</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Placar final</th>
                <th className="px-3 py-3">Média gols</th>
                <th className="px-3 py-3">Média escanteios</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/8">
              {mockGames.map((game) => (
                <tr key={game.id}>
                  <td className="px-3 py-4 text-slate-300">{game.league}</td>
                  <td className="px-3 py-4 font-semibold text-white">{game.homeTeam} x {game.awayTeam}</td>
                  <td className="px-3 py-4 text-slate-300">{game.status}</td>
                  <td className="px-3 py-4 text-slate-300">{game.finalScoreHome}-{game.finalScoreAway}</td>
                  <td className="px-3 py-4 text-slate-300">{game.preLive.averageGoals}</td>
                  <td className="px-3 py-4 text-slate-300">{game.preLive.averageCorners}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
