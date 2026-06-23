import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronRight, Pause, Play, RotateCcw, Search, SkipBack, SkipForward, X } from 'lucide-react';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { Input } from '../components/FormControls';
import { PageHeader } from '../components/PageHeader';
import { useAsyncData } from '../hooks/useAsyncData';
import { apiFootballService } from '../services/apiFootball';
import {
  ApiFootballOddsBet,
  ApiFootballReplayGame,
  ApiFootballReplayGameSummary,
  ApiFootballReplaySnapshot,
} from '../types/api';
import { Bot } from '../types';
import { formatCurrency, uid } from '../utils/formatters';

type ReplayPageProps = {
  bots: Bot[];
  delay: number;
};

type OddsSide = {
  odd: string;
  suspended?: boolean;
};

type OddsDisplaySelection = {
  key: string;
  label: string;
  back?: OddsSide;
  lay?: OddsSide;
  suspended: boolean;
};

type OddsDisplayMarket = {
  key: string;
  title: string;
  selections: OddsDisplaySelection[];
  sortOrder: number;
  line: number;
};

type BetSide = 'back' | 'lay';

type BetSlipSelection = {
  marketKey: string;
  marketTitle: string;
  selectionKey: string;
  selectionLabel: string;
  side: BetSide;
  odd: string;
};

type BetTicket = BetSlipSelection & {
  id: string;
  fixtureLabel: string;
  placedAt: string;
  replayMinute: string;
  stake: number;
  liability: number;
};

type CashoutResult = {
  hedgeStake: number;
  profit: number;
  oppositeOdd: number;
};

const formatScore = (home: number | null, away: number | null) =>
  home === null || away === null ? '-' : `${home} x ${away}`;

const formatCapturedAt = (value?: string) =>
  value ? new Date(value).toLocaleString('pt-BR') : '-';

const formatReplayMinute = (snapshot?: ApiFootballReplaySnapshot) => {
  if (!snapshot) return '-';
  return `${snapshot.minute ?? 0}'${snapshot.extra ? `+${snapshot.extra}` : ''}`;
};

const isPlayingSnapshot = (snapshot: ApiFootballReplaySnapshot) => ['1H', '2H'].includes(snapshot.status?.short ?? '');

const getOddsMarkets = (snapshot?: ApiFootballReplaySnapshot): ApiFootballOddsBet[] =>
  snapshot?.odds?.flatMap((item) => [...(item.odds ?? []), ...(item.bookmakers?.flatMap((bookmaker) => bookmaker.bets) ?? [])]) ?? [];

const normalizeMarketName = (value: string) => value.trim().toLowerCase();

const isFirstHalfMarket = (market: ApiFootballOddsBet) => {
  const name = normalizeMarketName(market.name);
  return name.includes('1st half') || name.includes('first half');
};

const isMatchOddsMarket = (market: ApiFootballOddsBet) => {
  const name = normalizeMarketName(market.name);
  return name.includes('fulltime result') || name.includes('match winner') || name === '1x2';
};

const isGoalLineMarket = (market: ApiFootballOddsBet) => {
  const name = normalizeMarketName(market.name);
  const hasGoalLine = market.values.some((value) => ['over', 'under'].includes(normalizeMarketName(value.value)) && value.handicap);
  return hasGoalLine && (name.includes('over/under') || name.includes('match goals') || name.includes('goals over'));
};

const getNumericLine = (line?: string | null) => {
  const numeric = Number(String(line ?? '').replace(',', '.'));
  return Number.isFinite(numeric) ? numeric : 999;
};

const getGoalLine = (market: ApiFootballOddsBet) => getNumericLine(market.values.find((value) => value.handicap)?.handicap);

const formatGoalLine = (line: number) => line.toFixed(1);

const FULL_TIME_GOAL_LINES = [0.5, 1.5, 2.5, 3.5, 4.5, 5.5];
const FIRST_HALF_GOAL_LINES = [0.5, 1.5, 2.5, 3.5];
const RESULT_TOTAL_GOAL_LINES = [1.5, 2.5, 3.5, 4.5];

const hasAllowedLine = (line: number, allowedLines: number[]) =>
  allowedLines.some((allowedLine) => Math.abs(allowedLine - line) < 0.001);

const isDoubleChanceMarket = (market: ApiFootballOddsBet) => normalizeMarketName(market.name).includes('double chance');
const isDrawNoBetMarket = (market: ApiFootballOddsBet) => normalizeMarketName(market.name) === 'draw no bet';
const isHalfTimeFullTimeMarket = (market: ApiFootballOddsBet) => normalizeMarketName(market.name) === 'half time/full time';
const isBothTeamsScoreMarket = (market: ApiFootballOddsBet) => normalizeMarketName(market.name) === 'both teams to score';
const isFinalScoreMarket = (market: ApiFootballOddsBet) => normalizeMarketName(market.name) === 'final score';
const isFirstHalfCorrectScoreMarket = (market: ApiFootballOddsBet) => normalizeMarketName(market.name) === 'correct score (1st half)';
const isResultBothTeamsScoreMarket = (market: ApiFootballOddsBet) => normalizeMarketName(market.name) === 'result / both teams to score';
const isIntervalMarket = (market: ApiFootballOddsBet) => normalizeMarketName(market.name) === '1st goal in interval';

