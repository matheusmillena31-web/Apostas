import type { FormEvent } from 'react';
import { Bot } from '../types';
import { uid } from '../utils/formatters';
import { Button } from './Button';
import { Card } from './Card';
import { Field, Input, Select, Textarea } from './FormControls';

type BotFormProps = {
  initialBot?: Bot;
  defaultStake: number;
  onSave: (bot: Bot) => void;
};

const numberValue = (value: FormDataEntryValue | null, fallback = 0) => Number(value ?? fallback);
const stringValue = (value: FormDataEntryValue | null) => String(value ?? '');

export function createDefaultBot(defaultStake: number): Bot {
  const now = new Date().toISOString();

  return {
    id: uid('bot'),
    name: '',
    description: '',
    isActive: true,
    mode: 'ao-vivo',
    sport: 'Futebol',
    market: 'Over 2.5',
    side: 'BACK',
    minOdd: 1.4,
    maxOdd: 3,
    targetOdd: 2,
    entryMinute: 15,
    limitMinute: 75,
    exitMinute: 90,
    stake: defaultStake,
    scoreFilter: '',
    leagues: '',
    teams: '',
    liveRules: {
      minShots: 6,
      minShotsOnTarget: 2,
      minDangerousAttacks: 24,
      minCorners: 3,
      minPossession: 45,
      maxCards: 5,
      minOffensivePressure: 42,
      minRecentShots: 1,
      score: '',
      currentOddMin: 1.4,
      currentOddMax: 3,
    },
    preLiveRules: {
      minPreLiveOdd: 1.35,
      maxPreLiveOdd: 3.2,
      leagues: '',
      teams: '',
      minAverageGoals: 2,
      minAverageCorners: 7,
      minH2HGoals: 1.8,
      maxTablePositionGap: 12,
      minFavoritism: 50,
    },
    createdAt: now,
    updatedAt: now,
  };
}

