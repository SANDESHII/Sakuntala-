import { db } from '../lib/firebase-admin';
import { AnalysisResult } from '../types';
import { Timestamp } from "firebase-admin/firestore";

export class CacheService {
    private static COLLECTION = 'analysis_cache';
    private static TTL_MS = 60 * 60 * 1000; // 1 hour cache for persistent storage

    static async get(key: string): Promise<AnalysisResult | null> {
        try {
            const snap = await db.collection(this.COLLECTION).doc(key).get();
            
            if (snap.exists) {
                const data = snap.data();
                if (!data) return null;
                const timestamp = data.timestamp as Timestamp;
                
                // Check TTL
                if (Date.now() - timestamp.toMillis() < this.TTL_MS) {
                    return data.result as AnalysisResult;
                }
            }
            return null;
        } catch (error) {
            console.error('Cache Read Error:', error);
            return null;
        }
    }

    static async set(key: string, result: AnalysisResult): Promise<void> {
        try {
            await db.collection(this.COLLECTION).doc(key).set({
                result,
                timestamp: Timestamp.now()
            });
        } catch (error) {
            console.error('Cache Write Error:', error);
        }
    }
}
