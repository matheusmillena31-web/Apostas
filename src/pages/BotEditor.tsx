import { BotForm } from '../components/BotForm';
import { PageHeader } from '../components/PageHeader';
import { Bot } from '../types';

type BotEditorProps = {
  bot?: Bot;
  defaultStake: number;
  onSave: (bot: Bot) => void;
  onGenerateReport: (bot: Bot) => void;
  onGenerateAutonomousReports: (bot: Bot) => void;
};

export function BotEditor({ bot, defaultStake, onSave, onGenerateReport, onGenerateAutonomousReports }: BotEditorProps) {
  return (
    <>
      <PageHeader
        title={bot ? 'Editar Bot' : 'Criar Bot'}
        description="Crie métodos de trade esportivo para simulação, replay e backtest usando regras dinâmicas."
      />
      <BotForm
        initialBot={bot}
        defaultStake={defaultStake}
        onSave={onSave}
        onGenerateReport={onGenerateReport}
        onGenerateAutonomousReports={onGenerateAutonomousReports}
      />
    </>
  );
}
