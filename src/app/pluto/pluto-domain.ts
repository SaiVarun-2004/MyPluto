/* ==========================================================================
   Pluto domain model (Phase 5: growth)
   Pure TypeScript: no DOM, no Angular. Everything here is persistence-ready
   and can be mirrored 1:1 by a C# DTO later.
   ========================================================================== */

export type PlutoState =
  | 'idle'
  | 'swimming'
  | 'exploring'
  | 'resting'
  | 'curious'
  | 'feeding'
  | 'excited'
  | 'investigating'
  | 'playing'
  | 'sulking'
  | 'hiding';

export type PlutoMood =
  | 'calm'
  | 'curious'
  | 'playful'
  | 'sleepy'
  | 'attention-seeking'
  | 'annoyed'
  | 'sulking';
export type RelationshipStage = 'stranger' | 'familiar' | 'friend' | 'attached';
export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night';
export type FoodKind = 'flake' | 'pellet' | 'treat';
export type ObjectKind = 'shell' | 'pearl';
export type ToyKind = 'ball' | 'ring' | 'bubbles' | 'star';
export type Outfit = 'none' | 'bow' | 'shades' | 'party' | 'crown' | 'flower' | 'pearls';
/** Temperament traits that drift slowly with how you treat him. */
export type Trait = 'curious' | 'playful' | 'sleepy';

/* Phase 5 */
export type GrowthStage = 'baby' | 'young' | 'grown';
export type Decoration = 'kelp' | 'coral' | 'castle' | 'lantern';
export type Environment = 'tank' | 'shallows' | 'reef';

/* ---------- Interaction architecture ---------- */
export type PlutoEventType =
  | 'USER_PET'
  | 'USER_FEED'
  | 'USER_PLAY'
  | 'USER_HOVER'
  | 'USER_RETURNED'
  | 'USER_TOY'
  | 'FOOD_EATEN'
  | 'PLUTO_DISCOVERED'
  | 'PLUTO_RESTED'
  | 'TOY_PLAYED'
  | 'BUBBLE_POPPED'
  | 'RING_PASS'
  | 'HIDE_FOUND'
  | 'PLUTO_ANNOYED'
  | 'PLUTO_FORGAVE'
  | 'PLUTO_GREW';

export interface PlutoEvent {
  type: PlutoEventType;
  /** epoch ms */
  at: number;
  food?: FoodKind;
  favorite?: boolean;
  objectId?: string;
  toy?: ToyKind;
  by?: 'user' | 'pluto';
}

/* ---------- Memory ---------- */
export interface DiaryEntry {
  at: number;
  text: string;
}

export interface PlutoMemory {
  timesFed: number;
  timesPetted: number;
  timesPlayed: number;
  /** how many of each food he has actually eaten */
  foodCounts: Record<FoodKind, number>;
  favoriteFood?: FoodKind;
  firstSeen: number;
  lastInteraction: number;
  lastFed: number;
  visits: number;
  /** seconds the user spent close to him */
  totalPlayTime: number;

  /* Phase 4 */
  /** completed play sessions per toy */
  toyCounts: Record<ToyKind, number>;
  favoriteToy?: ToyKind;
  /** the toy he has claimed as "his" */
  namedToy?: ToyKind;
  toysGiven: number;
  bubblesPopped: number;
  ringPasses: number;
  hideWins: number;
  discoveries: number;
  timesAnnoyed: number;
  timesForgiven: number;
  /** when you tend to interact with him (for "favourite time") */
  todCounts: Record<TimeOfDay, number>;
  diary: DiaryEntry[];
  achievements: string[];
  unlocked: Outfit[];

  /* Phase 5 */
  growth: number; // 0..1, hidden
  growthDay: string;
  growthToday: number;
  growthStage: GrowthStage;
  decorations: Decoration[];
  environments: Environment[];
}

