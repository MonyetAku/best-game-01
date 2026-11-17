// Every tuning number and colour in one place. The playfield is a fixed
// 1280x720 logical area; the renderer scales it to the window, so no rule
// below depends on the screen size.
export const FIELD = { width: 1280, height: 720, groundY: 664 };

/** The simulation's fixed step, in seconds: 60 updates a second. */
export const STEP = 1 / 60;

export const PLAYER = {
  width: 64,
  height: 72,
  speed: 560,
  jumpVelocity: 980,
  gravity: 2600,
  dashSpeed: 1150,
  dashTime: 0.16,
  dashCooldown: 1.1,
  invulnerable: 1.5,
};

export const LIVES = 3;

/** Reach this score to win the Golden Mango crown, then keep playing. */
export const WIN_SCORE = 400;

export const COCONUT = {
  minRadius: 16,
  maxRadius: 26,
  speed: 230,
  speedPerLevel: 22,
  speedJitter: 80,
  interval: 0.65,
  intervalScale: 0.93,
  minInterval: 0.18,
  dodgePoints: 1,
};

export const MANGO = {
  size: 26,
  speed: 180,
  speedPerLevel: 12,
  interval: 1.1,
  intervalJitter: 0.7,
  points: 10,
};

export const GOLDEN = {
  size: 30,
  points: 50,
  /** Seconds between golden mangoes. */
  interval: 11,
};

export const EAGLE = {
  width: 92,
  height: 34,
  speed: 460,
  speedPerLevel: 30,
  /** Eagles only appear from this level on. */
  firstLevel: 3,
  interval: 6.0,
  intervalJitter: 1.6,
};

export const LEAF = {
  size: 28,
  speed: 170,
  /** Seconds between shield leaves. */
  interval: 14,
};

/** Seconds of play per level, and the last level. */
export const LEVEL = { seconds: 18, max: 10 };

/** How many falling things can exist at once; the pool is allocated once. */
export const POOL_SIZE = 72;
/** Particle and floating-text pools, also allocated once. */
export const PARTICLE_POOL = 96;
export const FLOATER_POOL = 16;

export const PALETTE = {
  backdrop: '#12241a',
  skyTop: '#8fd3f4',
  skyBottom: '#e9f7c9',
  sun: '#ffd94d',
  farTrees: '#6db06a',
  nearTrees: '#2e7d46',
  ground: '#6b4a2f',
  groundTop: '#8a6a42',
  grass: '#4c8a3f',
  player: '#a05a1e',
  playerBelly: '#e8b06a',
  playerFace: '#f2c48d',
  coconut: '#7a3b1e',
  coconutDark: '#5d2c15',
  mango: '#ff9f1c',
  golden: '#ffd700',
  leaf: '#37b24d',
  eagle: '#3a2e2e',
  panel: '#20301f',
  text: '#f5f1e6',
  muted: '#c9d6b8',
  heart: '#ff5a5a',
  dash: '#7dd3fc',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'mango-rush.best';