const getResultTotalGoalLine = (market: ApiFootballOddsBet) => {
  const name = normalizeMarketName(market.name);
  const resultTotalMatch = name.match(/result.*(?:total|goals).*?(\d+(?:[.,]\d+)?)/);
  if (!resultTotalMatch) return undefined;

  const line = getNumericLine(resultTotalMatch[1]);
  return hasAllowedLine(line, RESULT_TOTAL_GOAL_LINES) ? line : undefined;
};

const isResultTotalGoalsMarket = (market: ApiFootballOddsBet) => getResultTotalGoalLine(market) !== undefined;

const getDisplayGroup = (market: ApiFootballOddsBet, value: ApiFootballOddsBet['values'][number]) => {
  const line = getNumericLine(value.handicap);

  if (isMatchOddsMarket(market)) {
    return { key: 'match-odds', title: 'Resultado da Partida', sortOrder: 0, line: 0 };
  }

  if (isGoalLineMarket(market) && line !== 999) {
    const firstHalf = isFirstHalfMarket(market);
    const allowedLines = firstHalf ? FIRST_HALF_GOAL_LINES : FULL_TIME_GOAL_LINES;

    if (!hasAllowedLine(line, allowedLines)) return undefined;

    const formattedLine = formatGoalLine(line);
    return {
      key: `${firstHalf ? 'first-half-' : ''}goal-line-${formattedLine}`,
      title: `${firstHalf ? '1o Tempo ' : ''}Mais/Menos ${formattedLine}`,
      sortOrder: firstHalf ? 20 + line : 10 + line,
      line,
    };
  }

  if (isIntervalMarket(market)) return { key: 'interval', title: 'Intervalo', sortOrder: 30, line: 0 };
  if (isHalfTimeFullTimeMarket(market)) return { key: 'half-time-full-time', title: '1o Tempo/Final do jogo', sortOrder: 40, line: 0 };
  if (isBothTeamsScoreMarket(market)) return { key: 'both-teams-score', title: 'Ambas marcam', sortOrder: 50, line: 0 };
  if (isDoubleChanceMarket(market)) return { key: 'double-chance', title: 'Chance Dupla', sortOrder: 60, line: 0 };
  if (isDrawNoBetMarket(market)) return { key: 'draw-no-bet', title: 'Empate anula a aposta', sortOrder: 70, line: 0 };
  if (isFinalScoreMarket(market)) return { key: 'final-score', title: 'Placar Exato', sortOrder: 80, line: 0 };
  if (isFirstHalfCorrectScoreMarket(market)) return { key: 'first-half-correct-score', title: 'Placar no Intervalo', sortOrder: 90, line: 0 };
  if (isResultBothTeamsScoreMarket(market)) {
    return { key: 'result-both-teams-score', title: 'Resultado da Partida e Ambas marcam', sortOrder: 100, line: 0 };
  }

  const resultTotalLine = getResultTotalGoalLine(market);
  if (resultTotalLine !== undefined) {
    const formattedLine = formatGoalLine(resultTotalLine);
    return {
      key: `result-total-goals-${formattedLine}`,
      title: `Resultado da Partida e Total de Gols ${formattedLine}`,
      sortOrder: 110 + resultTotalLine,
      line: resultTotalLine,
    };
  }

  return undefined;
};

const getSelectionKey = (market: ApiFootballOddsBet, value: string, handicap?: string | null) => {
  const normalized = normalizeMarketName(value);

  if (isMatchOddsMarket(market)) {
    if (['home', '1'].includes(normalized)) return 'home';
    if (['away', '2'].includes(normalized)) return 'away';
    if (['draw', 'x'].includes(normalized)) return 'draw';
  }

  if (isGoalLineMarket(market)) return `${normalized}-${handicap ?? getGoalLine(market)}`;

  return `${normalized}-${handicap ?? ''}`;
};

const formatSelectionName = (market: ApiFootballOddsBet, value: string, game?: ApiFootballReplayGame, handicap?: string | null) => {
  const normalized = normalizeMarketName(value);
  const homeName = game?.summary.homeTeam?.name ?? 'Mandante';
  const awayName = game?.summary.awayTeam?.name ?? 'Visitante';
  const line = handicap ?? market.values.find((item) => item.handicap)?.handicap;
  const replaceTeams = (source: string) =>
    source
      .replace(/\bHome\b/gi, homeName)
      .replace(/\bAway\b/gi, awayName)
      .replace(/\bDraw\b/gi, 'Empate')
      .replace(/\bYes\b/gi, 'Sim')
      .replace(/\bNo\b/gi, 'Nao')
      .replace(/\b1\b/g, homeName)
      .replace(/\b2\b/g, awayName)
      .replace(/\bX\b/gi, 'Empate');

  if (isMatchOddsMarket(market)) {
    if (['home', '1'].includes(normalized)) return homeName;
    if (['away', '2'].includes(normalized)) return awayName;
    if (['draw', 'x'].includes(normalized)) return 'Empate';
  }

  if (isGoalLineMarket(market)) {
    if (normalized === 'over') return `Mais de ${line}`;
    if (normalized === 'under') return `Menos de ${line}`;
  }

  if (isDoubleChanceMarket(market) || isDrawNoBetMarket(market) || isHalfTimeFullTimeMarket(market) || isResultBothTeamsScoreMarket(market)) {
    return replaceTeams(value);
  }

  if (isBothTeamsScoreMarket(market)) {
    if (normalized === 'yes') return 'Sim';
    if (normalized === 'no') return 'Nao';
  }

  return value;
};

