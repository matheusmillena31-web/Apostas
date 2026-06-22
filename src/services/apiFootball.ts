import { apiClient } from '../api/client';
import {
  ApiFootballEnvelope,
  ApiFootballFixtureEvent,
  ApiFootballFixtureItem,
  ApiFootballFixtureStatisticsItem,
  ApiFootballLeagueItem,
  ApiFootballLiveOddsItem,
  ApiFootballOddsItem,
  ApiFootballProxyStatus,
  ApiFootballStandingsLeague,
} from '../types/api';

const endpoints = {
  proxyHealth: '/health',
  fixtures: '/fixtures',
  fixtureStatistics: '/fixtures/statistics',
  fixtureEvents: '/fixtures/events',
  leagues: '/leagues',
  standings: '/standings',
  odds: '/odds',
  liveOdds: '/odds/live',
};

const unwrap = <TResponse>(envelope: ApiFootballEnvelope<TResponse>) => envelope.response;

export class ApiFootballService {
  static async buscarStatusProxy(): Promise<ApiFootballProxyStatus> {
    return apiClient<ApiFootballProxyStatus>(endpoints.proxyHealth);
  }

  static async buscarLigasAtuais(): Promise<ApiFootballLeagueItem[]> {
    const envelope = await apiClient<ApiFootballEnvelope<ApiFootballLeagueItem[]>>(endpoints.leagues, {
      query: { current: true },
    });
    return unwrap(envelope);
  }

  static async buscarFixturesAoVivo(): Promise<ApiFootballFixtureItem[]> {
    const envelope = await apiClient<ApiFootballEnvelope<ApiFootballFixtureItem[]>>(endpoints.fixtures, {
      query: { live: 'all', timezone: 'America/Sao_Paulo' },
    });
    return unwrap(envelope);
  }

  static async buscarFixturesDaLiga(leagueId: number, season: number): Promise<ApiFootballFixtureItem[]> {
    const envelope = await apiClient<ApiFootballEnvelope<ApiFootballFixtureItem[]>>(endpoints.fixtures, {
      query: { league: leagueId, season, timezone: 'America/Sao_Paulo' },
    });
    return unwrap(envelope);
  }

  static async buscarStandings(leagueId: number, season: number): Promise<ApiFootballStandingsLeague[]> {
    const envelope = await apiClient<ApiFootballEnvelope<ApiFootballStandingsLeague[]>>(endpoints.standings, {
      query: { league: leagueId, season },
    });
    return unwrap(envelope);
  }

  static async buscarEstatisticasFixture(fixtureId: number): Promise<ApiFootballFixtureStatisticsItem[]> {
    const envelope = await apiClient<ApiFootballEnvelope<ApiFootballFixtureStatisticsItem[]>>(endpoints.fixtureStatistics, {
      query: { fixture: fixtureId },
    });
    return unwrap(envelope);
  }

  static async buscarEventosFixture(fixtureId: number): Promise<ApiFootballFixtureEvent[]> {
    const envelope = await apiClient<ApiFootballEnvelope<ApiFootballFixtureEvent[]>>(endpoints.fixtureEvents, {
      query: { fixture: fixtureId },
    });
    return unwrap(envelope);
  }

  static async buscarOddsFixture(fixtureId: number): Promise<ApiFootballOddsItem[]> {
    const envelope = await apiClient<ApiFootballEnvelope<ApiFootballOddsItem[]>>(endpoints.odds, {
      query: { fixture: fixtureId },
    });
    return unwrap(envelope);
  }

  static async buscarOddsAoVivo(fixtureId?: number): Promise<ApiFootballLiveOddsItem[]> {
    const envelope = await apiClient<ApiFootballEnvelope<ApiFootballLiveOddsItem[]>>(endpoints.liveOdds, {
      query: fixtureId ? { fixture: fixtureId } : undefined,
    });
    return unwrap(envelope);
  }
}

export const apiFootballService = {
  buscarStatusProxy: ApiFootballService.buscarStatusProxy,
  buscarLigasAtuais: ApiFootballService.buscarLigasAtuais,
  buscarFixturesAoVivo: ApiFootballService.buscarFixturesAoVivo,
  buscarFixturesDaLiga: ApiFootballService.buscarFixturesDaLiga,
  buscarStandings: ApiFootballService.buscarStandings,
  buscarEstatisticasFixture: ApiFootballService.buscarEstatisticasFixture,
  buscarEventosFixture: ApiFootballService.buscarEventosFixture,
  buscarOddsFixture: ApiFootballService.buscarOddsFixture,
  buscarOddsAoVivo: ApiFootballService.buscarOddsAoVivo,
};
