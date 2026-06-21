export interface ApiFutebolCampeonato {
  campeonato_id: number;
  nome: string;
  slug: string;
}

export interface ApiFutebolTime {
  time_id: number;
  nome_popular: string;
  sigla: string;
  escudo: string;
}

export interface ApiFutebolEstadio {
  estadio_id: number;
  nome_popular: string;
}

export interface ApiFutebolPartidaAoVivo {
  partida_id: number;
  campeonato: ApiFutebolCampeonato;
  placar: string;
  time_mandante: ApiFutebolTime;
  time_visitante: ApiFutebolTime;
  placar_mandante: number;
  placar_visitante: number;
  disputa_penalti: boolean;
  status: 'andamento';
  slug: string;
  data_realizacao: string;
  hora_realizacao: string;
  data_realizacao_iso: string;
  estadio: ApiFutebolEstadio;
  _link: string;
}

export type ApiFutebolAoVivoResponse = ApiFutebolPartidaAoVivo[];
