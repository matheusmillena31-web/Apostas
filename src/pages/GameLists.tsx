import { useMemo, useState } from 'react';
import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { Select } from '../components/FormControls';
import { useAsyncData } from '../hooks/useAsyncData';
import { apiFootballService } from '../services/apiFootball';

const formatScore = (home: number | null, away: number | null) =>
  home === null || away === null ? '-' : `${home}-${away}`;

const getCurrentSeason = (seasons: { year: number; current: boolean }[]) =>
  seasons.find((season) => season.current)?.year ?? seasons[seasons.length - 1]?.year;

export function GameLists() {
  const [selectedLeagueId, setSelectedLeagueId] = useState<number | undefined>();
  const leaguesState = useAsyncData(() => apiFootballService.buscarLigasAtuais(), []);
  const leagues = leaguesState.data ?? [];
  const activeLeagueId = selectedLeagueId ?? leagues[0]?.league.id;
  const selectedLeague = useMemo(
    () => leagues.find((item) => item.league.id === activeLeagueId),
    [activeLeagueId, leagues],
  );
  const activeSeason = selectedLeague ? getCurrentSeason(selectedLeague.seasons) : undefined;
  const matchesState = useAsyncData(
    () => (activeLeagueId && activeSeason ? apiFootballService.buscarFixturesDaLiga(activeLeagueId, activeSeason) : Promise.resolve([])),
    [activeLeagueId, activeSeason],
  );

  return (
    <>
      <PageHeader
        title="Listas de jogos"
        description="Ligas, temporadas e fixtures carregados diretamente da API-FOOTBALL v3."
      />

      <Card className="mb-5" title="Liga">
        {leaguesState.loading ? (
          <p className="text-sm text-slate-400">Carregando ligas...</p>
        ) : leaguesState.error ? (
          <p className="text-sm text-red-300">{leaguesState.error}</p>
        ) : (
          <Select
            value={String(activeLeagueId ?? '')}
            onChange={(event) => setSelectedLeagueId(Number(event.target.value))}
          >
            {leagues.map((item) => (
              <option key={item.league.id} value={item.league.id}>
                {item.league.name} - {item.country.name} ({getCurrentSeason(item.seasons)})
              </option>
            ))}
          </Select>
        )}
      </Card>

      {matchesState.loading && <EmptyState title="Carregando fixtures" description="Consultando partidas da liga e temporada selecionadas." />}
      {matchesState.error && !matchesState.loading && <EmptyState title="Nao foi possivel carregar as partidas" description={matchesState.error} />}
      {!matchesState.loading && !matchesState.error && (matchesState.data ?? []).length === 0 && (
        <EmptyState title="Nenhuma partida encontrada" description="A API-FOOTBALL nao retornou fixtures para a liga selecionada." />
      )}

      {!matchesState.loading && !matchesState.error && (matchesState.data ?? []).length > 0 && (
        <Card title={selectedLeague?.league.name ?? 'Fixtures'} subtitle={`${selectedLeague?.country.name ?? ''} | Temporada ${activeSeason ?? '-'}`}>
          <div className="table-scroll">
            <table className="min-w-[960px] w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th className="px-3 py-3">Liga</th>
                  <th className="px-3 py-3">Jogo</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Placar</th>
                  <th className="px-3 py-3">Data</th>
                  <th className="px-3 py-3">Rodada</th>
                  <th className="px-3 py-3">Estadio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/8">
                {(matchesState.data ?? []).map((match) => (
                  <tr key={match.fixture.id}>
                    <td className="px-3 py-4 text-slate-300">{match.league.name}</td>
                    <td className="px-3 py-4 font-semibold text-white">
                      {match.teams.home.name} x {match.teams.away.name}
                    </td>
                    <td className="px-3 py-4 text-slate-300">{match.fixture.status.long}</td>
                    <td className="px-3 py-4 text-slate-300">{formatScore(match.goals.home, match.goals.away)}</td>
                    <td className="px-3 py-4 text-slate-300">{new Date(match.fixture.date).toLocaleString('pt-BR')}</td>
                    <td className="px-3 py-4 text-slate-300">{match.league.round}</td>
                    <td className="px-3 py-4 text-slate-300">{match.fixture.venue.name ?? '-'}</td>
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