export function defaultMemory(): PlutoMemory {
  const now = Date.now();
  return {
    timesFed: 0,
    timesPetted: 0,
    timesPlayed: 0,
    foodCounts: { flake: 0, pellet: 0, treat: 0 },
    firstSeen: now,
    lastInteraction: now,
    lastFed: 0,
    visits: 0,
    totalPlayTime: 0,
    toyCounts: { ball: 0, ring: 0, bubbles: 0, star: 0 },
    toysGiven: 0,
    bubblesPopped: 0,
    ringPasses: 0,
    hideWins: 0,
    discoveries: 0,
    timesAnnoyed: 0,
    timesForgiven: 0,
    todCounts: { morning: 0, afternoon: 0, evening: 0, night: 0 },
    diary: [],
    achievements: [],
    unlocked: [],
    growth: 0,
    growthDay: '',
    growthToday: 0,
    growthStage: 'baby',
    decorations: [],
    environments: [],
  };
}

/* ---------- Relationship (hidden number, visible behaviour) ---------- */
export const STAGES: RelationshipStage[] = ['stranger', 'familiar', 'friend', 'attached'];

export function relationshipFor(bond: number): RelationshipStage {
  if (bond < 0.12) return 'stranger';
  if (bond < 0.35) return 'familiar';
  if (bond < 0.65) return 'friend';
  return 'attached';
}

/* ---------- Toys ---------- */
export interface ToySpec {
  label: string;
  /** what it's called once he claims it */
  own: string;
  emoji: string;
  w: number;
  h: number;
}

export const TOYS: Record<ToyKind, ToySpec> = {
  ball: { label: 'Blue ball', own: "Pluto's Blue Ball", emoji: '🔵', w: 30, h: 30 },
  ring: { label: 'Golden ring', own: "Pluto's Golden Ring", emoji: '⭕', w: 44, h: 120 },
  bubbles: { label: 'Bubble wand', own: "Pluto's Bubble Wand", emoji: '🫧', w: 30, h: 30 },
  star: { label: 'Lucky star', own: "Pluto's Lucky Star", emoji: '⭐', w: 34, h: 34 },
};
export const TOY_KINDS: ToyKind[] = ['ball', 'ring', 'bubbles', 'star'];
/** Completed sessions with one toy before he calls it "his". */
export const NAMED_AFTER = 8;

/* ---------- Wardrobe ---------- */
export const OUTFITS: Record<Outfit, { label: string; emoji: string }> = {
  none: { label: 'Nothing', emoji: '🐟' },
  bow: { label: 'Pink bow', emoji: '🎀' },
  shades: { label: 'Sunglasses', emoji: '🕶️' },
  party: { label: 'Party hat', emoji: '🥳' },
  crown: { label: 'Crown', emoji: '👑' },
  flower: { label: 'Flower', emoji: '🌸' },
  pearls: { label: 'Pearls', emoji: '📿' },
};
export const OUTFIT_KINDS: Outfit[] = ['none', 'bow', 'shades', 'party', 'crown', 'flower', 'pearls'];

/* ---------- Personality ---------- */
export interface Temperament {
  curious: number;
  playful: number;
  sleepy: number;
  /** hidden innate fondness for each toy, 0..1 */
  toyTaste: Record<ToyKind, number>;
}

export function newTemperament(): Temperament {
  const r = () => 0.3 + Math.random() * 0.45;
  const t = () => 0.2 + Math.random() * 0.8;
  return {
    curious: r(),
    playful: r(),
    sleepy: r(),
    toyTaste: { ball: t(), ring: t(), bubbles: t(), star: t() },
  };
}

/* ---------- Achievements ---------- */
export interface Achievement {
  id: string;
  title: string;
  desc: string;
  reward?: Outfit;
  test: (m: PlutoMemory, stageIdx: number) => boolean;
}

