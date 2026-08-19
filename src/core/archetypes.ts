
export const ELITE_TEAMS = ["MAN_CITY", "LIVERPOOL", "ARSENAL", "REAL_MADRID", "BARCELONA", "BAYERN_MUNICH"];
export const STRONG_TEAMS = ["CHELSEA", "TOTTENHAM", "MAN_UTD", "ATLETICO_MADRID", "B_DORTMUND", "INTER_MILAN", "AC_MILAN", "PSG", "LEVERKUSEN", "ASTON_VILLA"];

export const ARCHETYPE_STATS = {
    ELITE: {
        npxG: 2.15,
        avgXGA: 0.85,
        defensiveStability: 0.85,
        cleanSheets: 0.4,
        clinicalEdge: 0.15
    },
    STRONG: {
        npxG: 1.75,
        avgXGA: 1.15,
        defensiveStability: 0.75,
        cleanSheets: 0.25,
        clinicalEdge: 0.10
    },
    STANDARD: {
        npxG: 1.35,
        avgXGA: 1.45,
        defensiveStability: 0.6,
        cleanSheets: 0.15,
        clinicalEdge: 0.05
    }
};
