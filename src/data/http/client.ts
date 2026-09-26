import axios, { AxiosInstance, AxiosError } from 'axios';
import { DataSource, QuotaExceededError } from '../../types';

interface QuotaConfig {
  dailyLimit: number;
  consumed: number;
  resetDate: string;
}

const quotas = new Map<DataSource, QuotaConfig>();
const instance: AxiosInstance = axios.create({ timeout: 10000 });

function getDefaultLimit(source: DataSource): number {
  const limits: Record<string, number> = {
    'api-football': 100,
    'the-odds-api': 50
  };
  return limits[source] || 100;
}

function checkQuota(source: DataSource) {
  const today = new Date().toISOString().split('T')[0];
  let quota = quotas.get(source);

  if (!quota || quota.resetDate !== today) {
    quota = { dailyLimit: getDefaultLimit(source), consumed: 0, resetDate: today };
    quotas.set(source, quota);
  }

  if (quota.consumed >= quota.dailyLimit) {
    throw new QuotaExceededError(source);
  }
}

function incrementQuota(source: DataSource) {
  const quota = quotas.get(source);
  if (quota) quota.consumed++;
}

export async function fetchWithRetry<T>(
  source: DataSource,
  url: string,
  config: any = {},
  retries = 3
): Promise<T> {
  checkQuota(source);

  try {
    const response = await instance.get(url, config);
    incrementQuota(source);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      if (axiosError.response?.status === 429 && retries > 0) {
        const retryAfter = parseInt(axiosError.response.headers['retry-after'] || '1') * 1000;
        await new Promise(resolve => setTimeout(resolve, retryAfter + Math.random() * 500));
        return fetchWithRetry(source, url, config, retries - 1);
      }
      if (axiosError.response?.status && axiosError.response.status >= 500 && retries > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, 3 - retries)));
        return fetchWithRetry(source, url, config, retries - 1);
      }
    }
    throw error;
  }
}