const sortMarketValues = (market: ApiFootballOddsBet) => {
  if (isGoalLineMarket(market)) {
    return [...market.values].sort((a, b) => {
      const order = { under: 0, over: 1 } as Record<string, number>;
      return (order[normalizeMarketName(a.value)] ?? 9) - (order[normalizeMarketName(b.value)] ?? 9);
    });
  }

  if (isMatchOddsMarket(market)) {
    return [...market.values].sort((a, b) => {
      const order = { home: 0, '1': 0, draw: 1, x: 1, away: 2, '2': 2 } as Record<string, number>;
      return (order[normalizeMarketName(a.value)] ?? 9) - (order[normalizeMarketName(b.value)] ?? 9);
    });
  }

  return market.values;
};

const toOddNumber = (odd: string | undefined) => {
  const numeric = Number(String(odd ?? '').replace(',', '.'));
  return Number.isFinite(numeric) ? numeric : Number.POSITIVE_INFINITY;
};

const toValidOddNumber = (odd: string | undefined) => {
  const numeric = toOddNumber(odd);
  return Number.isFinite(numeric) && numeric > 1 ? numeric : undefined;
};

const parseStakeValue = (value: string) => {
  const numeric = Number(value.replace(',', '.'));
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
};

const formatPlainOdd = (odd: string) => odd.replace('.', ',');

const formatSignedCurrency = (value: number) => {
  const amount = formatCurrency(Math.abs(value));
  return value >= 0 ? amount : `-${amount}`;
};

const getTicketLiability = (side: BetSide, odd: string, stake: number) => {
  if (side === 'back') return stake;
  const numericOdd = toValidOddNumber(odd);
  return numericOdd ? stake * (numericOdd - 1) : 0;
};

const BETFAIR_TICKS = [
  { from: 101, to: 200, step: 1 },
  { from: 202, to: 300, step: 2 },
  { from: 305, to: 400, step: 5 },
  { from: 410, to: 600, step: 10 },
  { from: 620, to: 1000, step: 20 },
  { from: 1050, to: 2000, step: 50 },
  { from: 2100, to: 3000, step: 100 },
  { from: 3200, to: 5000, step: 200 },
  { from: 5500, to: 10000, step: 500 },
  { from: 11000, to: 100000, step: 1000 },
].flatMap(({ from, to, step }) => {
  const ticks: number[] = [];
  for (let tick = from; tick <= to; tick += step) {
    ticks.push(tick / 100);
  }
  return ticks;
});

const getNearestTickIndex = (odd: string | undefined) => {
  const numeric = toOddNumber(odd);
  if (!Number.isFinite(numeric)) return -1;

  return BETFAIR_TICKS.reduce((nearestIndex, tick, index) => {
    const currentDistance = Math.abs(tick - numeric);
    const nearestDistance = Math.abs(BETFAIR_TICKS[nearestIndex] - numeric);
    return currentDistance < nearestDistance ? index : nearestIndex;
  }, 0);
};

const formatTickOdd = (odd: number) => {
  if (odd < 4) return odd.toFixed(2);
  if (odd < 20) return odd.toFixed(1);
  return odd.toFixed(0);
};

const getSyntheticLayOdd = (backOdd: string | undefined) => {
  const nearestIndex = getNearestTickIndex(backOdd);
  if (nearestIndex < 0) return undefined;

  const layIndex = Math.min(nearestIndex + 2, BETFAIR_TICKS.length - 1);
  return formatTickOdd(BETFAIR_TICKS[layIndex]);
};

const getDisplayMarkets = (snapshot?: ApiFootballReplaySnapshot, game?: ApiFootballReplayGame): OddsDisplayMarket[] => {
  const marketGroups = new Map<
    string,
    {
      title: string;
      sortOrder: number;
      line: number;
      selections: Map<string, { label: string; quotes: OddsSide[] }>;
    }
  >();

  getOddsMarkets(snapshot).forEach((market) => {
    sortMarketValues(market).forEach((value) => {
      const displayGroup = getDisplayGroup(market, value);
      if (!displayGroup) return;

      const group = marketGroups.get(displayGroup.key) ?? {
        title: displayGroup.title,
        sortOrder: displayGroup.sortOrder,
        line: displayGroup.line,
        selections: new Map<string, { label: string; quotes: OddsSide[] }>(),
      };
      const selectionKey = getSelectionKey(market, value.value, value.handicap);
      const selection = group.selections.get(selectionKey) ?? {
        label: formatSelectionName(market, value.value, game, value.handicap),
        quotes: [],
      };

      if (value.odd) {
        selection.quotes.push({ odd: value.odd, suspended: value.suspended });
      }

      group.selections.set(selectionKey, selection);
      marketGroups.set(displayGroup.key, group);
    });
  });

  return [...marketGroups.entries()]
    .map(([key, group]) => ({
      key,
      title: group.title,
      sortOrder: group.sortOrder,
      line: group.line,
      selections: [...group.selections.entries()].map(([selectionKey, selection]) => {
        const quotes = selection.quotes.sort((a, b) => toOddNumber(a.odd) - toOddNumber(b.odd));
        const back = quotes[0];
        const lay = back && { odd: getSyntheticLayOdd(back.odd) ?? back.odd, suspended: back.suspended };

        return {
          key: selectionKey,
          label: selection.label,
          back,
          lay,
          suspended: quotes.some((quote) => quote.suspended),
        };
      }),
    }))
    .sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      if (a.sortOrder === 1 && b.sortOrder === 1) return a.line - b.line;
      return a.title.localeCompare(b.title, 'pt-BR');
    });
};

