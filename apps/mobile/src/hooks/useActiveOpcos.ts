// Charge le dataset OPCO actif (cache validé ou données embarquées)
// et expose des index prêts à l'emploi pour l'UI.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { indexBySlug, toOpcoList, type OpcoData } from '@opco/core';
import { getActiveOpcos, type ActiveDataset } from '@/lib/dataset-sync';

export interface ActiveOpcos {
  loading: boolean;
  opcos: OpcoData[];
  opcoList: { slug: string; name: string; secteurs: string }[];
  getOpcoBySlug: (slug: string) => OpcoData | undefined;
  source: ActiveDataset['source'];
  version: number;
  generatedAt: string;
  /** Recharge le dataset actif (après une sync réussie). */
  reload: () => Promise<void>;
}

export function useActiveOpcos(): ActiveOpcos {
  const [loading, setLoading] = useState(true);
  const [dataset, setDataset] = useState<ActiveDataset | null>(null);

  const load = useCallback(async () => {
    const active = await getActiveOpcos();
    setDataset(active);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const opcos = dataset?.opcos ?? [];

  const bySlug = useMemo(() => indexBySlug(opcos), [opcos]);
  const opcoList = useMemo(() => toOpcoList(opcos), [opcos]);

  const getOpcoBySlug = useCallback((slug: string) => bySlug[slug], [bySlug]);

  return {
    loading,
    opcos,
    opcoList,
    getOpcoBySlug,
    source: dataset?.source ?? 'embedded',
    version: dataset?.version ?? 1,
    generatedAt: dataset?.generatedAt ?? '',
    reload: load,
  };
}