export function BotForm({ initialBot, defaultStake, onSave }: BotFormProps) {
  const bot = initialBot ?? createDefaultBot(defaultStake);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const now = new Date().toISOString();

    onSave({
      ...bot,
      name: stringValue(form.get('name')).trim() || 'Método sem nome',
      description: stringValue(form.get('description')),
      isActive: form.get('isActive') === 'on',
      mode: stringValue(form.get('mode')) as Bot['mode'],
      sport: 'Futebol',
      market: stringValue(form.get('market')),
      side: stringValue(form.get('side')) as Bot['side'],
      minOdd: numberValue(form.get('minOdd')),
      maxOdd: numberValue(form.get('maxOdd')),
      targetOdd: numberValue(form.get('targetOdd')),
      entryMinute: numberValue(form.get('entryMinute')),
      limitMinute: numberValue(form.get('limitMinute')),
      exitMinute: numberValue(form.get('exitMinute')),
      stake: numberValue(form.get('stake'), defaultStake),
      scoreFilter: stringValue(form.get('scoreFilter')),
      leagues: stringValue(form.get('leagues')),
      teams: stringValue(form.get('teams')),
      liveRules: {
        minShots: numberValue(form.get('minShots')),
        minShotsOnTarget: numberValue(form.get('minShotsOnTarget')),
        minDangerousAttacks: numberValue(form.get('minDangerousAttacks')),
        minCorners: numberValue(form.get('minCorners')),
        minPossession: numberValue(form.get('minPossession')),
        maxCards: numberValue(form.get('maxCards')),
        minOffensivePressure: numberValue(form.get('minOffensivePressure')),
        minRecentShots: numberValue(form.get('minRecentShots')),
        score: stringValue(form.get('liveScore')),
        currentOddMin: numberValue(form.get('currentOddMin')),
        currentOddMax: numberValue(form.get('currentOddMax')),
      },
      preLiveRules: {
        minPreLiveOdd: numberValue(form.get('minPreLiveOdd')),
        maxPreLiveOdd: numberValue(form.get('maxPreLiveOdd')),
        leagues: stringValue(form.get('preLiveLeagues')),
        teams: stringValue(form.get('preLiveTeams')),
        minAverageGoals: numberValue(form.get('minAverageGoals')),
        minAverageCorners: numberValue(form.get('minAverageCorners')),
        minH2HGoals: numberValue(form.get('minH2HGoals')),
        maxTablePositionGap: numberValue(form.get('maxTablePositionGap')),
        minFavoritism: numberValue(form.get('minFavoritism')),
      },
      updatedAt: now,
      createdAt: bot.createdAt || now,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Card title="Identidade do método" subtitle="Defina nome, modo e mercado principal.">
        <div className="grid gap-4 lg:grid-cols-3">
          <Field label="Nome">
            <Input name="name" defaultValue={bot.name} placeholder="Ex: Over pressão 65+" required />
          </Field>
          <Field label="Status">
            <div className="flex min-h-10 items-center gap-3 rounded-md border border-white/10 bg-ink-900 px-3">
              <input name="isActive" type="checkbox" defaultChecked={bot.isActive} className="h-4 w-4 accent-electric-500" />
              <span className="text-sm text-slate-300">Ativo para simulações</span>
            </div>
          </Field>
          <Field label="Modo">
            <Select name="mode" defaultValue={bot.mode}>
              <option value="ao-vivo">Ao vivo</option>
              <option value="pre-live">Pré-live</option>
            </Select>
          </Field>
          <Field label="Esporte">
            <Input value="Futebol" readOnly />
          </Field>
          <Field label="Mercado">
            <Select name="market" defaultValue={bot.market}>
              <option>Over 1.5</option>
              <option>Over 2.5</option>
              <option>Under 2.5</option>
              <option>Ambas Marcam</option>
              <option>Match Odds</option>
              <option>Empate</option>
            </Select>
          </Field>
          <Field label="BACK ou LAY">
            <Select name="side" defaultValue={bot.side}>
              <option>BACK</option>
              <option>LAY</option>
            </Select>
          </Field>
          <div className="lg:col-span-3">
            <Field label="Descrição">
              <Textarea name="description" defaultValue={bot.description} placeholder="Resumo do racional do método" />
            </Field>
          </div>
        </div>
      </Card>

      <Card title="Entrada e gestão" subtitle="Configure odds, minutos e stake simulada.">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Field label="Odd mínima">
            <Input name="minOdd" type="number" step="0.01" defaultValue={bot.minOdd} />
          </Field>
          <Field label="Odd máxima">
            <Input name="maxOdd" type="number" step="0.01" defaultValue={bot.maxOdd} />
          </Field>
          <Field label="Odd alvo">
            <Input name="targetOdd" type="number" step="0.01" defaultValue={bot.targetOdd} />
          </Field>
          <Field label="Stake">
            <Input name="stake" type="number" step="0.01" defaultValue={bot.stake} />
          </Field>
          <Field label="Placar">
            <Input name="scoreFilter" defaultValue={bot.scoreFilter} placeholder="Ex: 0-0" />
          </Field>
          <Field label="Minuto de entrada">
            <Input name="entryMinute" type="number" defaultValue={bot.entryMinute} />
          </Field>
          <Field label="Minuto limite">
            <Input name="limitMinute" type="number" defaultValue={bot.limitMinute} />
          </Field>
          <Field label="Minuto de saída">
            <Input name="exitMinute" type="number" defaultValue={bot.exitMinute} />
          </Field>
          <Field label="Ligas">
            <Input name="leagues" defaultValue={bot.leagues} placeholder="Brasileirao, Premier League" />
          </Field>
          <Field label="Times">
            <Input name="teams" defaultValue={bot.teams} placeholder="Flamengo, Arsenal" />
          </Field>
        </div>
      </Card>

      <Card title="Regras ao vivo" subtitle="Estatísticas verificadas minuto a minuto no replay ou backtest.">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Field label="Finalizações">
            <Input name="minShots" type="number" defaultValue={bot.liveRules.minShots} />
          </Field>
          <Field label="No alvo">
            <Input name="minShotsOnTarget" type="number" defaultValue={bot.liveRules.minShotsOnTarget} />
          </Field>
          <Field label="Ataques perigosos">
            <Input name="minDangerousAttacks" type="number" defaultValue={bot.liveRules.minDangerousAttacks} />
          </Field>
          <Field label="Escanteios">
            <Input name="minCorners" type="number" defaultValue={bot.liveRules.minCorners} />
          </Field>
          <Field label="Posse %">
            <Input name="minPossession" type="number" defaultValue={bot.liveRules.minPossession} />
          </Field>
          <Field label="Máx. cartões">
            <Input name="maxCards" type="number" defaultValue={bot.liveRules.maxCards} />
          </Field>
          <Field label="Pressão ofensiva">
            <Input name="minOffensivePressure" type="number" defaultValue={bot.liveRules.minOffensivePressure} />
          </Field>
          <Field label="Chutes recentes">
            <Input name="minRecentShots" type="number" defaultValue={bot.liveRules.minRecentShots} />
          </Field>
          <Field label="Placar ao vivo">
            <Input name="liveScore" defaultValue={bot.liveRules.score} placeholder="Ex: 1-0" />
          </Field>
          <Field label="Odd atual">
            <div className="grid grid-cols-2 gap-2">
              <Input name="currentOddMin" type="number" step="0.01" defaultValue={bot.liveRules.currentOddMin} />
              <Input name="currentOddMax" type="number" step="0.01" defaultValue={bot.liveRules.currentOddMax} />
            </div>
          </Field>
        </div>
      </Card>

      <Card title="Regras pré-live" subtitle="Filtros para leitura antes da partida.">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Field label="Odd pré-live">
            <div className="grid grid-cols-2 gap-2">
              <Input name="minPreLiveOdd" type="number" step="0.01" defaultValue={bot.preLiveRules.minPreLiveOdd} />
              <Input name="maxPreLiveOdd" type="number" step="0.01" defaultValue={bot.preLiveRules.maxPreLiveOdd} />
            </div>
          </Field>
          <Field label="Liga">
            <Input name="preLiveLeagues" defaultValue={bot.preLiveRules.leagues} />
          </Field>
          <Field label="Times">
            <Input name="preLiveTeams" defaultValue={bot.preLiveRules.teams} />
          </Field>
          <Field label="Média de gols">
            <Input name="minAverageGoals" type="number" step="0.1" defaultValue={bot.preLiveRules.minAverageGoals} />
          </Field>
          <Field label="Média escanteios">
            <Input name="minAverageCorners" type="number" step="0.1" defaultValue={bot.preLiveRules.minAverageCorners} />
          </Field>
          <Field label="H2H gols">
            <Input name="minH2HGoals" type="number" step="0.1" defaultValue={bot.preLiveRules.minH2HGoals} />
          </Field>
          <Field label="Posição na tabela">
            <Input name="maxTablePositionGap" type="number" defaultValue={bot.preLiveRules.maxTablePositionGap} />
          </Field>
          <Field label="Favoritismo %">
            <Input name="minFavoritism" type="number" defaultValue={bot.preLiveRules.minFavoritism} />
          </Field>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button type="submit">{initialBot ? 'Salvar alterações' : 'Criar bot'}</Button>
      </div>
    </form>
  );
}
