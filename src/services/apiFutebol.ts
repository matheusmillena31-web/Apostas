import { apiClient } from '../api/client';
import { ApiFutebolAoVivoResponse, ApiFutebolPartidaAoVivo } from '../types/api';

const endpoints = {
  aoVivo: '/ao-vivo',
};

export class ApiFutebolService {
  static async buscarPartidasAoVivo(): Promise<ApiFutebolAoVivoResponse> {
    return apiClient<ApiFutebolAoVivoResponse>(endpoints.aoVivo);
  }

  static async buscarPartidaAoVivoPorId(partidaId: number): Promise<ApiFutebolPartidaAoVivo | undefined> {
    const partidas = await ApiFutebolService.buscarPartidasAoVivo();
    return partidas.find((partida) => partida.partida_id === partidaId);
  }
}

export const apiFutebolService = {
  buscarPartidasAoVivo: ApiFutebolService.buscarPartidasAoVivo,
  buscarPartidaAoVivoPorId: ApiFutebolService.buscarPartidaAoVivoPorId,
};
