import { apiClient } from '../api/client';
import { BacktestJob, Bot } from '../types';
import { createBacktestJobDraft, normalizeBacktestJob, storage } from './storage';

type BacktestJobsResponse = {
  ok: boolean;
  storageMode?: string;
  jobs: unknown[];
};

const normalizeJobs = (jobs: unknown[]) => jobs.map(normalizeBacktestJob);

const mirrorLocalJobs = (jobs: BacktestJob[]) => {
  storage.saveBacktestJobs(jobs);
  return jobs;
};

const fallback = {
  list: () => storage.getBacktestJobs(),
  upsert: (job: BacktestJob) => {
    const jobs = [job, ...storage.getBacktestJobs().filter((item) => item.id !== job.id)];
    storage.saveBacktestJobs(jobs);
    return jobs;
  },
  upsertMany: (nextJobs: BacktestJob[]) => {
    const ids = new Set(nextJobs.map((job) => job.id));
    const jobs = [...nextJobs, ...storage.getBacktestJobs().filter((item) => !ids.has(item.id))];
    storage.saveBacktestJobs(jobs);
    return jobs;
  },
  patch: (jobId: string, patch: Partial<BacktestJob>) => storage.updateBacktestJob(jobId, patch),
  delete: (jobId: string) => storage.deleteBacktestJob(jobId),
  deleteAll: () => storage.deleteAllBacktestJobs(),
};

const requestJobs = async (path: string, method: 'GET' | 'POST' | 'PATCH' | 'DELETE', body?: Record<string, unknown>) => {
  const response = await apiClient<BacktestJobsResponse>(path, { method, body });
  return normalizeJobs(response.jobs ?? []);
};

export const backtestJobRepository = {
  list: async () => {
    try {
      const remoteJobs = await requestJobs('/backtest/jobs', 'GET');
      if (remoteJobs.length > 0) return mirrorLocalJobs(remoteJobs);

      const localJobs = fallback.list();
      if (localJobs.length === 0) return remoteJobs;

      let jobs = remoteJobs;
      for (const job of localJobs) {
        jobs = await requestJobs('/backtest/jobs', 'POST', { job });
      }
      return mirrorLocalJobs(jobs);
    } catch {
      return fallback.list();
    }
  },

  create: async (bot: Bot, scheduledFor?: string) => {
    const job = createBacktestJobDraft(bot, scheduledFor);

    try {
      const jobs = await requestJobs('/backtest/jobs', 'POST', { job });
      return { job, jobs: mirrorLocalJobs(jobs) };
    } catch {
      return { job, jobs: fallback.upsert(job) };
    }
  },

  upsert: async (job: BacktestJob) => {
    try {
      const jobs = await requestJobs('/backtest/jobs', 'POST', { job });
      return mirrorLocalJobs(jobs);
    } catch {
      return fallback.upsert(job);
    }
  },

  upsertMany: async (jobsToUpsert: BacktestJob[]) => {
    try {
      const response = await apiClient<BacktestJobsResponse>('/backtest/jobs/batch', {
        method: 'POST',
        body: { jobs: jobsToUpsert },
      });
      return mirrorLocalJobs(normalizeJobs(response.jobs ?? []));
    } catch {
      return fallback.upsertMany(jobsToUpsert);
    }
  },

  patch: async (jobId: string, patch: Partial<BacktestJob>) => {
    try {
      return mirrorLocalJobs(await requestJobs(`/backtest/jobs/${encodeURIComponent(jobId)}`, 'PATCH', { patch }));
    } catch {
      return fallback.patch(jobId, patch);
    }
  },

  delete: async (jobId: string) => {
    try {
      fallback.delete(jobId);
      return mirrorLocalJobs(await requestJobs(`/backtest/jobs/${encodeURIComponent(jobId)}`, 'DELETE'));
    } catch {
      return fallback.delete(jobId);
    }
  },

  deleteAll: async () => {
    try {
      fallback.deleteAll();
      return mirrorLocalJobs(await requestJobs('/backtest/jobs', 'DELETE'));
    } catch {
      return fallback.deleteAll();
    }
  },
};
