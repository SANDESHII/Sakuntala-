import { db } from '../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { RefereeProfile } from '../types';
import { VENUES, DEFAULT_VENUE } from '../core/venues';
import { WEATHER_CONFIG, FATIGUE_CONFIG } from '../core/constants';

export class MatchContextService {
    static getVenue(id: string) { return VENUES[id] || DEFAULT_VENUE; }
    static calculateTravelFatigue(hId: string, aId: string): number {
        const h = this.getVenue(hId), a = this.getVenue(aId), R = 6371, p = Math.PI/180;
        const dLa = (a.lat - h.lat)*p, dLo = (a.lon - h.lon)*p;
        const x = Math.sin(dLa/2)**2 + Math.cos(h.lat*p)*Math.cos(a.lat*p)*Math.sin(dLo/2)**2;
        const d = R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1-x));
        return Math.max(FATIGUE_CONFIG.FLOOR, Math.min(1.0, 1 - (FATIGUE_CONFIG.MAX_PENALTY / (1 + Math.exp(-(d - FATIGUE_CONFIG.DISTANCE_THRESHOLD) / FATIGUE_CONFIG.DECAY_SCALE)))));
    }
    static async getWeather(lat: number, lon: number) {
        try {
            const r = await fetch(`${WEATHER_CONFIG.BASE_URL}?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code`), d = await r.json();
            return { temperature: d.current.temperature_2m, condition: WEATHER_CONFIG.DEFAULT_CONDITION };
        } catch { return { temperature: WEATHER_CONFIG.DEFAULT_TEMP, condition: WEATHER_CONFIG.DEFAULT_CONDITION }; }
    }
    static async saveReferee(p: RefereeProfile) { await setDoc(doc(db, 'referee_profiles', p.name.toUpperCase()), p, { merge: true }); }
}