const sum = (o: Record<string, number>): number => Object.values(o).reduce((a, b) => a + b, 0);

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first-feed', title: 'First Feed', desc: 'Feed Pluto for the first time', test: (m) => m.timesFed >= 1 },
  { id: 'first-pet', title: 'First Pet', desc: 'Pet Pluto for the first time', test: (m) => m.timesPetted >= 1 },
  { id: 'first-toy', title: 'First Toy', desc: 'Give Pluto a toy', reward: 'bow', test: (m) => m.toysGiven >= 1 },
  { id: 'first-discovery', title: 'First Discovery', desc: 'Pluto finds something on the seabed', test: (m) => m.discoveries >= 1 },
  { id: 'fav-food', title: 'Favourite Food Discovered', desc: 'Find out what he likes to eat', test: (m) => !!m.favoriteFood },
  { id: 'fav-toy', title: 'Favourite Toy Discovered', desc: 'Find out which toy he loves most', test: (m) => !!m.favoriteToy },
  { id: 'friend', title: 'Friends', desc: 'Become friends with Pluto', test: (_m, s) => s >= 2 },
  { id: 'best-friend', title: 'Best Friend', desc: 'Pluto becomes attached to you', reward: 'crown', test: (_m, s) => s >= 3 },
  { id: 'week', title: '7 Day Friendship', desc: 'Visit on 7 different days', test: (m) => m.visits >= 7 },
  {
    id: 'hundred',
    title: '100 Plays',
    desc: 'Pet and play with Pluto 100 times',
    test: (m) => sum(m.toyCounts) + m.timesPlayed + m.timesPetted >= 100,
  },
  { id: 'popper', title: 'Bubble Popper', desc: 'Pop 25 bubbles yourself', reward: 'party', test: (m) => m.bubblesPopped >= 25 },
  { id: 'ring-runner', title: 'Ring Runner', desc: 'Pluto swims through the ring 20 times', test: (m) => m.ringPasses >= 20 },
  { id: 'seeker', title: 'Master Seeker', desc: 'Win hide & seek 3 times', reward: 'shades', test: (m) => m.hideWins >= 3 },
  { id: 'forgiven', title: 'Pluto Forgave You', desc: 'Make it up to him after upsetting him', test: (m) => m.timesForgiven >= 1 },
  { id: 'grew-young', title: 'Growing Up', desc: 'Pluto becomes a young fish', test: (m) => m.growthStage !== 'baby' },
  { id: 'grew-up', title: 'All Grown Up', desc: 'Pluto reaches full size', test: (m) => m.growthStage === 'grown' },
];

/* ---------- Food ---------- */
export interface FoodSpec {
  label: string;
  hunger: number; // how much hunger it removes
  energy: number;
  happiness: number;
  size: number; // px
  sink: number; // px / s
  fill: string;
  glow: string;
}

export const FOODS: Record<FoodKind, FoodSpec> = {
  flake: {
    label: 'Flakes',
    hunger: 0.22,
    energy: 0.06,
    happiness: 0.08,
    size: 7,
    sink: 34,
    fill: 'radial-gradient(circle at 35% 30%, #fff1c9, #e2a94f 70%)',
    glow: 'rgba(255, 220, 140, 0.55)',
  },
  pellet: {
    label: 'Pellet',
    hunger: 0.12,
    energy: 0.1,
    happiness: 0.04,
    size: 5,
    sink: 55,
    fill: 'radial-gradient(circle at 35% 30%, #d9b28a, #8a5a35 70%)',
    glow: 'rgba(210, 160, 110, 0.4)',
  },
  treat: {
    label: 'Shrimp treat (rare)',
    hunger: 0.1,
    energy: 0.05,
    happiness: 0.25,
    size: 11,
    sink: 26,
    fill: 'radial-gradient(circle at 35% 30%, #ffd1c2, #ff6f61 70%)',
    glow: 'rgba(255, 130, 110, 0.6)',
  },
};

export const FOOD_KINDS: FoodKind[] = ['flake', 'pellet', 'treat'];
export const TREAT_COOLDOWN = 25; // seconds

/* ---------- Daily rhythm ---------- */
export interface Rhythm {
  /** added to the energy rate (per second) */
  energy: number;
  /** swim speed multiplier */
  speed: number;
  /** multiplier on the desire to rest */
  rest: number;
  /** opacity of the dark wash over the aquarium */
  wash: number;
}

