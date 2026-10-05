import { DataSource } from '../../types';

const quotas = new Map<string, { consumed: number; resetDate: string }>();

function checkQuota(source: DataSource) {
  const today = new Date().toISOString().split('T')[0];
  let q = quotas.get(source) || { consumed: 0, resetDate: today };
  if (q.resetDate !== today) q = { consumed: 0, resetDate: today };
  if (q.consumed >= (source === 'the-odds-api' ? 50 : 100)) throw new Error(`[Network] Quota exceeded for ${source}`);
  quotas.set(source, q);
}

export async function fetchWithRetry<T>(source: DataSource, url: string, config: any = {}, retries = 3): Promise<T> {
  checkQuota(source);
  try {
    const res = await fetch(url, { ...config, signal: AbortSignal.timeout(10000) });
    if (res.status === 429 || (res.status >= 500)) {
      if (retries > 0) {
        await new Promise(r => setTimeout(r, res.status === 429 ? 5000 : 2000));
        return fetchWithRetry(source, url, config, retries - 1);
      }
    }
    if (!res.ok) throw new Error(`[Network] HTTP ${res.status}`);
    const data = await res.json();
    const q = quotas.get(source)!;
    q.consumed++;
    return data;
  } catch (e: any) {
    if (retries > 0 && e.name === 'TimeoutError') return fetchWithRetry(source, url, config, retries - 1);
    throw e;
  }
}
