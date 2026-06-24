import { useEffect, useMemo, useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { runBacktest } from './services/backtest';
import { loadHistoricalBacktestGames } from './services/replayToBacktest';
import { storage } from './services/storage';
import { Bot, BacktestJob, BacktestResult, BotLog, Game } from './types';
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
  const [backtestJobs, setBacktestJobs] = useState<BacktestJob[]>(() => {
    const jobs = storage.getBacktestJobs().map((job) => (job.status === 'processing' ? { ...job, status: 'pending' as const, progress: 0 } : job));
    storage.saveBacktestJobs(jobs);
    return jobs;
  });
  const [settings] = useState(() => storage.getSettings());
  const [editingBot, setEditingBot] = useState<Bot | undefined>();
  const [botEditorOpen, setBotEditorOpen] = useState(false);
  const [historicalGames, setHistoricalGames] = useState<Game[]>([]);

  const rankings = useMemo(
    () =>
      results
        .map((result) => {
          const bot = bots.find((item) => item.id === result.botId);
          return {
            botId: result.botId,
            botName: result.botName,
            roi: result.roi,
            profit: result.profit,
            entries: result.totalEntries,
            greens: result.greens,
            reds: result.reds,
            accuracy: result.totalEntries ? Number(((result.greens / result.totalEntries) * 100).toFixed(2)) : 0,
            mode: bot?.mode ?? 'live',
            market: bot?.market,
          };
        })
        .sort((a, b) => b.roi - a.roi),
    [bots, results],
  );

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
    setBots(next);
  };

  const duplicate = (bot: Bot) => {
    const next = storage.upsertBot(duplicateBot(bot));
    setBots(next);
  };

  const saveBacktest = (result: BacktestResult, newLogs: BotLog[]) => {
    setResults(storage.saveResult(result));
    setLogs(storage.appendLogs(newLogs));
  };

  const updateBacktestJob = (jobId: string, patch: Partial<BacktestJob>) => {
    setBacktestJobs(storage.updateBacktestJob(jobId, patch));
  };

  const getHistoricalGames = async () => {
    if (historicalGames.length > 0) return historicalGames;
    const games = await loadHistoricalBacktestGames();
    setHistoricalGames(games);
    return games;
  };

  const runBotBacktest = (bot: Bot) => {
    const pendingCount = backtestJobs.filter((job) => job.status === 'pending' || job.status === 'processing').length;
    if (pendingCount >= 10) {
      window.alert('Limite de 10 relatorios aguardando/processando atingido.');
      return;
    }

    const { jobs } = storage.createBacktestJob(bot);
    setBacktestJobs(jobs);
    setPage('backtest');
  };

  useEffect(() => {
    const nextJob = backtestJobs.find((job) => {
      if (job.status !== 'pending') return false;
      if (!job.scheduledFor) return true;
      return new Date(job.scheduledFor).getTime() <= Date.now();
    });

    if (!nextJob || backtestJobs.some((job) => job.status === 'processing')) return;

    let cancelled = false;
    const startedAt = new Date().toISOString();
    setBacktestJobs(storage.updateBacktestJob(nextJob.id, { status: 'processing', startedAt, progress: 10 }));

    const processJob = async () => {
      try {
        const games = await getHistoricalGames();
        if (cancelled) return;
        setBacktestJobs(storage.updateBacktestJob(nextJob.id, { progress: 55 }));

        const output = runBacktest(nextJob.botSnapshot, games);
        if (cancelled) return;

        saveBacktest(output.result, output.logs);
        setBacktestJobs(storage.updateBacktestJob(nextJob.id, {
          status: 'completed',
          finishedAt: new Date().toISOString(),
          progress: 100,
          resultId: output.result.botId,
          result: output.result,
          logs: output.logs,
          entries: output.result.totalEntries,
          accuracy: output.result.totalEntries > 0 ? Number(((output.result.greens / output.result.totalEntries) * 100).toFixed(2)) : 0,
          profit: output.result.profit,
          roi: output.result.roi,
        }));
      } catch (error) {
        if (cancelled) return;
        setBacktestJobs(storage.updateBacktestJob(nextJob.id, {
          status: 'error',
          finishedAt: new Date().toISOString(),
          progress: 100,
          errorMessage: error instanceof Error ? error.message : 'Nao foi possivel processar o backtest.',
        }));
      }
    };

    processJob();

    return () => {
      cancelled = true;
    };
  }, [backtestJobs, historicalGames]);

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
            jobs={backtestJobs}
            onDeleteJob={(jobId) => setBacktestJobs(storage.deleteBacktestJob(jobId))}
            onDeleteAllJobs={() => {
              if (window.confirm('Excluir todos os relatorios de backtest?')) {
                setBacktestJobs(storage.deleteAllBacktestJobs());
              }
            }}
            onCancelJob={(jobId) => updateBacktestJob(jobId, { status: 'cancelled', finishedAt: new Date().toISOString() })}
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
