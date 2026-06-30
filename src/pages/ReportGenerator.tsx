import { useMemo, useState } from 'react';
import { Wand2 } from 'lucide-react';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { PageHeader } from '../components/PageHeader';
import { AUTONOMOUS_MARKET_OPTIONS } from '../services/autonomousReportGenerator';

type ReportGeneratorProps = {
  activeReports: number;
  maxReports: number;
  onGenerate: (marketValue: string, quantity: number) => void;
};

const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

export function ReportGenerator({ activeReports, maxReports, onGenerate }: ReportGeneratorProps) {
  const [query, setQuery] = useState('');
  const [marketValue, setMarketValue] = useState(AUTONOMOUS_MARKET_OPTIONS[0]?.value ?? '');
  const [quantity, setQuantity] = useState(5);
  const remaining = Math.max(0, maxReports - activeReports);

  const filteredMarkets = useMemo(() => {
    const normalizedQuery = normalize(query.trim());
    if (!normalizedQuery) return AUTONOMOUS_MARKET_OPTIONS;

    return AUTONOMOUS_MARKET_OPTIONS.filter((market) => {
      const haystack = normalize([market.label, market.value, ...market.keywords].join(' '));
      return haystack.includes(normalizedQuery);
    });
  }, [query]);

  const selectedMarket = AUTONOMOUS_MARKET_OPTIONS.find((market) => market.value === marketValue);
  const safeQuantity = Math.max(1, Math.min(quantity, remaining || 1, maxReports));

  return (
    <>
      <PageHeader
        title="Gerador de Relatorios"
        description="Gere chamados de backtest automaticamente a partir de um mercado, com variacoes de odds, tempo, placar e parametros historicos."
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,.7fr)]">
        <Card title="Configurar geracao" subtitle="Escolha o mercado alvo e quantos relatorios deseja criar agora.">
          <div className="space-y-5">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-300">Pesquisar mercado</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Ex: over 2.5, favorito, ambas, under HT"
                className="min-h-11 w-full rounded-md border border-white/10 bg-ink-950 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-300">Mercado</span>
              <select
                value={marketValue}
                onChange={(event) => setMarketValue(event.target.value)}
                className="min-h-11 w-full rounded-md border border-white/10 bg-ink-950 px-3 py-2 text-sm text-white outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
              >
                {filteredMarkets.map((market) => (
                  <option key={market.value} value={market.value}>
                    {market.label}
                  </option>
                ))}
              </select>
              {filteredMarkets.length === 0 && <p className="mt-2 text-sm text-amber-300">Nenhum mercado encontrado com essa busca.</p>}
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-300">Quantidade de relatorios</span>
              <input
                type="number"
                min={1}
                max={Math.max(1, remaining)}
                value={quantity}
                onChange={(event) => setQuantity(Number(event.target.value))}
                className="min-h-11 w-full rounded-md border border-white/10 bg-ink-950 px-3 py-2 text-sm text-white outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
              />
              <p className="mt-2 text-xs text-slate-500">Limite atual: {activeReports} em andamento de {maxReports}. Disponiveis agora: {remaining}.</p>
            </label>

            <Button
              type="button"
              disabled={!selectedMarket || remaining <= 0}
              icon={<Wand2 className="h-4 w-4" />}
              onClick={() => onGenerate(marketValue, safeQuantity)}
            >
              Gerar
            </Button>
          </div>
        </Card>

        <Card title="Como os parametros sao escolhidos">
          <div className="space-y-3 text-sm text-slate-400">
            <p>O gerador cria variacoes ineditas para o mercado escolhido e envia todos os chamados para a aba Backtest.</p>
            <p>As regras podem variar entre odd minima/maxima, minuto de entrada, placar, desempenho historico, media de gols marcados fora, media de gols totais e forma recente.</p>
            <p>Relatorios gerados aqui nao criam bots na aba Bots. Eles ficam salvos como chamados independentes.</p>
          </div>
        </Card>
      </div>
    </>
  );
}
