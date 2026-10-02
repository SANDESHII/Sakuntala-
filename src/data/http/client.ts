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

let lastRequestTime = 0;
const MIN_GAP = 750; // 750ms minimum gap between any two requests

export async function fetchWithRetry<T>(
  source: DataSource,
  url: string,
  config: any = {},
  retries = 3
): Promise<T> {
  checkQuota(source);

  const now = Date.now();
  const timeSinceLast = now - lastRequestTime;
  if (timeSinceLast < MIN_GAP) {
    await new Promise(resolve => setTimeout(resolve, MIN_GAP - timeSinceLast));
  }
  lastRequestTime = Date.now();

  try {
    const response = await instance.get(url, config);
    incrementQuota(source);
    
    // API-Sports specific error handling (they sometimes return 200 with error body)
    if (response.data?.errors && Object.keys(response.data.errors).length > 0) {
      const errorMsg = JSON.stringify(response.data.errors);
      console.error(`[${source}] API Error: ${errorMsg}`);
      
      if (errorMsg.includes('token') || errorMsg.includes('subscription')) {
        throw new Error(`API Auth Error: ${errorMsg}`);
      }
    }

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      const responseData = axiosError.response?.data as any;
      
      if (axiosError.response?.status === 401) {
        console.error(`[${source}] 401 Unauthorized: Invalid API Key.`);
        throw new Error(`Invalid API Key for ${source}. Please check your environment variables.`);
      }

      if (axiosError.response?.status === 403) {
        const detail = responseData?.message || responseData?.errors || 'Access Forbidden';
        const host = axiosError.config?.url ? new URL(axiosError.config.url).host : 'unknown';
        console.error(`[${source}] 403 Forbidden on ${host}: ${JSON.stringify(detail)}`);
        throw new Error(`Access Forbidden (403) on ${host}: ${JSON.stringify(detail)}. Check your API key and subscription tier.`);
      }

      if (axiosError.response?.status === 429 && retries > 0) {
        // Drastic backoff for 429
        const retryAfter = parseInt(axiosError.response.headers['retry-after'] || '5') * 1000;
        const delay = Math.max(5000, retryAfter); 
        console.warn(`[${source}] 429 Rate Limited. Cooling down for ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay + Math.random() * 1000));
        return fetchWithRetry(source, url, config, retries - 1);
      }
      if (axiosError.response?.status && axiosError.response.status >= 500 && retries > 0) {
        await new Promise(resolve => setTimeout(resolve, 2000 * Math.pow(2, 3 - retries)));
        return fetchWithRetry(source, url, config, retries - 1);
      }
    }
    throw error;
  }
}