const findCurrentSelection = (
  markets: OddsDisplayMarket[],
  ticket: Pick<BetTicket, 'marketKey' | 'selectionKey'>,
) => markets
  .find((market) => market.key === ticket.marketKey)
  ?.selections.find((selection) => selection.key === ticket.selectionKey);

const getCashoutResult = (ticket: BetTicket, markets: OddsDisplayMarket[]): CashoutResult | undefined => {
  const currentSelection = findCurrentSelection(markets, ticket);
  const entryOdd = toValidOddNumber(ticket.odd);
  const oppositeOdd = toValidOddNumber(ticket.side === 'back' ? currentSelection?.lay?.odd : currentSelection?.back?.odd);

  if (!entryOdd || !oppositeOdd) return undefined;

  if (ticket.side === 'back') {
    const hedgeStake = (ticket.stake * entryOdd) / oppositeOdd;
    return {
      hedgeStake,
      profit: hedgeStake - ticket.stake,
      oppositeOdd,
    };
  }

  const hedgeStake = (ticket.stake * entryOdd) / oppositeOdd;
  return {
    hedgeStake,
    profit: ticket.stake - hedgeStake,
    oppositeOdd,
  };
};

const getStatValue = (snapshot: ApiFootballReplaySnapshot | undefined, teamId: number | undefined, labels: string | string[]) => {
  if (!snapshot || !teamId) return '-';
  const sourceLabels = Array.isArray(labels) ? labels : [labels];
  const item = snapshot.statistics.find((row) => row.team.id === teamId);
  const stat = item?.statistics.find((row) =>
    sourceLabels.some((label) => row.type.toLowerCase() === label.toLowerCase()),
  );
  return stat?.value ?? '-';
};

