import { useState } from 'react';
import { Download, Trash2, Upload } from 'lucide-react';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Field, Input, Textarea } from '../components/FormControls';
import { PageHeader } from '../components/PageHeader';
import { AppSettings } from '../types';

type SettingsPageProps = {
  settings: AppSettings;
  exportJson: string;
  onSave: (settings: AppSettings) => void;
  onImport: (json: string) => void;
  onClear: () => void;
};

export function SettingsPage({ settings, exportJson, onSave, onImport, onClear }: SettingsPageProps) {
  const [bankroll, setBankroll] = useState(settings.bankroll);
  const [defaultStake, setDefaultStake] = useState(settings.defaultStake);
  const [simulationDelay, setSimulationDelay] = useState(settings.simulationDelay);
  const [importValue, setImportValue] = useState('');

  return (
    <>
      <PageHeader
        title="Configurações"
        description="Controle a banca simulada, parâmetros locais e importação/exportação dos dados do navegador."
      />
      <div className="grid gap-5 xl:grid-cols-2">
        <Card title="Simulação">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Banca simulada">
              <Input type="number" value={bankroll} onChange={(event) => setBankroll(Number(event.target.value))} />
            </Field>
            <Field label="Stake padrão">
              <Input type="number" value={defaultStake} onChange={(event) => setDefaultStake(Number(event.target.value))} />
            </Field>
            <Field label="Moeda">
              <Input value="BRL" readOnly />
            </Field>
            <Field label="Delay da simulação (ms)">
              <Input type="number" value={simulationDelay} onChange={(event) => setSimulationDelay(Number(event.target.value))} />
            </Field>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button onClick={() => onSave({ bankroll, defaultStake, currency: 'BRL', simulationDelay })}>Salvar configurações</Button>
            <Button variant="danger" onClick={onClear} icon={<Trash2 className="h-4 w-4" />}>Limpar dados locais</Button>
          </div>
        </Card>

        <Card title="Importar e exportar JSON">
          <Field label="Exportar">
            <Textarea readOnly value={exportJson} className="min-h-40" />
          </Field>
          <div className="mt-3 flex justify-end">
            <Button variant="secondary" icon={<Download className="h-4 w-4" />} onClick={() => navigator.clipboard?.writeText(exportJson)}>
              Copiar JSON
            </Button>
          </div>
          <div className="mt-5">
            <Field label="Importar">
              <Textarea value={importValue} onChange={(event) => setImportValue(event.target.value)} placeholder="Cole aqui o JSON exportado" />
            </Field>
          </div>
          <div className="mt-3 flex justify-end">
            <Button variant="secondary" icon={<Upload className="h-4 w-4" />} onClick={() => onImport(importValue)}>
              Importar JSON
            </Button>
          </div>
        </Card>
      </div>
    </>
  );
}