export const RHYTHM: Record<TimeOfDay, Rhythm> = {
  morning: { energy: 0.003, speed: 1.1, rest: 0.6, wash: 0 },
  afternoon: { energy: 0, speed: 1, rest: 0.9, wash: 0 },
  evening: { energy: -0.002, speed: 0.9, rest: 1.3, wash: 0.12 },
  night: { energy: -0.006, speed: 0.7, rest: 2.6, wash: 0.34 },
};

export function timeOfDay(hour: number): TimeOfDay {
  if (hour >= 5 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

/* ---------- World objects ---------- */
export interface WorldObject {
  id: string;
  kind: ObjectKind;
  /** horizontal position, 0..1 of the aquarium width */
  fx: number;
  discovered: boolean;
  visits: number;
}

/* ---------- Growth ---------- */
export const GROWTH_STAGES: GrowthStage[] = ['baby', 'young', 'grown'];
export const GROWTH_YOUNG_AT = 0.3;
export const GROWTH_GROWN_AT = 0.7;
/** Body stops getting bigger here (the last bit is just "maturing"). */
export const GROWTH_FULL_SIZE_AT = 0.85;
/** Max growth per calendar day: this is what makes it take weeks. */
export const GROWTH_DAILY_CAP = 0.03;
/** Passive growth per second while the app is open and she's cared for. */
export const GROWTH_PER_SECOND = 0.000012;

/** Juvenile blue tangs are yellow. The colour fades yellow -> blue between these growth values. */
export const GROWTH_BLUE_FROM = 0.15;
export const GROWTH_BLUE_TO = 0.75;

export function growthStageFor(g: number): GrowthStage {
  if (g < GROWTH_YOUNG_AT) return 'baby';
  if (g < GROWTH_GROWN_AT) return 'young';
  return 'grown';
}

/** Continuous body scale: ~50% at birth, 100% at GROWTH_FULL_SIZE_AT. */
export function bodyScaleFor(g: number): number {
  return 0.5 + 0.5 * Math.min(1, Math.max(0, g / GROWTH_FULL_SIZE_AT));
}

/** 0 = fully yellow juvenile, 1 = fully blue adult (smoothstep, so there is no visible pop). */
export function blueMixFor(g: number): number {
  const t = Math.min(1, Math.max(0, (g - GROWTH_BLUE_FROM) / (GROWTH_BLUE_TO - GROWTH_BLUE_FROM)));
  return t * t * (3 - 2 * t);
}

export const GROWTH_INFO: Record<GrowthStage, { label: string; emoji: string; diary: string }> = {
  baby: { label: 'Baby', emoji: '🐣', diary: 'Everything is huge.' },
  young: { label: 'Young', emoji: '🐠', diary: "I'm bigger now! I can dart around like a real fish." },
  grown: { label: 'Grown', emoji: '🐟', diary: "I'm all grown up. This reef feels like home." },
};

export const DECORATIONS: Record<Decoration, { label: string; emoji: string; fx: number; size: number }> = {
  kelp: { label: 'Kelp', emoji: '🌿', fx: 0.1, size: 46 },
  coral: { label: 'Coral', emoji: '🪸', fx: 0.82, size: 40 },
  castle: { label: 'Castle', emoji: '🏰', fx: 0.62, size: 54 },
  lantern: { label: 'Lantern', emoji: '🏮', fx: 0.28, size: 30 },
};

export const ENVIRONMENTS: Record<Environment, { label: string; emoji: string }> = {
  tank: { label: 'Classic tank', emoji: '🫧' },
  shallows: { label: 'Sunlit shallows', emoji: '☀️' },
  reef: { label: 'Coral reef', emoji: '🪸' },
};

export const GROWTH_UNLOCKS: Record<
  GrowthStage,
  { outfits: Outfit[]; decorations: Decoration[]; environments: Environment[] }
> = {
  baby: { outfits: [], decorations: [], environments: [] },
  young: { outfits: ['flower'], decorations: ['kelp', 'coral'], environments: ['shallows'] },
  grown: { outfits: ['pearls'], decorations: ['castle', 'lantern'], environments: ['reef'] },
};

/** Small growth bumps from caring events (all still limited by GROWTH_DAILY_CAP). */
export const GROWTH_FROM: Partial<Record<PlutoEventType, number>> = {
  USER_PET: 0.0004,
  USER_PLAY: 0.0006,
  FOOD_EATEN: 0.0012,
  TOY_PLAYED: 0.002,
  PLUTO_DISCOVERED: 0.002,
  HIDE_FOUND: 0.002,
  PLUTO_FORGAVE: 0.003,
};

/** Behaviour multipliers, blended continuously between the three anchors. */
export interface GrowthProfile {
  speed: number; // swim speed
  accel: number; // how snappily she changes direction
  tail: number; // tail-beat frequency
  wobble: number; // clumsy drift
  playful: number; // weight of swimming/play
  curious: number; // weight of exploring
  rest: number; // weight and length of rests
  attention: number; // how fast she wants company
  follow: number; // how readily she notices/follows your cursor
  eye: number; // eye scale (baby = big eyes)
}

const P_BABY: GrowthProfile = { speed: 1.12, accel: 1.3, tail: 1.35, wobble: 1.8, playful: 1.5, curious: 1.4, rest: 0.8, attention: 1.5, follow: 1.3, eye: 1.28 };
const P_YOUNG: GrowthProfile = { speed: 1, accel: 1, tail: 1, wobble: 1, playful: 1, curious: 1, rest: 1, attention: 1, follow: 1, eye: 1.1 };
const P_GROWN: GrowthProfile = { speed: 0.88, accel: 0.85, tail: 0.8, wobble: 0.55, playful: 0.8, curious: 0.85, rest: 1.15, attention: 0.7, follow: 0.8, eye: 1 };

export function profileFor(g: number): GrowthProfile {
  const [a, b, t] = g < 0.5 ? [P_BABY, P_YOUNG, g / 0.5] : [P_YOUNG, P_GROWN, (g - 0.5) / 0.5];
  const k = Math.min(1, Math.max(0, t));
  const out = {} as GrowthProfile;
  for (const key of Object.keys(a) as (keyof GrowthProfile)[]) out[key] = a[key] + (b[key] - a[key]) * k;
  return out;
}

/* ---------- Public snapshot + persisted save ---------- */
export interface PlutoSnapshot {
  state: PlutoState;
  mood: PlutoMood;
  energy: number;
  curiosity: number;
  happiness: number;
  attention: number;
  hunger: number;
  /** 0 = calm, 1 = furious */
  annoyance: number;
  relationship: RelationshipStage;
  timeOfDay: TimeOfDay;
  favoriteToy?: ToyKind;
  outfit: Outfit;
  growthStage: GrowthStage;
  /** 0..1 */
  growth: number;
  /** Position inside the aquarium, 0..1 */
  x: number;
  y: number;
  /** 0 = far back, 1 = right at the glass */
  depth: number;
}

export interface PlutoDrives {
  energy: number;
  curiosity: number;
  happiness: number;
  attention: number;
  hunger: number;
}

/** What gets stored. Later this becomes the API payload / DB row. */
export interface PlutoSave {
  version: 1;
  savedAt: number;
  drives: PlutoDrives;
  memory: PlutoMemory;
  temperament: Temperament;
  bond: number;
  objects: WorldObject[];
  x: number; // 0..1
  y: number; // 0..1
  /** Phase 4 (optional so older saves still load) */
  annoyance?: number;
  outfit?: Outfit;
  /** Phase 5 */
  environment?: Environment;
}

const KEY = 'pluto.save.v1';

export class PlutoStore {
  static load(): PlutoSave | null {
    if (typeof window === 'undefined') return null;
    try {
      if (new URLSearchParams(window.location.search).has('reset')) {
        window.localStorage.removeItem(KEY);
        return null;
      }
      const raw = window.localStorage.getItem(KEY);
      if (!raw) return null;
      const data = JSON.parse(raw) as PlutoSave;
      return data?.version === 1 ? data : null;
    } catch {
      return null;
    }
  }

  static save(save: PlutoSave): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(KEY, JSON.stringify(save));
    } catch {
      /* storage full / blocked: Pluto just forgets, no crash */
    }
  }
}