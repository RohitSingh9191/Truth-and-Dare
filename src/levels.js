// The five levels and five question types. Text for names and descriptions lives in strings.js.

export const LEVELS = [
  { key: 'kids', prefix: 'k', age: 'all', color: '#FFC233', ink: '#2b1d00' },
  { key: 'friends', prefix: 'f', age: '13+', color: '#2ED3C1', ink: '#002420' },
  { key: 'party', prefix: 'p', age: '16+', color: '#A98BFF', ink: '#1a0f3d' },
  { key: 'couples', prefix: 'c', age: '18+', color: '#FF6B9A', ink: '#3a0016', adult: true, heat: true },
  { key: 'spicy', prefix: 's', age: '18+', color: '#FF5A36', ink: '#2e0800', adult: true, heat: true, optIn: true },
];

export const LEVEL = Object.fromEntries(LEVELS.map((l) => [l.key, l]));

export const TYPES = ['truth', 'dare', 'would-you-rather', 'never-have-i-ever', 'most-likely-to'];
export const GROUP_TYPES = ['would-you-rather', 'never-have-i-ever', 'most-likely-to'];
export const HEATS = [1, 2, 3];

export const DEFAULT_LEVEL = 'friends';
export const FAMILY_LEVELS = ['kids', 'friends'];

/** Levels a player can choose right now. */
export function visibleLevels(settings) {
  return LEVELS.filter((l) => {
    if (settings.family) return FAMILY_LEVELS.includes(l.key);
    if (l.optIn) return settings.spicy;
    return true;
  });
}
