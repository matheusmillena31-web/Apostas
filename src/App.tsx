import { useEffect, useMemo, useRef, useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { runBacktest } from './services/backtest';
import { buildAutonomousReportVariants, buildMarketAutonomousReportVariants, createAutonomousReportHash } from './services/autonomousReportGenerator';
import { backtestJobRepository } from './services/backtestJobRepository';
import { loadHistoricalBacktestGames } from './services/replayToBacktest';
import { storage } from './services/storage';
import { Bot, BacktestJob, BacktestResult, BotLog, Game } from './types';
import { Dashboard } from './pages/Dashboard';
import { BotsPage, duplicateBot } from './pages/BotsPage';
import { BotEditor } from './pages/BotEditor';
import { LiveGames } from './pages/LiveGames';
import { BacktestPage } from './pages/BacktestPage';
import { ReplayPage } from './pages/ReplayPage';
import { ReportGenerator } from './pages/ReportGenerator';
import { Reports } from './pages/Reports';
import { Ranking } from './pages/Ranking';
import { SystemStatus } from './pages/SystemStatus';

export type PageKey =
  | 'dashboard'
  | 'bots'
  | 'liveGames'
  | 'reportGenerator'
  | 'backtest'
  | 'replay'
  | 'reports'
  | 'ranking'
  | 'status';

const titles: Record<PageKey, string> = {
  dashboard: 'Dashboard',
  bots: 'Bots',
  liveGames: 'Jogos ao vivo',
  reportGenerator: 'Gerador de Relatorios',
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
    return jobs;
  });
  const [settings] = useState(() => storage.getSettings());
  const [editingBot, setEditingBot] = useState<Bot | undefined>();
  const [botEditorOpen, setBotEditorOpen] = useState(false);
  const historicalGamesRef = useRef<Game[]>([]);
  const historicalGamesPromiseRef = useRef<Promise<Game[]> | undefined>(undefined);
  const processingJobIdRef = useRef<string | undefined>(undefined);
  const maxPendingReports = 20;

  const applyBacktestJobs = (jobs: BacktestJob[]) => {
    setBacktestJobs(jobs);
    const completedResults = jobs
      .filter((job) => job.status === 'completed' && job.result)
      .map((job) => job.result as BacktestResult);

    setResults(completedResults);
  };

  useEffect(() => {
    let mounted = true;

    backtestJobRepository.list().then((jobs) => {
      if (!mounted) return;
      applyBacktestJobs(jobs.map((job) => (job.status === 'processing' ? { ...job, status: 'pending' as const, progress: 0 } : job)));
    });

    return () => {
      mounted = false;
    };
  }, []);

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
    setResults((current) => [result, ...current]);
    setLogs(storage.appendLogs(newLogs));
  };

  const updateBacktestJob = async (jobId: string, patch: Partial<BacktestJob>) => {
    const jobs = await backtestJobRepository.patch(jobId, patch);
    applyBacktestJobs(jobs);
    return jobs;
  };

  const getHistoricalGames = async () => {
    if (historicalGamesRef.current.length > 0) return historicalGamesRef.current;
    if (!historicalGamesPromiseRef.current) {
      historicalGamesPromiseRef.current = loadHistoricalBacktestGames()
        .then((games) => {
          historicalGamesRef.current = games;
          return games;
        })
        .catch((error) => {
          historicalGamesPromiseRef.current = undefined;
          throw error;
        });
    }
    return historicalGamesPromiseRef.current;
  };

  const runBotBacktest = async (bot: Bot) => {
    const pendingCount = backtestJobs.filter((job) => job.status === 'pending' || job.status === 'processing').length;
    if (pendingCount >= maxPendingReports) {
      window.alert(`Limite de ${maxPendingReports} relatorios aguardando/processando atingido.`);
      return false;
    }

    const { jobs } = await backtestJobRepository.create(bot);
    applyBacktestJobs(jobs);
    setPage('backtest');
    return true;
  };

  const generateBacktestReport = async (bot: Bot) => {
    const created = await runBotBacktest(bot);
    if (!created) return;
    setEditingBot(undefined);
    setBotEditorOpen(false);
  };

  const generateAutonomousReports = async (bot: Bot) => {
    const pendingCount = backtestJobs.filter((job) => job.status === 'pending' || job.status === 'processing').length;
    const availableSlots = Math.max(0, maxPendingReports - pendingCount);
    if (availableSlots <= 0) {
      window.alert(`Limite de ${maxPendingReports} relatorios aguardando/processando atingido.`);
      return false;
    }

    const batch = buildAutonomousReportVariants(bot, backtestJobs, Math.min(maxPendingReports, availableSlots));
    if (batch.variants.length === 0) {
      window.alert('Nao foi encontrada uma variacao inedita para estes parametros.');
      return false;
    }

    let jobsSnapshot = backtestJobs;
    for (const [index, variant] of batch.variants.entries()) {
      const { job } = await backtestJobRepository.create(variant);
      jobsSnapshot = await backtestJobRepository.patch(job.id, {
        name: `${variant.name} - ${new Date(job.createdAt).toLocaleString('pt-BR')}`,
        createdBy: 'Automatico',
        automation: {
          source: 'autonomous',
          hash: createAutonomousReportHash(variant),
          baseBotId: bot.id,
          variantIndex: index + 1,
        },
      });
    }

    applyBacktestJobs(jobsSnapshot);
    setEditingBot(undefined);
    setBotEditorOpen(false);
    setPage('backtest');
    return true;
  };

  const createJobsFromVariants = async (variants: Bot[], baseBotId?: string) => {
    let jobsSnapshot = backtestJobs;
    for (const [index, variant] of variants.entries()) {
      const { job } = await backtestJobRepository.create(variant);
      jobsSnapshot = await backtestJobRepository.patch(job.id, {
        name: `${variant.name} - ${new Date(job.createdAt).toLocaleString('pt-BR')}`,
        createdBy: 'Automatico',
        automation: {
          source: 'autonomous',
          hash: createAutonomousReportHash(variant),
          baseBotId,
          variantIndex: index + 1,
        },
      });
    }
    applyBacktestJobs(jobsSnapshot);
    setPage('backtest');
  };

  const generateMarketReports = async (marketValue: string, quantity: number) => {
    const pendingCount = backtestJobs.filter((job) => job.status === 'pending' || job.status === 'processing').length;
    const availableSlots = Math.max(0, maxPendingReports - pendingCount);
    if (availableSlots <= 0) {
      window.alert(`Limite de ${maxPendingReports} relatorios aguardando/processando atingido.`);
      return;
    }

    const batch = buildMarketAutonomousReportVariants(marketValue, backtestJobs, Math.min(quantity, availableSlots));
    if (batch.variants.length === 0) {
      window.alert('Nao foi encontrada uma variacao inedita para este mercado.');
      return;
    }

    await createJobsFromVariants(batch.variants);
  };

  useEffect(() => {
    const nextJob = backtestJobs.find((job) => {
      if (job.status !== 'pending') return false;
      if (!job.scheduledFor) return true;
      return new Date(job.scheduledFor).getTime() <= Date.now();
    });

    if (!nextJob || processingJobIdRef.current || backtestJobs.some((job) => job.status === 'processing')) return;

    processingJobIdRef.current = nextJob.id;
    const startedAt = new Date().toISOString();

    const processJob = async () => {
      try {
        await updateBacktestJob(nextJob.id, { status: 'processing', startedAt, progress: 10 });
        const games = await getHistoricalGames();
        await updateBacktestJob(nextJob.id, { progress: 55 });

        const output = runBacktest(nextJob.botSnapshot, games);

        saveBacktest(output.result, output.logs);
        const completedJobs = await updateBacktestJob(nextJob.id, {
          status: 'completed',
          finishedAt: new Date().toISOString(),
          progress: 100,
          resultId: output.result.botId,
          result: output.result,
          entries: output.result.totalEntries,
          accuracy: output.result.totalEntries > 0 ? Number(((output.result.greens / output.result.totalEntries) * 100).toFixed(2)) : 0,
          profit: output.result.profit,
          roi: output.result.roi,
        });
        processingJobIdRef.current = undefined;
        applyBacktestJobs(completedJobs);
      } catch (error) {
        const errorJobs = await updateBacktestJob(nextJob.id, {
          status: 'error',
          finishedAt: new Date().toISOString(),
          progress: 100,
          errorMessage: error instanceof Error ? error.message : 'Nao foi possivel processar o backtest.',
        });
        processingJobIdRef.current = undefined;
        applyBacktestJobs(errorJobs);
      }
    };

    processJob();
  }, [backtestJobs]);

  const content = (() => {
    switch (page) {
      case 'dashboard':
        return <Dashboard bots={bots} results={results} onCreateBot={openBotCreator} />;
      case 'bots':
        return botEditorOpen ? (
          <BotEditor bot={editingBot} defaultStake={settings.defaultStake} onSave={saveBot} onGenerateReport={generateBacktestReport} onGenerateAutonomousReports={generateAutonomousReports} />
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
            onGenerateReports={generateAutonomousReports}
          />
        );
      case 'liveGames':
        return <LiveGames bots={bots} />;
      case 'reportGenerator':
        return (
          <ReportGenerator
            activeReports={backtestJobs.filter((job) => job.status === 'pending' || job.status === 'processing').length}
            maxReports={maxPendingReports}
            onGenerate={generateMarketReports}
          />
        );
      case 'backtest':
        return (
          <BacktestPage
            jobs={backtestJobs}
            onDeleteJob={async (jobId) => {
              const jobs = await backtestJobRepository.delete(jobId);
              applyBacktestJobs(jobs);
            }}
            onDeleteAllJobs={async () => {
              if (window.confirm('Excluir todos os relatorios de backtest?')) {
                const jobs = await backtestJobRepository.deleteAll();
                applyBacktestJobs(jobs);
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
