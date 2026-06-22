import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Info, Pause, Play, RotateCcw, Search, SkipBack, SkipForward } from 'lucide-react';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { Input } from '../components/FormControls';
import { PageHeader } from '../components/PageHeader';
import { shouldEnter } from '../services/backtest';
import { Bot, Game, LiveStats } from '../types';

type ReplayPageProps = {
  bots: Bot[];
  delay: number;
};

type TeamStats = {
  shots: number;
  shotsOnTarget: number;
  dangerousAttacks: number;
  corners: number;
  possession: number;
  yellowCards: number;
  redCards: number;
  offensivePressure: number;
  recentShots: number;
};

type MarketSelection = {
  name: string;
  back: number;
  lay: number;
};

type ReplayMarket = {
  id: string;
  title: string;
  selections: MarketSelection[];
};

type SimulatedEntry = {
  id: string;
  marketId: string;
  marketTitle: string;
  selectionName: string;
  side: 'BACK' | 'LAY';
  entryOdd: number;
  stake: number;
  entryTimeLabel: string;
  placedAt: string;
};

type PendingEntry = {
  marketId: string;
  marketTitle: string;
  selectionName: string;
  side: 'BACK' | 'LAY';
  odd: number;
};

const MAX_REPLAY_MINUTE = 120;
const DEFAULT_REPLAY_STAKE = 50;
const goalLines = [0.5, 1.5, 2.5, 3.5, 4.5];
const historicalGames: Game[] = [];

