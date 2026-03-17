import { useState, useEffect, useRef } from 'react';
import { getCampaign } from '../services/campaignClient';
import type { Campaign } from '../types/campaign';

export function useCampaign(id: string | null) {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await getCampaign(id);
      setCampaign(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [id]);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (campaign?.status === 'sending') {
      intervalRef.current = setInterval(load, 30_000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [campaign?.status]);

  return { campaign, loading, error, refresh: load };
}
