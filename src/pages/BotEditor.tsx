import { BotForm } from '../components/BotForm';
import { PageHeader } from '../components/PageHeader';
import { Bot } from '../types';

type BotEditorProps = {
  bot?: Bot;
  defaultStake: number;
  onSave: (bot: Bot) => void;
};

export function BotEditor({ bot, defaultStake, onSave }: BotEditorProps) {
  return (
    <>
      <PageHeader
        title={bot ? 'Editar Bot' : 'Novo Bot'}
        description="Crie métodos de trade esportivo para simulação, replay e backtest usando apenas dados locais."
      />
      <BotForm initialBot={bot} defaultStake={defaultStake} onSave={onSave} />
    </>
  );
}