const clampOdd = (odd: number) => Number(Math.max(1.01, Math.min(50, odd)).toFixed(2));
const layFromBack = (odd: number) => clampOdd(odd + (odd < 2 ? 0.02 : odd < 5 ? 0.05 : 0.12));
const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const parseStake = (value: string) => {
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const formatDateTime = (value: string) => new Date(value).toLocaleString('pt-BR');

const getReplayTimeInfo = (value: number) => {
  if (value <= 45) return { label: `${value}'`, phase: '1o tempo' };
  if (value <= 90) return { label: `${value}'`, phase: '2o tempo' };
  return { label: `${value}'`, phase: 'Prorrogacao' };
};

const getSnapshotMinute = (value: number) => Math.min(value, 90);

const goalLineOdd = (type: 'over' | 'under', line: number, over15: number, over25: number, under25: number) => {
  if (type === 'over') {
    if (line <= 1.5) return clampOdd(over15 - (1.5 - line) * 0.35);
    if (line <= 2.5) return clampOdd(over15 + (over25 - over15) * (line - 1.5));
    return clampOdd(over25 + (line - 2.5) * 0.75);
  }

  if (line <= 2.5) return clampOdd(under25 + (2.5 - line) * 0.55);
  return clampOdd(under25 - (line - 2.5) * 0.35);
};

const combinedChanceOdd = (firstOdd: number, secondOdd: number) => {
  const probability = 1 / firstOdd + 1 / secondOdd;
  return clampOdd(1 / Math.max(0.02, probability * 0.95));
};

const buildReplayMarkets = (
  snapshot: { homeOdd: number; drawOdd: number; awayOdd: number; over15Odd: number; over25Odd: number; under25Odd: number; bttsOdd: number },
  homeTeam: string,
  awayTeam: string,
): ReplayMarket[] => {
  const matchOdds: ReplayMarket = {
    id: 'match-odds',
    title: 'Resultado da partida',
    selections: [
      { name: homeTeam, back: snapshot.homeOdd, lay: layFromBack(snapshot.homeOdd) },
      { name: awayTeam, back: snapshot.awayOdd, lay: layFromBack(snapshot.awayOdd) },
      { name: 'Empate', back: snapshot.drawOdd, lay: layFromBack(snapshot.drawOdd) },
    ],
  };

  const totals: ReplayMarket[] = goalLines.map((line) => {
    const under = goalLineOdd('under', line, snapshot.over15Odd, snapshot.over25Odd, snapshot.under25Odd);
    const over = goalLineOdd('over', line, snapshot.over15Odd, snapshot.over25Odd, snapshot.under25Odd);
    return {
      id: `goals-${line}`,
      title: `Mais/Menos ${line}`,
      selections: [
        { name: `Menos de ${line}`, back: under, lay: layFromBack(under) },
        { name: `Mais de ${line}`, back: over, lay: layFromBack(over) },
      ],
    };
  });

  const bttsNo = clampOdd(snapshot.bttsOdd + 0.42);
  const btts: ReplayMarket = {
    id: 'btts',
    title: 'Ambas marcam',
    selections: [
      { name: 'Sim', back: snapshot.bttsOdd, lay: layFromBack(snapshot.bttsOdd) },
      { name: 'Nao', back: bttsNo, lay: layFromBack(bttsNo) },
    ],
  };

  const homeOrDraw = combinedChanceOdd(snapshot.homeOdd, snapshot.drawOdd);
  const homeOrAway = combinedChanceOdd(snapshot.homeOdd, snapshot.awayOdd);
  const drawOrAway = combinedChanceOdd(snapshot.drawOdd, snapshot.awayOdd);
  const doubleChance: ReplayMarket = {
    id: 'double-chance',
    title: 'Chance dupla',
    selections: [
      { name: `${homeTeam} ou Empate`, back: homeOrDraw, lay: layFromBack(homeOrDraw) },
      { name: `${homeTeam} ou ${awayTeam}`, back: homeOrAway, lay: layFromBack(homeOrAway) },
      { name: `Empate ou ${awayTeam}`, back: drawOrAway, lay: layFromBack(drawOrAway) },
    ],
  };

  return [matchOdds, ...totals, btts, doubleChance];
};

const getCashOutPreview = (entry: SimulatedEntry, selection?: MarketSelection) => {
  if (!selection) return { exitOdd: entry.entryOdd, profit: 0, value: entry.stake };
  const exitOdd = entry.side === 'BACK' ? selection.lay : selection.back;
  const profit =
    entry.side === 'BACK'
      ? entry.stake * ((entry.entryOdd - exitOdd) / exitOdd)
      : entry.stake * ((exitOdd - entry.entryOdd) / exitOdd);

  return {
    exitOdd,
    profit: Number(profit.toFixed(2)),
    value: Number((entry.stake + profit).toFixed(2)),
  };
};

const settleProfit = (entry: SimulatedEntry, selectionWon: boolean) => {
  const profit =
    entry.side === 'BACK'
      ? selectionWon
        ? entry.stake * (entry.entryOdd - 1)
        : -entry.stake
      : selectionWon
        ? -entry.stake * (entry.entryOdd - 1)
        : entry.stake;

  return Number(profit.toFixed(2));
};

const getEntrySettlement = (entry: SimulatedEntry, scoreHome: number, scoreAway: number, minute: number, homeTeam: string, awayTeam: string) => {
  const totalGoals = scoreHome + scoreAway;
  const lowerSelection = entry.selectionName.toLowerCase().replace(',', '.');
  const goalLine = Number(lowerSelection.match(/(\d+(?:\.\d+)?)/)?.[1]);

  if (lowerSelection.includes('mais de') && Number.isFinite(goalLine) && totalGoals > goalLine) {
    return { closed: true, profit: settleProfit(entry, true), reason: 'Linha de gols batida' };
  }

  if (lowerSelection.includes('menos de') && Number.isFinite(goalLine) && totalGoals > goalLine) {
    return { closed: true, profit: settleProfit(entry, false), reason: 'Linha de gols ultrapassada' };
  }

  const bothScored = scoreHome > 0 && scoreAway > 0;
  if (lowerSelection === 'sim' && bothScored) return { closed: true, profit: settleProfit(entry, true), reason: 'Ambas equipes marcaram' };
  if (lowerSelection === 'nao' && bothScored) return { closed: true, profit: settleProfit(entry, false), reason: 'Ambas equipes marcaram' };

  if (minute >= 90) {
    if (lowerSelection.includes('mais de') && Number.isFinite(goalLine)) return { closed: true, profit: settleProfit(entry, totalGoals > goalLine), reason: 'Fim do tempo regulamentar' };
    if (lowerSelection.includes('menos de') && Number.isFinite(goalLine)) return { closed: true, profit: settleProfit(entry, totalGoals < goalLine), reason: 'Fim do tempo regulamentar' };
    if (lowerSelection === 'sim') return { closed: true, profit: settleProfit(entry, bothScored), reason: 'Fim do tempo regulamentar' };
    if (lowerSelection === 'nao') return { closed: true, profit: settleProfit(entry, !bothScored), reason: 'Fim do tempo regulamentar' };
    if (entry.selectionName === homeTeam) return { closed: true, profit: settleProfit(entry, scoreHome > scoreAway), reason: 'Fim do tempo regulamentar' };
    if (entry.selectionName === awayTeam) return { closed: true, profit: settleProfit(entry, scoreAway > scoreHome), reason: 'Fim do tempo regulamentar' };
    if (entry.selectionName === 'Empate') return { closed: true, profit: settleProfit(entry, scoreHome === scoreAway), reason: 'Fim do tempo regulamentar' };
    if (entry.selectionName.includes(' ou ')) {
      const [first, second] = entry.selectionName.split(' ou ');
      const winner = scoreHome === scoreAway ? 'Empate' : scoreHome > scoreAway ? homeTeam : awayTeam;
      return { closed: true, profit: settleProfit(entry, first === winner || second === winner), reason: 'Fim do tempo regulamentar' };
    }
  }

  return { closed: false, profit: 0, reason: 'Aberta' };
};

const isReplayMarketClosed = (marketId: string, scoreHome: number, scoreAway: number, minute: number) => {
  const totalGoals = scoreHome + scoreAway;

  if (marketId.startsWith('goals-')) {
    const line = Number(marketId.replace('goals-', ''));
    return totalGoals > line || minute >= 90;
  }

  if (marketId === 'btts') return (scoreHome > 0 && scoreAway > 0) || minute >= 90;
  if (marketId === 'match-odds' || marketId === 'double-chance') return minute >= 90;

  return false;
};

function OddBox({ odd, tone, disabled, onClick }: { odd: number; tone: 'back' | 'lay'; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-md px-3 py-2 text-center text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 ${tone === 'back' ? 'bg-sky-200' : 'bg-rose-200'}`}
      title={`Simular entrada ${tone === 'back' ? 'BACK' : 'LAY'}`}
    >
      <p className="text-base font-black">{odd.toFixed(2)}</p>
    </button>
  );
}

function MarketCard({
  market,
  expanded,
  closed,
  onToggle,
  activeEntries,
  onPlaceEntry,
  onCashOut,
}: {
  market: ReplayMarket;
  expanded: boolean;
  closed: boolean;
  onToggle: () => void;
  activeEntries: SimulatedEntry[];
  onPlaceEntry: (market: ReplayMarket, selection: MarketSelection, side: 'BACK' | 'LAY') => void;
  onCashOut: (entryId: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-white/8 bg-[#090d2a]">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 bg-[#171b43] px-3 py-2 text-left transition hover:bg-[#202658]"
      >
        <span className="flex min-w-0 items-center gap-2">
          {expanded ? <ChevronDown className="h-4 w-4 text-slate-300" /> : <ChevronRight className="h-4 w-4 text-slate-300" />}
          <span className="truncate text-sm font-black uppercase tracking-wide text-white">{market.title}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2 text-[11px] font-semibold text-slate-300">
          <Info className="h-3.5 w-3.5" />
          {closed ? <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-red-300">Fechado</span> : null}
          {activeEntries.length > 0 ? `${activeEntries.length} entrada(s)` : ''}
        </span>
      </button>

      {expanded && (
        <div className="p-3">
          {activeEntries.length > 0 && (
            <div className="mb-3 space-y-2">
              {activeEntries.map((entry) => {
                const currentSelection = market.selections.find((selection) => selection.name === entry.selectionName);
                const cashOut = getCashOutPreview(entry, currentSelection);
                const movement = cashOut.exitOdd - entry.entryOdd;

                return (
                  <div key={entry.id} className="grid gap-3 rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 md:grid-cols-[1fr_auto_auto] md:items-center">
                    <div>
                      <p className="text-xs uppercase tracking-[0.14em] text-amber-200">Entrada simulada</p>
                      <p className="mt-1 text-sm font-semibold text-white">
                        {entry.side} {entry.selectionName} @ {entry.entryOdd.toFixed(2)}
                      </p>
                    <p className="text-xs text-slate-400">
                      Entrada {entry.entryTimeLabel} | atual {cashOut.exitOdd.toFixed(2)} | movimento {movement >= 0 ? '+' : ''}{movement.toFixed(2)}
                    </p>
                  </div>
                    <div className="text-sm">
                      <p className="text-slate-400">Risco: <span className="font-semibold text-white">{formatCurrency(entry.stake)}</span></p>
                      <p className={cashOut.profit >= 0 ? 'text-emerald-300' : 'text-red-300'}>
                        {cashOut.profit >= 0 ? 'Lucro' : 'Prejuizo'}: {formatCurrency(Math.abs(cashOut.profit))}
                      </p>
                    </div>
                    {closed ? (
                      <span className="rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-2 text-center text-sm font-black text-red-200">
                        Mercado fechado
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onCashOut(entry.id)}
                        className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-amber-300"
                      >
                        Cash Out {formatCurrency(cashOut.value)}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <div className="mb-3 grid grid-cols-[minmax(0,1fr)_120px_120px] gap-3 text-[11px] font-bold text-slate-300">
            <span>{market.selections.length} selecoes</span>
            <span className="text-center">Apostar a Favor (Back)</span>
            <span className="text-center">Apostar Contra (Lay)</span>
          </div>
          <div className="space-y-2">
            {market.selections.map((selection) => (
              <div key={selection.name} className="grid grid-cols-[minmax(0,1fr)_120px_120px] items-center gap-3">
                <p className="truncate text-sm font-bold text-white">{selection.name}</p>
                <OddBox odd={selection.back} tone="back" disabled={closed} onClick={() => onPlaceEntry(market, selection, 'BACK')} />
                <OddBox odd={selection.lay} tone="lay" disabled={closed} onClick={() => onPlaceEntry(market, selection, 'LAY')} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function BettingTicketCard({
  entries,
  markets,
  scoreHome,
  scoreAway,
  minute,
  homeTeam,
  awayTeam,
}: {
  entries: SimulatedEntry[];
  markets: ReplayMarket[];
  scoreHome: number;
  scoreAway: number;
  minute: number;
  homeTeam: string;
  awayTeam: string;
}) {
  const ticketRows = entries.map((entry) => {
    const market = markets.find((item) => item.id === entry.marketId);
    const selection = market?.selections.find((item) => item.name === entry.selectionName);
    const settlement = getEntrySettlement(entry, scoreHome, scoreAway, minute, homeTeam, awayTeam);
    const cashOut = getCashOutPreview(entry, selection);
    const displayProfit = settlement.closed ? settlement.profit : cashOut.profit;

    return { entry, settlement, displayProfit };
  });
  const closedRows = ticketRows.filter((row) => row.settlement.closed);
  const closedProfit = closedRows.reduce((sum, row) => sum + row.settlement.profit, 0);

  return (
    <Card title="Cartao de Apostas" subtitle="Entradas simuladas e resultado quando o mercado fechar.">
      {entries.length === 0 ? (
        <p className="text-sm text-slate-400">Clique em uma odd Back ou Lay para criar uma aposta simulada.</p>
      ) : (
        <div className="space-y-3">
          {ticketRows.map(({ entry, settlement, displayProfit }) => {
            return (
              <div key={entry.id} className="overflow-hidden rounded-lg border border-white/10 bg-ink-900/80 shadow-glow">
                <div className="flex items-center justify-between gap-3 border-b border-white/8 bg-white/5 px-4 py-2">
                  <p className="truncate text-sm font-black">
                    {homeTeam} vs {awayTeam} - {entry.marketTitle}
                  </p>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-black ${settlement.closed ? 'bg-slate-500/20 text-slate-200' : 'bg-emerald-500/15 text-emerald-300'}`}>
                    {settlement.closed ? 'Fechada' : 'Aberta'}
                  </span>
                </div>
                <div className="grid gap-3 px-4 py-3 md:grid-cols-[1fr_auto_auto_auto] md:items-center">
                  <div>
                    <p className="text-xs text-slate-500">{entry.side === 'BACK' ? 'Aposta a favor' : 'Aposta contra'}</p>
                    <p className="text-base font-black uppercase text-white">{entry.selectionName}</p>
                    <p className="mt-2 text-xs text-slate-500">
                      Bet Id: {entry.id.slice(-8).toUpperCase()} | Colocada: {formatDateTime(entry.placedAt)}
                    </p>
                    <p className="text-xs text-slate-500">Tempo da entrada: {entry.entryTimeLabel} | {settlement.reason}</p>
                  </div>
                  <div className="text-left md:text-center">
                    <p className="text-xs font-semibold text-slate-500">Odd</p>
                    <p className="text-lg font-black text-white">{entry.entryOdd.toFixed(2)}</p>
                  </div>
                  <div className="text-left md:text-center">
                    <p className="text-xs font-semibold text-slate-500">Stake</p>
                    <p className="text-lg font-black text-white">{formatCurrency(entry.stake)}</p>
                  </div>
                  <div className="text-left md:text-center">
                    <p className="text-xs font-semibold text-slate-500">{settlement.closed ? 'Resultado' : 'Cash out'}</p>
                    <p className={`text-lg font-black ${displayProfit >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                      {formatCurrency(displayProfit)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
          <div className="rounded-lg border border-white/10 bg-ink-900/80 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Resultado dos mercados fechados</p>
                <p className="mt-1 text-sm text-slate-400">{closedRows.length} mercado(s) fechado(s) ao decorrer da partida</p>
              </div>
              <p className={`text-xl font-black ${closedProfit >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                {closedProfit >= 0 ? 'Lucro' : 'Prejuizo'} {formatCurrency(Math.abs(closedProfit))}
              </p>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

const splitStatsByTeam = (stats: LiveStats, scoreHome: number, scoreAway: number): { home: TeamStats; away: TeamStats } => {
  const homeRatio = Math.min(0.68, Math.max(0.32, stats.possession / 100));
  const split = (value: number) => {
    const home = Math.max(0, Math.round(value * homeRatio));
    return { home, away: Math.max(0, value - home) };
  };

  const shots = split(stats.shots);
  const shotsOnTarget = split(stats.shotsOnTarget);
  const dangerousAttacks = split(stats.dangerousAttacks);
  const corners = split(stats.corners);
  const yellowCards = split(stats.cards);
  const redCards = split(Math.floor(stats.cards / 5));
  const offensivePressure = split(stats.offensivePressure);
  const recentShots = split(stats.recentShots);

  return {
    home: {
      shots: shots.home + scoreHome,
      shotsOnTarget: shotsOnTarget.home + scoreHome,
      dangerousAttacks: dangerousAttacks.home,
      corners: corners.home,
      possession: stats.possession,
      yellowCards: yellowCards.home,
      redCards: redCards.home,
      offensivePressure: offensivePressure.home,
      recentShots: recentShots.home,
    },
    away: {
      shots: shots.away + scoreAway,
      shotsOnTarget: shotsOnTarget.away + scoreAway,
      dangerousAttacks: dangerousAttacks.away,
      corners: corners.away,
      possession: 100 - stats.possession,
      yellowCards: yellowCards.away,
      redCards: redCards.away,
      offensivePressure: offensivePressure.away,
      recentShots: recentShots.away,
    },
  };
};

function StatComparison({ label, home, away, suffix = '' }: { label: string; home: number; away: number; suffix?: string }) {
  const total = home + away;
  const homePercent = total > 0 ? (home / total) * 100 : 50;
  const awayPercent = total > 0 ? 100 - homePercent : 50;

  return (
    <div className="rounded-md border border-white/8 bg-ink-900/70 p-3">
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-semibold text-white">{home}{suffix}</span>
        <span className="text-xs uppercase tracking-[0.12em] text-slate-500">{label}</span>
        <span className="font-semibold text-white">{away}{suffix}</span>
      </div>
      <div className="flex h-2 overflow-hidden rounded-full bg-slate-800">
        <div
          className="bg-electric-500"
          style={{ width: `${homePercent}%`, opacity: total > 0 ? 1 : 0.35 }}
        />
        <div
          className="bg-violet-500"
          style={{ width: `${awayPercent}%`, opacity: total > 0 ? 1 : 0.35 }}
        />
      </div>
    </div>
  );
}

export function ReplayPage({ bots, delay }: ReplayPageProps) {
  if (historicalGames.length === 0) {
    return (
      <>
        <PageHeader
          title="Replay de jogos"
          description="Replay completo sera liberado usando os snapshots de fixtures, estatisticas, eventos e odds live gravados pelo backend."
        />
        <EmptyState
          title="Base historica em construcao"
          description="A API-FOOTBALL entrega dados ao vivo, mas o historico minuto a minuto precisa ser construido gravando snapshots desde agora. Abra Jogos ao vivo para iniciar capturas."
        />
      </>
    );
  }

  const [gameId, setGameId] = useState(historicalGames[0]?.id ?? '');
  const [minute, setMinute] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedMarkets, setExpandedMarkets] = useState<string[]>(['match-odds']);
  const [simulatedEntries, setSimulatedEntries] = useState<SimulatedEntry[]>([]);
  const [pendingEntry, setPendingEntry] = useState<PendingEntry | undefined>();
  const [stakeInput, setStakeInput] = useState(String(DEFAULT_REPLAY_STAKE));
  const [frozenMarkets, setFrozenMarkets] = useState<Record<string, ReplayMarket>>({});

  const filteredGames = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return historicalGames;
    return historicalGames.filter((item) =>
      `${item.homeTeam} ${item.awayTeam} ${item.league}`.toLowerCase().includes(query),
    );
  }, [search]);

  const game = useMemo(() => historicalGames.find((item) => item.id === gameId) ?? historicalGames[0], [gameId]);
  const timeInfo = getReplayTimeInfo(minute);
  const snapshotIndex = Math.min(getSnapshotMinute(minute), game.snapshots.length - 1);
  const snapshot = game.snapshots[snapshotIndex];
  const teamStats = splitStatsByTeam(snapshot.stats, snapshot.scoreHome, snapshot.scoreAway);
  const replayMarkets = useMemo(
    () => buildReplayMarkets(snapshot, game.homeTeam, game.awayTeam),
    [snapshot, game.homeTeam, game.awayTeam],
  );
  const closedMarketIds = useMemo(() => {
    return new Set(
      replayMarkets
        .filter((market) => isReplayMarketClosed(market.id, snapshot.scoreHome, snapshot.scoreAway, minute))
        .map((market) => market.id),
    );
  }, [replayMarkets, snapshot.scoreHome, snapshot.scoreAway, minute]);
  const displayMarkets = useMemo(
    () => replayMarkets.map((market) => (closedMarketIds.has(market.id) ? frozenMarkets[market.id] ?? market : market)),
    [closedMarketIds, frozenMarkets, replayMarkets],
  );
  const entrants = bots
    .filter((bot) => bot.isActive)
    .map((bot) => ({ bot, decision: shouldEnter(bot, game, snapshot) }))
    .filter((item) => item.decision.passed);

  useEffect(() => {
    if (!playing) return;
    const interval = window.setInterval(() => {
      setMinute((current) => {
        if (current >= MAX_REPLAY_MINUTE) {
          setPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, delay);
    return () => window.clearInterval(interval);
  }, [playing, delay]);

  useEffect(() => {
    setFrozenMarkets((current) => {
      let changed = false;
      const next = { ...current };

      replayMarkets.forEach((market) => {
        if (closedMarketIds.has(market.id) && !next[market.id]) {
          next[market.id] = market;
          changed = true;
        }
      });

      return changed ? next : current;
    });
  }, [closedMarketIds, replayMarkets]);

  useEffect(() => {
    if (pendingEntry && closedMarketIds.has(pendingEntry.marketId)) {
      setPendingEntry(undefined);
    }
  }, [closedMarketIds, pendingEntry]);

  const toggleMarket = (marketId: string) => {
    setExpandedMarkets((current) =>
      current.includes(marketId) ? current.filter((item) => item !== marketId) : [...current, marketId],
    );
  };

  const placeEntry = (market: ReplayMarket, selection: MarketSelection, side: 'BACK' | 'LAY') => {
    setPendingEntry({
      marketId: market.id,
      marketTitle: market.title,
      selectionName: selection.name,
      side,
      odd: side === 'BACK' ? selection.back : selection.lay,
    });
    setStakeInput(String(DEFAULT_REPLAY_STAKE));
    setExpandedMarkets((current) => (current.includes(market.id) ? current : [...current, market.id]));
  };

  const confirmPendingEntry = () => {
    if (!pendingEntry) return;
    const stake = parseStake(stakeInput);
    if (stake <= 0) return;

    setSimulatedEntries((current) => [
      ...current,
      {
        id: `entry-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        marketId: pendingEntry.marketId,
        marketTitle: pendingEntry.marketTitle,
        selectionName: pendingEntry.selectionName,
        side: pendingEntry.side,
        entryOdd: pendingEntry.odd,
        stake,
        entryTimeLabel: timeInfo.label,
        placedAt: new Date().toISOString(),
      },
    ]);
    setPendingEntry(undefined);
  };

  const cashOutEntry = (entryId: string) => {
    setSimulatedEntries((current) => current.filter((entry) => entry.id !== entryId));
  };

  return (
    <>
      <PageHeader
        title="Replay de jogos"
        description="Busque uma partida e avance minuto a minuto para ver odds, estatisticas separadas por time e bots que entrariam."
      />
      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <Card title="Controle do replay">
          <div className="grid gap-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por time ou liga"
                className="pl-9"
              />
              {search && (
                <div className="absolute z-20 mt-2 max-h-64 w-full overflow-y-auto rounded-md border border-white/10 bg-ink-950 shadow-glow">
                  {filteredGames.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setGameId(item.id);
                        setMinute(0);
                        setPlaying(false);
                        setSimulatedEntries([]);
                        setPendingEntry(undefined);
                        setFrozenMarkets({});
                        setSearch('');
                      }}
                      className="block w-full px-3 py-2 text-left text-sm text-slate-300 transition hover:bg-white/5 hover:text-white"
                    >
                      <span className="font-semibold text-white">{item.homeTeam} x {item.awayTeam}</span>
                      <span className="ml-2 text-xs text-slate-500">{item.league}</span>
                    </button>
                  ))}
                  {filteredGames.length === 0 && <p className="px-3 py-3 text-sm text-slate-500">Nenhuma partida encontrada.</p>}
                </div>
              )}
            </div>

            <div className="rounded-lg bg-ink-900 p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-slate-400">{game.league}</p>
                  <h2 className="mt-1 text-2xl font-semibold text-white">{game.homeTeam} x {game.awayTeam}</h2>
                  <div className="mt-2 grid max-w-xl grid-cols-3 gap-2 text-[10px] text-slate-500">
                    <span className="rounded-full border border-white/10 px-1.5 py-0.5 text-left">Casa {game.preLive.homeOdd.toFixed(2)}</span>
                    <span className="rounded-full border border-white/10 px-1.5 py-0.5 text-center">Empate {game.preLive.drawOdd.toFixed(2)}</span>
                    <span className="rounded-full border border-white/10 px-1.5 py-0.5 text-right">Fora {game.preLive.awayOdd.toFixed(2)}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-slate-400">Minuto</p>
                  <p className="text-3xl font-semibold text-electric-500">{timeInfo.label}</p>
                </div>
              </div>

              <div className="mt-6">
                <div className="mb-2 flex items-center justify-between text-sm font-semibold text-slate-300">
                  <span>0</span>
                  <span>{timeInfo.phase}</span>
                  <span>120</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={MAX_REPLAY_MINUTE}
                  value={minute}
                  onChange={(event) => {
                    setMinute(Number(event.target.value));
                    setPlaying(false);
                  }}
                  className="h-4 w-full cursor-pointer accent-electric-500"
                />
              </div>

              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <Button variant="secondary" className="px-3" onClick={() => setMinute((value) => Math.max(0, value - 1))} icon={<SkipBack className="h-4 w-4" />} />
                <Button onClick={() => setPlaying((value) => !value)} icon={playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}>
                  {playing ? 'Pausar' : 'Play'}
                </Button>
                <Button variant="secondary" className="px-3" onClick={() => setMinute((value) => Math.min(MAX_REPLAY_MINUTE, value + 1))} icon={<SkipForward className="h-4 w-4" />} />
                <Button variant="ghost" className="px-3" onClick={() => setMinute(0)} icon={<RotateCcw className="h-4 w-4" />} />
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
          </div>

          {pendingEntry && (
            <div className="mt-5 rounded-lg border border-electric-500/40 bg-electric-500/10 p-4">
              <div className="grid gap-3 md:grid-cols-[1fr_140px_auto_auto] md:items-end">
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-electric-300">Bilhete de entrada</p>
                  <p className="mt-1 text-sm font-semibold text-white">
                    {pendingEntry.side} {pendingEntry.selectionName} em {pendingEntry.marketTitle} @ {pendingEntry.odd.toFixed(2)}
                  </p>
                  <p className="text-xs text-slate-400">Entrada no tempo {timeInfo.label}</p>
                </div>
                <label>
                  <span className="mb-1 block text-xs font-semibold text-slate-300">Stake</span>
                  <input
                    type="number"
                    min={0.01}
                    step={0.01}
                    value={stakeInput}
                    onChange={(event) => setStakeInput(event.target.value)}
                    className="min-h-10 w-full rounded-md border border-white/10 bg-ink-950 px-3 py-2 text-sm text-white outline-none focus:border-electric-500 focus:ring-2 focus:ring-electric-500/20"
                  />
                </label>
                <Button type="button" onClick={confirmPendingEntry}>
                  Confirmar
                </Button>
                <Button type="button" variant="ghost" onClick={() => setPendingEntry(undefined)}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          <div className="mt-5 space-y-3">
            {displayMarkets.map((market) => (
              <MarketCard
                key={market.id}
                market={market}
                expanded={expandedMarkets.includes(market.id)}
                closed={closedMarketIds.has(market.id)}
                onToggle={() => toggleMarket(market.id)}
                activeEntries={simulatedEntries.filter((entry) => entry.marketId === market.id)}
                onPlaceEntry={placeEntry}
                onCashOut={cashOutEntry}
              />
            ))}
          </div>
        </Card>

        <div className="space-y-5">
          <BettingTicketCard
            entries={simulatedEntries}
            markets={displayMarkets}
            scoreHome={snapshot.scoreHome}
            scoreAway={snapshot.scoreAway}
            minute={minute}
            homeTeam={game.homeTeam}
            awayTeam={game.awayTeam}
          />

          <Card title="Bots que entrariam">
            {entrants.length ? (
              <div className="space-y-3">
                {entrants.map(({ bot, decision }) => (
                  <div key={bot.id} className="rounded-md bg-emerald-500/10 p-3 text-sm">
                    <p className="font-semibold text-emerald-300">{bot.name}</p>
                    <p className="text-slate-300">{bot.market ?? 'Match Odds'} {bot.operation ?? 'BACK'} @ {decision.odd.toFixed(2)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400">Nenhum bot ativo entraria agora.</p>
            )}
          </Card>

          <Card title="Estatisticas da Partida" subtitle={`${game.homeTeam} x ${game.awayTeam}`}>
            <div className="mb-4 grid grid-cols-3 gap-3 text-sm">
              <div>
                <p className="font-semibold text-electric-300">{game.homeTeam}</p>
              </div>
              <p className="text-center text-slate-500">comparativo</p>
              <div className="text-right">
                <p className="font-semibold text-violet-300">{game.awayTeam}</p>
              </div>
            </div>
            <div className="space-y-3 text-sm">
              <StatComparison label="Finalizacoes" home={teamStats.home.shots} away={teamStats.away.shots} />
              <StatComparison label="No alvo" home={teamStats.home.shotsOnTarget} away={teamStats.away.shotsOnTarget} />
              <StatComparison label="Ataques perigosos" home={teamStats.home.dangerousAttacks} away={teamStats.away.dangerousAttacks} />
              <StatComparison label="Escanteios" home={teamStats.home.corners} away={teamStats.away.corners} />
              <StatComparison label="Posse" home={teamStats.home.possession} away={teamStats.away.possession} suffix="%" />
              <StatComparison label="Cartoes amarelos" home={teamStats.home.yellowCards} away={teamStats.away.yellowCards} />
              <StatComparison label="Cartoes vermelhos" home={teamStats.home.redCards} away={teamStats.away.redCards} />
              <StatComparison label="Pressao" home={teamStats.home.offensivePressure} away={teamStats.away.offensivePressure} />
              <StatComparison label="Chutes recentes" home={teamStats.home.recentShots} away={teamStats.away.recentShots} />
            </div>
            <div className="mt-4 rounded-md border border-white/8 bg-ink-900/60 p-3 text-xs leading-5 text-slate-400">
              <p><span className="font-semibold text-slate-200">Pressao:</span> indice de volume ofensivo no minuto, combinando ritmo, ataques perigosos e contexto do placar.</p>
              <p><span className="font-semibold text-slate-200">Chutes recentes:</span> finalizacoes registradas nos minutos mais proximos ao momento atual do replay.</p>
            </div>
          </Card>

        </div>
      </div>
    </>
  );
}
