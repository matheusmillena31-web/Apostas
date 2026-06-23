import { useMemo, useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { runAllRankings, runBacktest } from './services/backtest';
import { loadHistoricalBacktestGames } from './services/replayToBacktest';
import { storage } from './services/storage';
import { Bot, BacktestResult, BotLog, Game } from './types';
import { Dashboard } from './pages/Dashboard';
import { BotsPage, duplicateBot } from './pages/BotsPage';
import { BotEditor } from './pages/BotEditor';
import { LiveGames } from './pages/LiveGames';
import { GameLists } from './pages/GameLists';
import { TradingExecution } from './pages/TradingExecution';
import { BacktestPage } from './pages/BacktestPage';
import { ReplayPage } from './pages/ReplayPage';
import { Reports } from './pages/Reports';
import { Ranking } from './pages/Ranking';
import { SystemStatus } from './pages/SystemStatus';

export type PageKey =
  | 'dashboard'
  | 'bots'
  | 'liveGames'
  | 'gameLists'
  | 'trading'
  | 'backtest'
  | 'replay'
  | 'reports'
  | 'ranking'
  | 'status';

const titles: Record<PageKey, string> = {
  dashboard: 'Dashboard',
  bots: 'Bots',
  liveGames: 'Jogos ao vivo',
  gameLists: 'Listas de jogos',
  trading: 'Trading em execucao',
  backtest: 'Backtest',
  replay: 'Replay de jogos',
  reports: 'Relatorios',
  ranking: 'Ranking de metodos',
  status: 'Status do Sistema',
};

export default function App() {
  const [page, setPage] = useState<PageKey>('dashboard');
  const [bots, setBots] = useState<Bot[]>(() => storage.getBots());
  const [logs, setLogs] = useState<BotLog[]>(() => storage.getLogs());
  const [results, setResults] = useState<BacktestResult[]>(() => storage.getResults());
  const [settings] = useState(() => storage.getSettings());
  const [editingBot, setEditingBot] = useState<Bot | undefined>();
  const [botEditorOpen, setBotEditorOpen] = useState(false);
  const [selectedBacktestBot, setSelectedBacktestBot] = useState<Bot | undefined>();
  const [selectedBacktestResult, setSelectedBacktestResult] = useState<BacktestResult | undefined>();
  const [historicalGames, setHistoricalGames] = useState<Game[]>([]);

  const rankings = useMemo(() => runAllRankings(bots, historicalGames), [bots, historicalGames]);

  const navigate = (nextPage: PageKey) => {
    setEditingBot(undefined);
    setBotEditorOpen(false);
    setPage(nextPage);
  };

  const openBotCreator = () => {
    setEditingBot(undefined);
    setBotEditorOpen(true);
    setPage('bots');
  };

  const saveBot = (bot: Bot) => {
    const next = storage.upsertBot(bot);
    setBots(next);
    setEditingBot(undefined);
    setBotEditorOpen(false);
    setPage('bots');
  };

  const deleteBot = (botId: string) => {
    const next = storage.deleteBot(botId);
    const nextResults = storage.getResults().filter((result) => result.botId !== botId);
    setBots(next);
    storage.saveResults(nextResults);
    setResults(nextResults);
    if (selectedBacktestBot?.id === botId) {
      setSelectedBacktestBot(undefined);
      setSelectedBacktestResult(undefined);
    }
  };

  const duplicate = (bot: Bot) => {
    const next = storage.upsertBot(duplicateBot(bot));
    setBots(next);
  };

  const saveBacktest = (result: BacktestResult, newLogs: BotLog[]) => {
    setResults(storage.saveResult(result));
    setLogs(storage.appendLogs(newLogs));
  };

  const getHistoricalGames = async () => {
    if (historicalGames.length > 0) return historicalGames;
    const games = await loadHistoricalBacktestGames();
    setHistoricalGames(games);
    return games;
  };

  const runBotBacktest = async (bot: Bot) => {
    setSelectedBacktestBot(bot);
    setSelectedBacktestResult(undefined);
    setPage('backtest');

    try {
      const games = await getHistoricalGames();
      const output = runBacktest(bot, games);
      saveBacktest(output.result, output.logs);
      setSelectedBacktestResult(output.result);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Nao foi possivel carregar a base historica para o backtest.');
    }
  };

  const content = (() => {
    switch (page) {
      case 'dashboard':
        return <Dashboard bots={bots} results={results} onCreateBot={openBotCreator} />;
      case 'bots':
        return botEditorOpen ? (
          <BotEditor bot={editingBot} defaultStake={settings.defaultStake} onSave={saveBot} />
        ) : (
          <BotsPage
            bots={bots}
            results={results}
            onCreate={openBotCreator}
            onEdit={(bot) => {
              setEditingBot(bot);
              setBotEditorOpen(true);
              setPage('bots');
            }}
            onDelete={deleteBot}
            onDuplicate={duplicate}
            onBacktest={runBotBacktest}
          />
        );
      case 'liveGames':
        return <LiveGames bots={bots} />;
      case 'gameLists':
        return <GameLists />;
      case 'trading':
        return <TradingExecution bots={bots} />;
      case 'backtest':
        return (
          <BacktestPage
            bots={bots}
            selectedBot={selectedBacktestBot}
            initialResult={selectedBacktestResult}
            historicalGames={historicalGames}
            onHistoricalGamesLoaded={setHistoricalGames}
            onResult={(result, newLogs) => {
              saveBacktest(result, newLogs);
              setSelectedBacktestResult(result);
            }}
          />
        );
      case 'replay':
        return <ReplayPage bots={bots} delay={settings.simulationDelay} />;
      case 'reports':
        return <Reports results={results} bots={bots} />;
      case 'ranking':
        return <Ranking rankings={rankings} />;
      case 'status':
        return <SystemStatus bots={bots} logs={logs} results={results} />;
      default:
        return null;
    }
  })();

  return (
    <div className="min-h-screen">
      <Sidebar activePage={page} onNavigate={navigate} />
      <Topbar title={titles[page]} activePage={page} onNavigate={navigate} />
      <main className="px-4 py-6 lg:ml-72 lg:px-8">
        <div className={`mx-auto ${page === 'replay' ? 'max-w-none' : 'max-w-7xl'}`}>{content}</div>
      </main>
    </div>
  );
}
