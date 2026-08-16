export async function fetchWithTimeout(resource: string, options: any = {}, timeout = 10000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(resource, { ...options, signal: controller.signal });
        clearTimeout(id);
        return response;
    } catch (error) {
        clearTimeout(id);
        throw error;
    }
}

export class Cache {
    static set(key: string, data: any, ttl: number) {
        const entry = { data, expiry: Date.now() + ttl };
        localStorage.setItem(`cache_${key}`, JSON.stringify(entry));
    }

    static get(key: string) {
        const raw = localStorage.getItem(`cache_${key}`);
        if (!raw) return null;
        const entry = JSON.parse(raw);
        if (Date.now() > entry.expiry) {
            localStorage.removeItem(`cache_${key}`);
            return null;
        }
        return entry.data;
    }
}

export async function retry<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
    try {
        return await fn();
    } catch (error) {
        if (retries === 0) throw error;
        await new Promise(r => setTimeout(r, delay));
        return retry(fn, retries - 1, delay * 2);
    }
}