function ReplayGameSearch({
  games,
  selectedFixtureId,
  query,
  onQuery,
  onSelect,
}: {
  games: ApiFootballReplayGameSummary[];
  selectedFixtureId?: number;
  query: string;
  onQuery: (value: string) => void;
  onSelect: (fixtureId: number) => void;
}) {
  const filteredGames = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const sorted = [...games].sort((a, b) => new Date(b.lastCapturedAt).getTime() - new Date(a.lastCapturedAt).getTime());

    if (!normalized) return sorted.slice(0, 12);

    return sorted
      .filter((game) =>
        `${game.homeTeam?.name ?? ''} ${game.awayTeam?.name ?? ''} ${game.league?.name ?? ''} ${game.league?.country ?? ''}`
          .toLowerCase()
          .includes(normalized),
      )
      .slice(0, 16);
  }, [games, query]);

  return (
    <Card title="Partidas encontradas" subtitle="Jogos reconstruidos a partir dos snapshots gravados pelo backend.">
      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <Input
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            placeholder="Buscar por time ou liga"
            className="pl-9"
          />
        </div>
        <div className="max-h-[520px] overflow-y-auto rounded-md border border-white/10 bg-ink-950">
          {filteredGames.map((game) => {
            const selected = game.fixtureId === selectedFixtureId;

            return (
              <button
                key={game.fixtureId}
                type="button"
                onClick={() => onSelect(game.fixtureId)}
                className={`block w-full border-b border-white/8 px-3 py-3 text-left transition last:border-b-0 ${
                  selected ? 'bg-electric-500/12 text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">
                      {game.homeTeam?.name ?? 'Mandante'} x {game.awayTeam?.name ?? 'Visitante'}
                    </span>
                    <span className="block truncate text-xs text-slate-500">
                      {game.league?.name ?? '-'} | {game.snapshotCount} snapshot(s)
                    </span>
                  </span>
                  <span className="shrink-0 rounded bg-ink-900 px-2 py-1 text-xs font-semibold">
                    {formatScore(game.score.home, game.score.away)}
                  </span>
                </div>
              </button>
            );
          })}
          {filteredGames.length === 0 && <p className="px-3 py-4 text-sm text-slate-500">Nenhum jogo capturado encontrado.</p>}
        </div>
      </div>
    </Card>
  );
}

function StatComparison({
  label,
  home,
  away,
}: {
  label: string;
  home: string | number | null;
  away: string | number | null;
}) {
  return (
    <div className="grid grid-cols-[1fr_1.4fr_1fr] items-center gap-3 rounded-md border border-white/8 bg-ink-900/70 px-3 py-2 text-sm">
      <span className="font-semibold text-white">{home ?? '-'}</span>
      <span className="text-center text-xs uppercase tracking-[0.12em] text-slate-500">{label}</span>
      <span className="text-right font-semibold text-white">{away ?? '-'}</span>
    </div>
  );
}

function MarketBlock({
  market,
  collapsed,
  onToggle,
  onSelectQuote,
}: {
  market: OddsDisplayMarket;
  collapsed: boolean;
  onToggle: () => void;
  onSelectQuote: (selection: OddsDisplaySelection, side: BetSide, odd: string) => void;
}) {
  const renderQuoteButton = (selection: OddsDisplaySelection, side: BetSide, odd?: string) => {
    const disabled = !odd || selection.suspended;
    const sideClass = side === 'back' ? 'bg-sky-100 hover:bg-sky-200' : 'bg-rose-100 hover:bg-rose-200';

    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => odd && onSelectQuote(selection, side, odd)}
        className={`rounded-md px-4 py-2 text-center text-[#141844] transition disabled:cursor-not-allowed disabled:opacity-50 ${sideClass}`}
      >
        <p className="text-lg font-black">{odd ?? '-'}</p>
      </button>
    );
  };

  return (
    <div className="overflow-hidden rounded-md border border-white/8 bg-[#090d2b]">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 bg-[#171b46] px-3 py-2 text-left transition hover:bg-[#1d2255]"
      >
        <span>
          <span className="block text-sm font-black uppercase tracking-wide text-white">{market.title}</span>
          <span className="text-xs font-semibold text-slate-400">{market.selections.length} selecao(oes)</span>
        </span>
        <span className="flex items-center gap-2 text-xs font-semibold text-slate-400">
          {collapsed ? 'Expandir' : 'Recolher'}
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>

      {!collapsed && (
        <div className="p-3">
          <div className="mb-2 grid grid-cols-[1fr_150px_150px] gap-3 text-center text-xs font-black text-slate-300">
            <span />
            <span>Apostar a Favor (Back)</span>
            <span>Apostar Contra (Lay)</span>
          </div>
          <div className="space-y-2">
            {market.selections.slice(0, 16).map((selection) => (
              <div key={selection.key} className="grid grid-cols-[1fr_150px_150px] items-center gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black uppercase tracking-wide text-white">
                    {selection.label}
                  </p>
                  {selection.suspended && <p className="text-xs font-semibold text-rose-300">Suspenso</p>}
                </div>
                {renderQuoteButton(selection, 'back', selection.back?.odd)}
                {renderQuoteButton(selection, 'lay', selection.lay?.odd)}
              </div>
            ))}
          </div>
          {market.selections.length > 16 && <p className="mt-3 text-right text-xs font-semibold text-slate-400">Mais {market.selections.length - 16} selecao(oes) ocultas</p>}
        </div>
      )}
    </div>
  );
}

function BetSlipPanel({
  selection,
  stakeValue,
  onStakeValue,
  onCancel,
  onConfirm,
}: {
  selection?: BetSlipSelection;
  stakeValue: string;
  onStakeValue: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!selection) {
    return (
      <Card title="Boleta" subtitle="Selecione uma odd back ou lay para montar a aposta.">
        <div className="rounded-md border border-dashed border-white/12 bg-ink-900/70 px-4 py-5 text-sm text-slate-500">
          Nenhum mercado selecionado.
        </div>
      </Card>
    );
  }

  const stake = parseStakeValue(stakeValue);
  const liability = getTicketLiability(selection.side, selection.odd, stake);
  const sideLabel = selection.side === 'back' ? 'Aposta a favor' : 'Aposta contra';
  const panelClass = selection.side === 'back' ? 'border-sky-200/60 bg-sky-100 text-[#11183f]' : 'border-rose-200/70 bg-rose-100 text-[#11183f]';

  return (
    <Card title="Boleta" subtitle="Confira a seleção antes de confirmar.">
      <div className={`overflow-hidden rounded-md border ${panelClass}`}>
        <div className="flex items-center justify-between gap-3 px-3 py-2">
          <div>
            <p className="text-sm font-semibold">{sideLabel}</p>
            <p className="text-base font-black">{selection.selectionLabel}</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded p-2 text-red-500 transition hover:bg-white/40"
            aria-label="Cancelar selecao"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className={`grid gap-2 px-3 pb-3 ${selection.side === 'lay' ? 'grid-cols-3' : 'grid-cols-2'}`}>
          <label>
            <span className="mb-1 block text-xs font-semibold text-slate-700">Odd</span>
            <Input value={formatPlainOdd(selection.odd)} readOnly className="bg-[#172149] text-center text-base font-black" />
          </label>
          <label>
            <span className="mb-1 block text-xs font-semibold text-slate-700">Stake</span>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={stakeValue}
              onChange={(event) => onStakeValue(event.target.value)}
              className="bg-[#172149] text-center text-base font-black"
            />
          </label>
          {selection.side === 'lay' && (
            <label>
              <span className="mb-1 block text-xs font-semibold text-slate-700">Responsabilidade</span>
              <Input value={formatCurrency(liability)} readOnly className="bg-[#172149] text-center text-base font-black" />
            </label>
          )}
        </div>
      </div>
      <Button className="mt-3 w-full" onClick={onConfirm} disabled={stake <= 0} icon={<Check className="h-4 w-4" />}>
        Confirmar aposta
      </Button>
    </Card>
  );
}

function BetCouponsPanel({
  tickets,
  markets,
  lastCashout,
  onCashout,
  onDelete,
}: {
  tickets: BetTicket[];
  markets: OddsDisplayMarket[];
  lastCashout?: string;
  onCashout: (ticket: BetTicket, result: CashoutResult) => void;
  onDelete: (ticketId: string) => void;
}) {
  return (
    <Card title="Cupons de Apostas" subtitle="Operacoes em andamento no replay.">
      <div className="space-y-3">
        {lastCashout && (
          <div className="rounded-md border border-emerald-500/30 bg-emerald-500/12 px-3 py-2 text-sm font-semibold text-emerald-200">
            {lastCashout}
          </div>
        )}
        {tickets.length === 0 && (
          <div className="rounded-md border border-dashed border-white/12 bg-ink-900/70 px-4 py-5 text-sm text-slate-500">
            Nenhuma aposta aberta.
          </div>
        )}
        {tickets.map((ticket) => {
          const cashout = getCashoutResult(ticket, markets);
          const isBack = ticket.side === 'back';

          return (
            <div
              key={ticket.id}
              className={`overflow-hidden rounded-md border ${isBack ? 'border-sky-200/60 bg-sky-100 text-[#11183f]' : 'border-rose-200/70 bg-rose-100 text-[#11183f]'}`}
            >
              <div className={`${isBack ? 'bg-sky-200/70' : 'bg-rose-200/70'} flex items-center justify-between gap-3 px-3 py-2`}>
                <p className="min-w-0 truncate text-sm font-black underline">
                  {ticket.fixtureLabel} - {ticket.marketTitle}
                </p>
                <button
                  type="button"
                  onClick={() => onDelete(ticket.id)}
                  className="shrink-0 rounded p-1 text-red-500 transition hover:bg-white/45 hover:text-red-600"
                  aria-label="Excluir cupom"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="grid gap-3 px-3 py-3 sm:grid-cols-[1fr_auto]">
                <div className="min-w-0">
                  <p className="text-sm text-slate-700">{isBack ? 'Aposta a favor' : 'Aposta contra'}</p>
                  <p className="truncate text-base font-black">{ticket.selectionLabel}</p>
                  <p className="mt-2 text-xs text-slate-700">
                    Bet Id: {ticket.id.slice(-8).toUpperCase()} | Colocada: {ticket.placedAt}
                  </p>
                  <p className="text-xs text-slate-700">Minuto do replay: {ticket.replayMinute}</p>
                </div>
                <div className="grid grid-cols-3 gap-3 text-right text-sm">
                  <div>
                    <p className="font-semibold text-slate-600">Odd</p>
                    <p className="text-base font-black">{formatPlainOdd(ticket.odd)}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-600">Stake</p>
                    <p className="text-base font-black">{formatCurrency(ticket.stake)}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-600">{isBack ? 'Lucro' : 'Respons.'}</p>
                    <p className="text-base font-black">
                      {isBack
                        ? formatCurrency(ticket.stake * ((toValidOddNumber(ticket.odd) ?? 1) - 1))
                        : formatCurrency(ticket.liability)}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#11183f]/10 px-3 py-3">
                <div className="text-sm font-semibold">
                  {cashout ? (
                    <>
                      Cash Out {formatSignedCurrency(cashout.profit)}
                      <span className="ml-2 text-slate-700">via odd {cashout.oppositeOdd.toString().replace('.', ',')}</span>
                    </>
                  ) : (
                    <span className="text-slate-700">Cashout indisponivel neste snapshot</span>
                  )}
                </div>
                <Button
                  type="button"
                  className="min-h-9 bg-amber-400 px-3 py-1 text-[#11183f] hover:bg-amber-300"
                  disabled={!cashout}
                  onClick={() => cashout && onCashout(ticket, cashout)}
                >
                  Cash Out
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function OddsPanel({
  markets,
  onSelectQuote,
}: {
  markets: OddsDisplayMarket[];
  onSelectQuote: (market: OddsDisplayMarket, selection: OddsDisplaySelection, side: BetSide, odd: string) => void;
}) {
  const [expandedMarkets, setExpandedMarkets] = useState<string[]>([]);

  const toggleMarket = (marketKey: string) => {
    setExpandedMarkets((current) =>
      current.includes(marketKey) ? current.filter((key) => key !== marketKey) : [...current, marketKey],
    );
  };

  return (
    <Card title="Odds do Momento" subtitle="Match odds primeiro, depois mercados de over/under gols e demais mercados.">
      <div className="max-h-[760px] space-y-3 overflow-y-auto pr-1">
        {markets.length === 0 && <p className="text-sm text-slate-500">Nenhuma odd gravada neste snapshot.</p>}
        {markets.map((market) => {
          return (
            <MarketBlock
              key={market.key}
              market={market}
              collapsed={!expandedMarkets.includes(market.key)}
              onToggle={() => toggleMarket(market.key)}
              onSelectQuote={(selection, side, odd) => onSelectQuote(market, selection, side, odd)}
            />
          );
        })}
      </div>
    </Card>
  );
}

function ReplayControls({
  game,
  timeline,
  snapshotIndex,
  playing,
  onIndex,
  onPlaying,
}: {
  game: ApiFootballReplayGame;
  timeline: ApiFootballReplaySnapshot[];
  snapshotIndex: number;
  playing: boolean;
  onIndex: (index: number) => void;
  onPlaying: (playing: boolean) => void;
}) {
  const snapshot = timeline[snapshotIndex];
  const maxIndex = Math.max(0, timeline.length - 1);

  return (
    <Card title="Controle do replay">
      <div className="rounded-lg bg-ink-900 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-slate-400">{game.summary.league?.name ?? '-'}</p>
            <h2 className="mt-1 text-2xl font-semibold text-white">
              {game.summary.homeTeam?.name ?? 'Mandante'} x {game.summary.awayTeam?.name ?? 'Visitante'}
            </h2>
            <p className="mt-2 text-xs text-slate-500">
              Primeiro snapshot: {formatCapturedAt(game.summary.firstCapturedAt)} | Ultimo: {formatCapturedAt(game.summary.lastCapturedAt)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-slate-400">Minuto</p>
            <p className="text-3xl font-semibold text-electric-500">{formatReplayMinute(snapshot)}</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-sm text-slate-400">{game.summary.homeTeam?.name ?? 'Mandante'}</p>
            <p className="text-4xl font-semibold text-white">{snapshot?.score.home ?? '-'}</p>
          </div>
          <div className="self-center text-sm text-slate-500">{snapshot?.status?.long ?? 'snapshot'}</div>
          <div>
            <p className="text-sm text-slate-400">{game.summary.awayTeam?.name ?? 'Visitante'}</p>
            <p className="text-4xl font-semibold text-white">{snapshot?.score.away ?? '-'}</p>
          </div>
        </div>

        <div className="mt-6">
          <div className="mb-2 text-center text-xs font-semibold text-slate-400">
            {formatCapturedAt(snapshot?.capturedAt)}
          </div>
          <input
            type="range"
            min={0}
            max={maxIndex}
            value={snapshotIndex}
            onChange={(event) => {
              onIndex(Number(event.target.value));
              onPlaying(false);
            }}
            className="h-4 w-full cursor-pointer accent-electric-500"
          />
        </div>

        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Button variant="secondary" className="px-3" onClick={() => onIndex(Math.max(0, snapshotIndex - 1))} icon={<SkipBack className="h-4 w-4" />} />
          <Button onClick={() => onPlaying(!playing)} icon={playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}>
            {playing ? 'Pausar' : 'Play'}
          </Button>
          <Button variant="secondary" className="px-3" onClick={() => onIndex(Math.min(maxIndex, snapshotIndex + 1))} icon={<SkipForward className="h-4 w-4" />} />
          <Button variant="ghost" className="px-3" onClick={() => onIndex(0)} icon={<RotateCcw className="h-4 w-4" />} />
        </div>
      </div>
    </Card>
  );
}

function StatsPanel({ game, snapshot }: { game?: ApiFootballReplayGame; snapshot?: ApiFootballReplaySnapshot }) {
  const homeId = game?.summary.homeTeam?.id;
  const awayId = game?.summary.awayTeam?.id;
  const stats = [
    { label: 'Gols', sourceLabels: ['Gols'] },
    { label: 'Cartoes amarelos', sourceLabels: ['Cartoes Amarelos', 'Yellow Cards'] },
    { label: 'Cartoes vermelhos', sourceLabels: ['Cartoes Vermelhos', 'Red Cards'] },
    { label: 'Substituicoes', sourceLabels: ['Substituicoes'] },
    { label: 'Finalizacoes', sourceLabels: ['Total Shots'] },
    { label: 'Finalizacoes no alvo', sourceLabels: ['Shots on Goal'] },
    { label: 'Finalizacoes para fora', sourceLabels: ['Shots off Goal'] },
    { label: 'Chutes bloqueados', sourceLabels: ['Blocked Shots'] },
    { label: 'Escanteios', sourceLabels: ['Corner Kicks'] },
    { label: 'Posse de bola', sourceLabels: ['Ball Possession'] },
    { label: 'Defesas do goleiro', sourceLabels: ['Goalkeeper Saves'] },
    { label: 'Faltas', sourceLabels: ['Fouls'] },
    { label: 'Precisao dos passes', sourceLabels: ['Passes %'] },
  ];

  return (
    <Card title="Estatisticas da Partida" subtitle="Dados gravados no snapshot selecionado.">
      <div className="mb-4 grid grid-cols-3 gap-3 text-sm">
        <p className="font-semibold text-electric-300">{game?.summary.homeTeam?.name ?? 'Mandante'}</p>
        <p className="text-center text-slate-500">comparativo</p>
        <p className="text-right font-semibold text-violet-300">{game?.summary.awayTeam?.name ?? 'Visitante'}</p>
      </div>
      <div className="space-y-2">
        {stats.map((stat) => (
          <StatComparison
            key={stat.label}
            label={stat.label}
            home={getStatValue(snapshot, homeId, stat.sourceLabels)}
            away={getStatValue(snapshot, awayId, stat.sourceLabels)}
          />
        ))}
      </div>
    </Card>
  );
}

export function ReplayPage({ delay }: ReplayPageProps) {
  const [query, setQuery] = useState('');
  const [selectedFixtureId, setSelectedFixtureId] = useState<number | undefined>();
  const [snapshotIndex, setSnapshotIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [selectedSlip, setSelectedSlip] = useState<BetSlipSelection | undefined>();
  const [stakeValue, setStakeValue] = useState('10');
  const [tickets, setTickets] = useState<BetTicket[]>([]);
  const [lastCashout, setLastCashout] = useState<string | undefined>();
  const { data: games, loading, error } = useAsyncData(
    () => apiFootballService.buscarReplayGames(),
    [],
  );
  const activeFixtureId = selectedFixtureId ?? games?.[0]?.fixtureId;
  const {
    data: game,
    loading: gameLoading,
    error: gameError,
  } = useAsyncData(
    () => (activeFixtureId ? apiFootballService.buscarReplayGame(activeFixtureId) : Promise.resolve(undefined)),
    [activeFixtureId],
  );

  const playableTimeline = useMemo(() => {
    if (!game) return [];
    const playingSnapshots = game.timeline.filter(isPlayingSnapshot);
    return playingSnapshots.length > 0 ? playingSnapshots : game.timeline;
  }, [game]);
  const snapshot = playableTimeline[snapshotIndex];
  const currentMarkets = useMemo(() => getDisplayMarkets(snapshot, game).slice(0, 30), [game, snapshot]);
  const fixtureLabel = `${game?.summary.homeTeam?.name ?? 'Mandante'} vs ${game?.summary.awayTeam?.name ?? 'Visitante'}`;

  useEffect(() => {
    setSnapshotIndex(0);
    setPlaying(false);
    setSelectedSlip(undefined);
    setStakeValue('10');
    setTickets([]);
    setLastCashout(undefined);
  }, [activeFixtureId]);

  useEffect(() => {
    if (!playing || !game) return;

    const interval = window.setInterval(() => {
      setSnapshotIndex((current) => {
        const next = current + 1;
        if (next >= playableTimeline.length) {
          setPlaying(false);
          return current;
        }
        return next;
      });
    }, delay);

    return () => window.clearInterval(interval);
  }, [delay, game, playableTimeline.length, playing]);

  useEffect(() => {
    if (snapshotIndex < playableTimeline.length) return;
    setSnapshotIndex(Math.max(0, playableTimeline.length - 1));
  }, [playableTimeline.length, snapshotIndex]);

  const handleSelectQuote = (
    market: OddsDisplayMarket,
    selection: OddsDisplaySelection,
    side: BetSide,
    odd: string,
  ) => {
    setSelectedSlip({
      marketKey: market.key,
      marketTitle: market.title,
      selectionKey: selection.key,
      selectionLabel: selection.label,
      side,
      odd,
    });
    setStakeValue((current) => (parseStakeValue(current) > 0 ? current : '10'));
  };

  const handleConfirmBet = () => {
    if (!selectedSlip) return;

    const stake = parseStakeValue(stakeValue);
    if (stake <= 0) return;

    const ticket: BetTicket = {
      ...selectedSlip,
      id: uid('bet'),
      fixtureLabel,
      placedAt: new Date().toLocaleString('pt-BR'),
      replayMinute: formatReplayMinute(snapshot),
      stake,
      liability: getTicketLiability(selectedSlip.side, selectedSlip.odd, stake),
    };

    setTickets((current) => [ticket, ...current]);
    setSelectedSlip(undefined);
    setLastCashout(undefined);
  };

  const handleCashout = (ticket: BetTicket, result: CashoutResult) => {
    setTickets((current) => current.filter((item) => item.id !== ticket.id));
    setLastCashout(`${ticket.selectionLabel}: cashout realizado em ${formatSignedCurrency(result.profit)}.`);
  };

  const handleDeleteTicket = (ticketId: string) => {
    setTickets((current) => current.filter((item) => item.id !== ticketId));
  };

  return (
    <>
      <PageHeader
        title="Replay de jogos"
        description="Reconstroi partidas minuto a minuto usando os snapshots historicos gravados pelo backend."
      />

      {loading && <EmptyState title="Carregando base historica" description="Lendo snapshots gravados pelo coletor." />}
      {error && !loading && <EmptyState title="Nao foi possivel carregar o replay" description={error} />}
      {!loading && !error && (games ?? []).length === 0 && (
        <EmptyState
          title="Nenhuma partida capturada ainda"
          description="Mantenha o backend rodando para o coletor gravar fixtures, estatisticas e odds. Os jogos aparecem aqui conforme os snapshots forem acumulando."
        />
      )}

      {!loading && !error && (games ?? []).length > 0 && (
        <div className="space-y-5">
            {gameLoading && <EmptyState title="Abrindo partida" description="Montando timeline da partida selecionada." />}
            {gameError && !gameLoading && <EmptyState title="Nao foi possivel abrir a partida" description={gameError} />}
            {game && !gameLoading && (
              <>
                <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px] 2xl:grid-cols-[minmax(0,1fr)_420px]">
                  <ReplayControls
                    game={game}
                    timeline={playableTimeline}
                    snapshotIndex={Math.min(snapshotIndex, Math.max(0, playableTimeline.length - 1))}
                    playing={playing}
                    onIndex={setSnapshotIndex}
                    onPlaying={setPlaying}
                  />
                  <div className="space-y-5">
                    <BetCouponsPanel
                      tickets={tickets}
                      markets={currentMarkets}
                      lastCashout={lastCashout}
                      onCashout={handleCashout}
                      onDelete={handleDeleteTicket}
                    />
                    <BetSlipPanel
                      selection={selectedSlip}
                      stakeValue={stakeValue}
                      onStakeValue={setStakeValue}
                      onCancel={() => setSelectedSlip(undefined)}
                      onConfirm={handleConfirmBet}
                    />
                  </div>
                </div>
                <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px] 2xl:grid-cols-[minmax(0,1fr)_420px]">
                  <div className="min-w-0 space-y-5">
                    <OddsPanel markets={currentMarkets} onSelectQuote={handleSelectQuote} />
                    <ReplayGameSearch
                      games={games ?? []}
                      selectedFixtureId={activeFixtureId}
                      query={query}
                      onQuery={setQuery}
                      onSelect={setSelectedFixtureId}
                    />
                  </div>
                  <div className="space-y-5">
                    <StatsPanel game={game} snapshot={snapshot} />
                  </div>
                </div>
              </>
            )}
        </div>
      )}
    </>
  );
}
