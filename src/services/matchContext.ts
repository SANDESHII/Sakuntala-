import { db } from '../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { RefereeProfile } from '../types';

export class MatchContextService {
    static getVenue(id: string) {
        const venues: any = {
            'MAN_CITY': { lat: 53.48, lon: -2.20, city: 'Manchester' },
            'MAN_UTD': { lat: 53.46, lon: -2.29, city: 'Manchester' },
            'LIVERPOOL': { lat: 53.43, lon: -2.96, city: 'Liverpool' },
            'ARSENAL': { lat: 51.55, lon: -0.10, city: 'London' },
            'CHELSEA': { lat: 51.48, lon: -0.19, city: 'London' },
            'TOTTENHAM': { lat: 51.60, lon: -0.06, city: 'London' },
            'ASTON_VILLA': { lat: 52.50, lon: -1.88, city: 'Birmingham' },
            'NEWCASTLE': { lat: 54.97, lon: -1.62, city: 'Newcastle' }
        };
        return venues[id] || { lat: 51.50, lon: -0.12, city: 'London' };
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

        // Return a penalty factor (1.0 = no fatigue, 0.95 = high fatigue for long distance)
        if (distance > 400) return 0.96; // Long haul (e.g. London to Newcastle)
        if (distance > 200) return 0.98; // Mid range
        return 1.0; // Local derby or short trip
    }

    static async getWeather(lat: number, lon: number) {
        try {
            const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code`);
            const data = await res.json();
            return { temperature: data.current.temperature_2m, condition: 'Stable' };
        } catch {
            return { temperature: 15, condition: 'Stable' };
        }
    }

    static async saveReferee(profile: RefereeProfile) {
        await setDoc(doc(db, 'referee_profiles', profile.name.toUpperCase()), profile, { merge: true });
    }
}
