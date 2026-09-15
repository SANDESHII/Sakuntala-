export async function fetchWithTimeout(url: string, options: any = {}, timeout = 10000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    
    const headers = { ...options.headers };
    const apiKey = (typeof process !== 'undefined' && process.env?.VITE_INTERNAL_API_KEY) || 
                   (typeof (import.meta as any).env !== 'undefined' ? (import.meta as any).env.VITE_INTERNAL_API_KEY : null);
    
    if (apiKey) headers['x-api-key'] = apiKey;
    
    try {
        const response = await fetch(url, { ...options, headers, signal: controller.signal });
        clearTimeout(id);
        return response;
    } catch (e) {
        clearTimeout(id);
        throw e;
    }
}

export async function retry<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
    try {
        return await fn();
    } catch (e) {
        if (retries === 0) throw e;
        await new Promise(resolve => setTimeout(resolve, delay));
        return retry(fn, retries - 1, delay * 2);
    }
}

export function sanitizeForFirestore(obj: any): any {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(sanitizeForFirestore);
    
    const sanitized: any = {};
    Object.keys(obj).forEach(key => {
        const val = obj[key];
        if (val !== undefined) {
            sanitized[key] = sanitizeForFirestore(val);
        }
    });
    return sanitized;
}
