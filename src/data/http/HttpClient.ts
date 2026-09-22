import axios, { AxiosInstance, AxiosError } from 'axios';
import { DataSource, QuotaExceededError } from '../types';

interface QuotaConfig {
  dailyLimit: number;
  consumed: number;
  resetDate: string;
}

export class HttpClient {
  private static quotas: Map<DataSource, QuotaConfig> = new Map();
  private static instance: AxiosInstance = axios.create({
    timeout: 10000
  });

  static async fetchWithRetry<T>(
    source: DataSource,
    url: string,
    config: any = {},
    retries = 3
  ): Promise<T> {
    this.checkQuota(source);

    try {
      const response = await this.instance.get(url, config);
      this.incrementQuota(source);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        
        // Handle Rate Limiting (429)
        if (axiosError.response?.status === 429 && retries > 0) {
          const retryAfter = parseInt(axiosError.response.headers['retry-after'] || '1') * 1000;
          await new Promise(resolve => setTimeout(resolve, retryAfter + Math.random() * 500));
          return this.fetchWithRetry(source, url, config, retries - 1);
        }

        // Handle other retriable errors
        if (axiosError.response?.status && axiosError.response.status >= 500 && retries > 0) {
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, 3 - retries)));
          return this.fetchWithRetry(source, url, config, retries - 1);
        }
      }
      throw error;
    }
  }

  private static checkQuota(source: DataSource) {
    const today = new Date().toISOString().split('T')[0];
    let quota = this.quotas.get(source);

    if (!quota || quota.resetDate !== today) {
      quota = { dailyLimit: this.getDefaultLimit(source), consumed: 0, resetDate: today };
      this.quotas.set(source, quota);
    }

    if (quota.consumed >= quota.dailyLimit) {
      throw new QuotaExceededError(source);
    }
  }

  private static incrementQuota(source: DataSource) {
    const quota = this.quotas.get(source);
    if (quota) {
      quota.consumed++;
    }
  }

  private static getDefaultLimit(source: DataSource): number {
    const limits: Record<string, number> = {
      'api-football': 100,
      'the-odds-api': 50,
      'understat': 200
    };
    return limits[source] || 100;
  }
}
