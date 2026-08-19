import { db } from '../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { RefereeProfile } from '../types';
import { VENUES, DEFAULT_VENUE } from '../core/venues';
import { WEATHER_CONFIG, FATIGUE_CONFIG } from '../core/constants';

export class MatchContextService {
    static getVenue(id: string) {
        return VENUES[id] || DEFAULT_VENUE;
    }

    static calculateTravelFatigue(homeId: string, awayId: string): number {
        const home = this.getVenue(homeId);
        const away = this.getVenue(awayId);
        
        // Haversine formula for distance
        const R = 6371; // km
        const dLat = (away.lat - home.lat) * Math.PI / 180;
        const dLon = (away.lon - home.lon) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(home.lat * Math.PI / 180) * Math.cos(away.lat * Math.PI / 180) * 
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const distance = R * c;

        // CONTINUOUS FATIGUE DECAY
        const fatigue = 1.0 - (FATIGUE_CONFIG.MAX_PENALTY / (1 + Math.exp(-(distance - FATIGUE_CONFIG.DISTANCE_THRESHOLD) / FATIGUE_CONFIG.DECAY_SCALE)));
        return Math.max(FATIGUE_CONFIG.FLOOR, Math.min(1.0, fatigue));
    }

    static async getWeather(lat: number, lon: number) {
        try {
            const url = `${WEATHER_CONFIG.BASE_URL}?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code`;
            const res = await fetch(url);
            const data = await res.json();
            return { temperature: data.current.temperature_2m, condition: WEATHER_CONFIG.DEFAULT_CONDITION };
        } catch {
            return { temperature: WEATHER_CONFIG.DEFAULT_TEMP, condition: WEATHER_CONFIG.DEFAULT_CONDITION };
        }
    }

    static async saveReferee(profile: RefereeProfile) {
        await setDoc(doc(db, 'referee_profiles', profile.name.toUpperCase()), profile, { merge: true });
    }
}
