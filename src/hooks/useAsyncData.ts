import { useEffect, useState, type DependencyList } from 'react';

export function useAsyncData<TData>(loader: () => Promise<TData>, dependencies: DependencyList) {
  const [data, setData] = useState<TData | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    let active = true;

    setLoading(true);
    setError(undefined);

    loader()
      .then((nextData) => {
        if (!active) return;
        setData(nextData);
      })
      .catch((nextError) => {
        if (!active) return;
        setError(nextError instanceof Error ? nextError.message : 'Nao foi possivel carregar os dados da API-FOOTBALL.');
        setData(undefined);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, dependencies);

  return { data, loading, error };
}
