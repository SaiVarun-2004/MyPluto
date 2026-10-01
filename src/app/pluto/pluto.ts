import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  NgZone,
  OnDestroy,
  Output,
} from '@angular/core';
import {
  ACHIEVEMENTS,
  DECORATIONS,
  Decoration,
  ENVIRONMENTS,
  Environment,
  FOODS,
  FOOD_KINDS,
  FoodKind,
  GROWTH_DAILY_CAP,
  GROWTH_FROM,
  GROWTH_INFO,
  GROWTH_PER_SECOND,
  GROWTH_STAGES,
  GROWTH_UNLOCKS,
  GrowthProfile,
  NAMED_AFTER,
  OUTFITS,
  OUTFIT_KINDS,
  Outfit,
  PlutoDrives,
  PlutoEvent,
  PlutoMemory,
  PlutoMood,
  PlutoSnapshot,
  PlutoState,
  PlutoStore,
  RHYTHM,
  RelationshipStage,
  STAGES,
  TOYS,
  TOY_KINDS,
  TREAT_COOLDOWN,
  Temperament,
  TimeOfDay,
  ToyKind,
  Trait,
  WorldObject,
  blueMixFor,
  bodyScaleFor,
  defaultMemory,
  growthStageFor,
  newTemperament,
  profileFor,
  relationshipFor,
  timeOfDay,
} from './pluto-domain';

// Keep old import paths working
export * from './pluto-domain';

/* ==========================================================================
   Internals
   ========================================================================== */
type Vec = { x: number; y: number };
type El = HTMLElement | SVGElement;

interface Food {
  el: HTMLElement;
  kind: FoodKind;
  size: number;
  x: number;
  y: number;
  age: number;
  landedFor: number;
  swayPhase: number;
}

interface RuntimeObject extends WorldObject {
  el: HTMLElement;
}

interface RuntimeToy {
  kind: ToyKind;
  el: HTMLElement;
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  /** hits (ball) / passes (ring) in the current session */
  hits: number;
  goal: number;
  cool: number;
  spin: number;
  /** star: carried in his mouth */
  held: boolean;
  /** ring: which side he is swimming towards */
  side: 1 | -1;
  lastSign: number;
  /** bubble wand: seconds until the next bubble */
  spawnIn: number;
}

interface PopBubble {
  el: HTMLElement;
  x: number;
  y: number;
  r: number;
  vy: number;
  phase: number;
  life: number;
}

interface SteerOptions {
  turn?: boolean;
  align?: boolean;
}

const TAU = Math.PI * 2;
const RAD = 180 / Math.PI;

const VIEW_W = 400;
const VIEW_H = 340;
const MOUTH = { x: 126, y: 16 };
const EYE = { x: 62, y: -32 };

/** Tweak this if shells/pearls float above or sink into your sand. */
const OBJECT_SINK = 0.16; // fraction of seabed height below floorY
const MAX_OBJECTS = 4;

/** Annoyance thresholds. Set SULK_AT above 1 to switch sulking off completely. */
const ANNOYED_AT = 0.4; // mood becomes "annoyed" (and a toast appears)
const SULK_AT = 0.65; // he starts sulking
const FORGIVE_AT = 0.25; // below this he forgives you
const SULK_MAX_SECONDS = 60; // nobody stays angry forever

const GROWTH_AWAY_RATE = 0.5; // away time earns this fraction of a day's cap, up to 3 days

const STAGE_DIARY: Record<RelationshipStage, string> = {
  stranger: 'Everything is new.',
  familiar: 'My human is starting to feel familiar.',
  friend: 'I think my human is my friend now.',
  attached: "I can't imagine a day without my human.",
};

const MOOD_LABEL: Record<PlutoMood, string> = {
  calm: '😌 Calm',
  curious: '🤔 Curious',
  playful: '🤩 Playful',
  sleepy: '😴 Sleepy',
  'attention-seeking': '🥺 Wants attention',
  annoyed: '😤 Annoyed',
  sulking: '😠 Sulking',
};

const TIME_LABEL: Record<TimeOfDay, string> = {
  morning: '🌅 Morning',
  afternoon: '☀️ Afternoon',
  evening: '🌇 Evening',
  night: '🌙 Night',
};

/** Injected once into <head>: the toolbar, toast and journal live outside the component's view. */
const UI_CSS = `
.pluto-bar{position:absolute;left:50%;bottom:calc(52px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);display:flex;align-items:center;gap:8px;padding:6px 10px;border-radius:999px;background:rgba(2,30,45,.35);backdrop-filter:blur(6px);z-index:30;pointer-events:auto}
.pluto-btn{width:32px;height:32px;border-radius:50%;border:0;padding:0;font-size:17px;line-height:32px;cursor:pointer;background:rgba(255,255,255,.12);transition:background .2s,transform .15s;outline:2px solid transparent;outline-offset:2px}
.pluto-btn:hover{background:rgba(255,255,255,.26)}
.pluto-btn:active{transform:scale(.92)}
.pluto-btn:focus-visible{outline-color:#fff}
.pluto-btn.on{outline-color:rgba(255,255,255,.85)}
.pluto-sep{width:1px;height:20px;background:rgba(255,255,255,.3)}
.pluto-toast{position:absolute;top:14px;left:50%;transform:translate(-50%,-8px);max-width:min(88%,420px);padding:8px 14px;border-radius:999px;background:rgba(2,24,40,.8);color:#e8f7ff;font:500 13px/1.3 system-ui,sans-serif;text-align:center;z-index:40;opacity:0;pointer-events:none;transition:opacity .3s,transform .3s}
.pluto-toast.show{opacity:1;transform:translate(-50%,0)}
.pluto-panel{display:none;position:absolute;right:12px;top:12px;width:min(340px,calc(100% - 24px));max-height:calc(100% - 130px);overflow:auto;padding:14px 16px;border-radius:18px;background:rgba(2,24,40,.84);backdrop-filter:blur(10px);color:#e8f7ff;font:400 13px/1.45 system-ui,sans-serif;z-index:50;pointer-events:auto}
.pluto-panel.open{display:block}
.pluto-panel h3{margin:0 0 8px;font-size:16px;font-weight:650}
.pluto-panel h4{margin:14px 0 6px;font-size:13px;font-weight:650;color:#9fd8ff}
.pluto-panel .pp-head{display:flex;justify-content:space-between;align-items:center}
.pluto-panel .pp-close{border:0;background:none;color:inherit;font-size:20px;cursor:pointer;padding:0 4px}
.pluto-panel .pp-row{display:flex;justify-content:space-between;gap:12px;padding:2px 0}
.pluto-panel .pp-row span:first-child{opacity:.7}
.pluto-panel .pp-chips{display:flex;flex-wrap:wrap;gap:6px}
.pluto-panel .pp-chip{border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.08);color:inherit;border-radius:999px;padding:3px 10px;font:inherit;cursor:pointer}
.pluto-panel .pp-chip.on{background:rgba(120,200,255,.35);border-color:rgba(190,230,255,.9)}
.pluto-panel .pp-chip:disabled{opacity:.45;cursor:default}
.pluto-panel .pp-ach{opacity:.45}
.pluto-panel .pp-ach.got{opacity:1}
.pluto-panel ul{list-style:none;margin:0;padding:0}
.pluto-panel li{padding:2px 0}
.pluto-panel .pp-date{opacity:.55;margin-right:6px}
.pluto-panel .pp-empty{opacity:.6}
.pluto-env{position:absolute;inset:0 -4%;pointer-events:none;z-index:2;opacity:0;transition:opacity 1.5s}
.pluto-env[data-env='shallows'],.pluto-env[data-env='reef']{opacity:1;background:repeating-linear-gradient(105deg,rgba(255,255,255,.09) 0 5%,transparent 5% 13%);-webkit-mask-image:linear-gradient(to bottom,#000,transparent 75%);mask-image:linear-gradient(to bottom,#000,transparent 75%);animation:pluto-rays 14s ease-in-out infinite alternate}
.pluto-env[data-env='reef']{background:linear-gradient(to bottom,rgba(0,170,170,.16),rgba(255,120,90,.12)),repeating-linear-gradient(105deg,rgba(255,255,255,.09) 0 5%,transparent 5% 13%)}
@keyframes pluto-rays{from{transform:translateX(-2%)}to{transform:translateX(2%)}}
@media (prefers-reduced-motion:reduce){.pluto-env{animation:none!important}}
`;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo);
const randInt = (lo: number, hi: number) => Math.floor(rand(lo, hi + 1));
const r2 = (v: number) => Math.round(v * 100) / 100;

@Component({
  selector: 'app-pluto',
  standalone: true,
  templateUrl: './pluto.html',
  styleUrls: ['./pluto.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlutoComponent implements AfterViewInit, OnDestroy {
  /** Fires when Pluto's state, mood or relationship changes (not every frame). */
  @Output() stateChange = new EventEmitter<PlutoSnapshot>();
  /** Every interaction event (USER_PET, FOOD_EATEN...). Handy for debugging / later backend. */
  @Output() plutoEvent = new EventEmitter<PlutoEvent>();

  /* ---- world ---- */
  private parent!: HTMLElement;
  private W = 0;
  private H = 0;
  private hostW = 240;
  private hostH = 204;
  private floorY = 0;
  private seabedH = 0;
  private resizeObserver?: ResizeObserver;

  /* ---- body ---- */
  private x = 0;
  private y = 0;
  private vx = 0;
  private vy = 0;
  private z = 0.6;
  private zTarget = 0.6;
  private facing: 1 | -1 = 1;
  private flip = 1;
  private turnCooldown = 0;
  private target: Vec = { x: 0, y: 0 };
  private pitch = 0;
  private phase = 0;
  private breath = 0;
  private seed = Math.random() * 100;
  private spin = -1; // -1 = not spinning, otherwise 0..1 progress

  /* ---- behaviour ---- */
  private state: PlutoState = 'idle';
  private stateTime = 0;
  private stateDuration = 1;
  private waypoints = 0;
  private arrival?: () => void;
  private exciteLevel = 0;
  private curiousGone = 0;
  private mood: PlutoMood = 'calm';
  private foraging = false;
  private chase = false;
  private inv?: { obj: RuntimeObject; hold: number; holdFor: number };
  private drives: PlutoDrives = {
    energy: 0.85,
    curiosity: 0.3,
    happiness: 0.55,
    attention: 0,
    hunger: 0.45,
  };

  /* ---- memory, relationship, personality ---- */
  private memory: PlutoMemory = defaultMemory();
  private temper: Temperament = newTemperament();
  private bond = 0; // hidden; only ever shown through behaviour
  private stage: RelationshipStage = 'stranger';
  private overfed = 0;
  private recentPets: number[] = [];
  private lastHitAt = -999;
  private returnedPending = false;
  private awayS = 0;
  private greetIn = 0;
  private startPos = { fx: 0.3, fy: 0.4 };

  /* ---- feelings ---- */
  private annoyance = 0;
  /** true from the moment he starts sulking until he forgives you */
  private grudge = false;
  private sulkPokes = 0;
  private sulkSpotIn = 0;
  private lastAnnoyToast = -999;

  /* ---- play ---- */
  private toy?: RuntimeToy;
  private playIn = 0;
  private pops: PopBubble[] = [];
  private userPops = 0;
  private plutoPops = 0;
  private hideGame = { phase: 'go' as 'go' | 'hidden', t: 0, hintIn: 3 };
  private outfit: Outfit = 'none';
  private awayMsg = '';
  private awayFound = false;

  /* ---- growth ---- */
  private prof: GrowthProfile = profileFor(0);
  private growthAcc = 0;
  private growIn = 2;
  private burst = 1; // swim-speed multiplier for darts (>1) and glides (<1)
  private lastGrowthVar = -1;
  private decoEls = new Map<Decoration, HTMLElement>();
  private envEl?: HTMLElement;
  private environment: Environment = 'tank';

  /* ---- UI ---- */
  private bar?: HTMLElement;
  private panel?: HTMLElement;
  private panelOpen = false;
  private toastEl?: HTMLElement;
  private toastQ: string[] = [];
  private toastBusy = false;
  private toyBtns = new Map<ToyKind, HTMLButtonElement>();
  private destroyed = false;

  /* ---- world ---- */
  private tod: TimeOfDay = 'afternoon';
  private todIn = 0;
  private hourOverride: number | null = null;
  private wash = 0;
  private lastWash = -1;
  private washEl?: HTMLElement;
  private objects: RuntimeObject[] = [];
  private objSpawnIn = 20;
  private saveIn = 5;
  private foodKind: FoodKind = 'flake';
  private lastTreatAt = -999;
  private tray?: HTMLElement;
  private trayButtons = new Map<FoodKind, HTMLButtonElement>();
  private trayIn = 0;

  /* ---- face ---- */
  private look = { x: 2, y: 0, tx: 2, ty: 0, nextAt: 1 };
  private blinkT = -1;
  private blinkIn = 2;
  private lid = 1;
  private chompT = 0;

  /* ---- interaction ---- */
  private pointer = { x: 0, y: 0, active: false, lastMove: -999, nearTime: 0 };
  private foods: Food[] = [];
  private lastFoodAt = -1;

  /* ---- bubbles ---- */
  private bubblesToSpawn = 0;
  private bubbleCooldown = 0;
  private ambientBubbleIn = 3;
  private spawned = new Set<HTMLElement>();

  /* ---- loop / dom ---- */
  private t = 0;
  private last = 0;
  private raf = 0;
  private motion = 1;
  private layer = 6;
  private lastDepthVar = -1;
  private els!: {
    flip: El;
    tail: El;
    finFront: El;
    dorsal: El;
    anal: El;
    eye: El;
    pupil: El;
    mouth: El;
  };

  constructor(
    private host: ElementRef<HTMLElement>,
    private zone: NgZone,
  ) {}

  /* ========================================================================
     Lifecycle
     ======================================================================== */
  ngAfterViewInit(): void {
    if (typeof window === 'undefined') return;
    const host = this.host.nativeElement;
    const parent = host.parentElement;
    if (!parent) return;
    this.parent = parent;
    this.motion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 0.4 : 1;

    const q = (cls: string) => host.querySelector(`.${cls}`) as El;
    this.els = {
      flip: q('pluto__flip'),
      tail: q('pluto__layer-tail'),
      finFront: q('pluto__layer-fin-front'),
      dorsal: q('pluto__layer-dorsal'),
      anal: q('pluto__layer-anal'),
      eye: q('pluto__layer-eye'),
      pupil: q('pluto__layer-pupil'),
      mouth: q('pluto__layer-mouth'),
    };

    this.zone.runOutsideAngular(() => {
      // Testing helper: ?hour=23 forces night, ?reset wipes his memory
      const h = new URLSearchParams(window.location.search).get('hour');
      this.hourOverride = h !== null && !isNaN(+h) ? clamp(+h, 0, 24) : null;

      this.measure();
      this.restore();

      // Testing helper: ?growth=0.5 jumps to a growth level (use ?reset to start over)
      const gq = new URLSearchParams(window.location.search).get('growth');
      if (gq !== null && !isNaN(+gq)) {
        this.memory.growth = clamp(+gq, 0, 1);
        this.memory.growthStage = 'baby';
        this.applyGrowthStage(true);
      }
      host.dataset['growth'] = this.memory.growthStage;

      this.tod = timeOfDay(this.hourNow());
      host.dataset['time'] = this.tod;
      host.dataset['outfit'] = this.outfit;
      host.dataset['mood'] = this.mood;
      this.wash = RHYTHM[this.tod].wash;

      this.x = this.W * this.startPos.fx;
      this.y = this.H * this.startPos.fy;
      if (this.returnedPending) {
        // You've been away: he's resting near the bottom
        this.z = this.zTarget = 0.4;
        const b = this.bounds();
        this.x = clamp(this.x, b.minX, b.maxX);
        this.y = b.maxY;
        this.target = { x: this.x, y: this.y };
        this.setState('resting', 45, false);
      } else {
        this.target = { x: this.x, y: this.y };
        this.setState('idle', 0.8, false);
      }

      this.createWash();
      this.createTray();
      this.placeObjects();
      this.createEnvironment();
      this.syncDecorations();
      this.injectStyles();
      this.createToolbar();
      this.createPanel();
      this.createToast();

      if (this.awayFound) this.spawnObject();
      if (this.awayMsg) {
        const msg = this.awayMsg;
        window.setTimeout(() => this.toast(msg), 1200);
      }

      this.resizeObserver = new ResizeObserver(() => {
        this.measure();
        this.placeObjects();
      });
      this.resizeObserver.observe(parent);

      parent.addEventListener('pointermove', this.onPointerMove, { passive: true });
      parent.addEventListener('pointerdown', this.onPointerDown, { passive: true });
      parent.addEventListener('pointerleave', this.onPointerLeave, { passive: true });
      window.addEventListener('pagehide', this.onLeave);
      document.addEventListener('visibilitychange', this.onVisibility);

      this.render(0);
      host.classList.add('is-ready');
      this.raf = requestAnimationFrame(this.tick);
    });
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.save();
    this.resizeObserver?.disconnect();
    if (this.parent) {
      this.parent.removeEventListener('pointermove', this.onPointerMove);
      this.parent.removeEventListener('pointerdown', this.onPointerDown);
      this.parent.removeEventListener('pointerleave', this.onPointerLeave);
    }
    window.removeEventListener('pagehide', this.onLeave);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.foods.forEach((f) => f.el.remove());
    this.spawned.forEach((b) => b.remove());
    this.objects.forEach((o) => o.el.remove());
    this.pops.forEach((b) => b.el.remove());
    this.toy?.el.remove();
    this.washEl?.remove();
    this.tray?.remove();
    this.bar?.remove();
    this.panel?.remove();
    this.toastEl?.remove();
    this.decoEls.forEach((el) => el.remove());
    this.decoEls.clear();
    this.envEl?.remove();
    this.foods = [];
    this.objects = [];
    this.pops = [];
    this.toy = undefined;
    this.spawned.clear();
  }

  getSnapshot(): PlutoSnapshot {
    const d = this.drives;
    return {
      state: this.state,
      mood: this.mood,
      energy: r2(d.energy),
      curiosity: r2(d.curiosity),
      happiness: r2(d.happiness),
      attention: r2(d.attention),
      hunger: r2(d.hunger),
      annoyance: r2(this.annoyance),
      relationship: this.stage,
      timeOfDay: this.tod,
      favoriteToy: this.memory.favoriteToy,
      outfit: this.outfit,
      growthStage: this.memory.growthStage,
      growth: r2(this.memory.growth),
      x: r2(this.W ? this.x / this.W : 0),
      y: r2(this.H ? this.y / this.H : 0),
      depth: r2(this.z),
    };
  }

  /* ========================================================================
     Persistence
     ======================================================================== */
  private restore(): void {
    const save = PlutoStore.load();
    const now = Date.now();
    if (!save) {
      this.memory = defaultMemory();
      this.memory.visits = 1;
      this.temper = newTemperament();
      this.addDiary('I met my human today.');
      this.applyGrowthStage(true);
      return;
    }

    const base = defaultMemory();
    this.drives = { ...this.drives, ...save.drives };
    this.memory = {
      ...base,
      ...save.memory,
      foodCounts: { ...base.foodCounts, ...save.memory?.foodCounts },
      toyCounts: { ...base.toyCounts, ...save.memory?.toyCounts },
      todCounts: { ...base.todCounts, ...save.memory?.todCounts },
    };

    // Saves from before Phase 5: estimate growth from how long they've been together
    if (save.memory?.growth === undefined) {
      const days = (now - this.memory.firstSeen) / 864e5;
      this.memory.growth = clamp(days * 0.02, 0, 0.5);
    }
    this.applyGrowthStage(true);
    this.environment = save.environment ?? 'tank';
    if (this.environment !== 'tank' && !this.memory.environments.includes(this.environment)) this.environment = 'tank';

    // older saves have no toy taste: fill the gaps instead of wiping his personality
    this.temper = { ...newTemperament(), ...save.temperament };
    this.bond = save.bond ?? 0;
    // A fresh visit never starts mid-tantrum (the sulk flag itself isn't saved)
    this.annoyance = Math.min(clamp(save.annoyance ?? 0, 0, 1), 0.2);
    this.outfit = save.outfit ?? 'none';
    if (this.outfit !== 'none' && !this.memory.unlocked.includes(this.outfit)) this.outfit = 'none';
    this.startPos = { fx: clamp(save.x ?? 0.3, 0.05, 0.95), fy: clamp(save.y ?? 0.4, 0.1, 0.8) };
    (save.objects ?? []).forEach((o) => this.addObject(o));

    const away = Math.max(0, (now - save.savedAt) / 1000);
    const hrs = away / 3600;
    this.awayS = away;

    // The world kept turning while you were gone (but nothing ever harms him)
    this.drives.hunger = clamp(this.drives.hunger + Math.min(away, 6 * 3600) * 0.00005, 0, 0.85);
    this.bond = clamp(this.bond - clamp((hrs - 12) * 0.004, 0, 0.25), 0, 1);
    this.stage = relationshipFor(this.bond);
    // Anger never lasts forever: time away cools him down
    this.annoyance = Math.max(0, this.annoyance - hrs * 0.25);

    if (away > 600) {
      this.returnedPending = true;
      this.drives.energy = clamp(this.drives.energy, 0.3, 0.5);
      this.drives.attention = this.bond > 0.35 ? 0.5 : 0.1;

      // "While you were away..."
      this.awayFound = hrs >= 3;
      const bits = [hrs < 1 ? 'had a little nap' : 'napped and explored'];
      if (this.awayFound) bits.push('found something shiny');
      if (this.bond > 0.35) bits.push('missed you');
      this.awayMsg = `While you were away, Pluto ${bits.join(', ')}.`;

      // She keeps growing while you're away (slowly, and not past a few days' worth)
      const was = this.memory.growthStage;
      this.gainGrowth(Math.min(hrs / 24, 3) * GROWTH_DAILY_CAP * GROWTH_AWAY_RATE, true, true);
      if (this.memory.growthStage !== was) this.awayMsg += ' She grew up a little, too!';

      this.addDiary(
        this.bond > 0.35 ? 'My human came back after being away. I missed them.' : 'My human came back after a while.',
      );
    }
    if (new Date(save.savedAt).toDateString() !== new Date(now).toDateString()) {
      this.memory.visits++;
      this.gainBond(0.03);
    }
  }

  private save(): void {
    if (!this.W) return;
    PlutoStore.save({
      version: 1,
      savedAt: Date.now(),
      drives: { ...this.drives },
      memory: this.memory,
      temperament: this.temper,
      bond: this.bond,
      annoyance: this.annoyance,
      outfit: this.outfit,
      environment: this.environment,
      objects: this.objects.map(({ id, kind, fx, discovered, visits }) => ({
        id,
        kind,
        fx,
        discovered,
        visits,
      })),
      x: this.x / this.W,
      y: this.y / this.H,
    });
  }

  private onLeave = (): void => this.save();
  private onVisibility = (): void => {
    if (document.visibilityState === 'hidden') this.save();
  };

  /* ========================================================================
     Main loop
     ======================================================================== */
  private tick = (now: number): void => {
    const dt = Math.min((now - (this.last || now)) / 1000, 0.05);
    this.last = now;
    this.update(dt);
    this.render(dt);
    this.raf = requestAnimationFrame(this.tick);
  };

  private update(dt: number): void {
    this.t += dt;
    this.stateTime += dt;
    this.turnCooldown = Math.max(0, this.turnCooldown - dt);

    this.updateWorld(dt);
    this.updateDrives(dt);
    this.updateMood();
    this.updateFood(dt);
    this.updateBehaviour(dt);
    this.integrate(dt);
    this.updateToy(dt);
    this.updatePops(dt);
    this.updateBubbles(dt);
  }

  /* ========================================================================
     Measuring and bounds
     ======================================================================== */
  private measure(): void {
    const pr = this.parent.getBoundingClientRect();
    this.W = pr.width;
    this.H = pr.height;
    const host = this.host.nativeElement;
    this.hostW = host.offsetWidth || this.hostW;
    this.hostH = this.hostW * (VIEW_H / VIEW_W);

    const seabed = this.parent.querySelector('.seabed');
    if (seabed) {
      const sb = seabed.getBoundingClientRect();
      this.seabedH = sb.height;
      this.floorY = sb.top - pr.top + sb.height * 0.14;
    } else {
      this.seabedH = this.H * 0.28;
      this.floorY = this.H * 0.76;
    }
  }

  /** Depth scale times body growth: every bounds/mouth/toy calculation is size-aware through this. */
  private get scale(): number {
    return (0.62 + 0.5 * this.z) * bodyScaleFor(this.memory.growth);
  }

  private unit(): number {
    return (this.hostW / VIEW_W) * this.scale;
  }

  private bounds(relax = 0) {
    const s = this.scale;
    const hw = this.hostW * s * 0.42;
    const hh = this.hostH * s * 0.42;
    const minX = hw;
    const maxX = Math.max(minX, this.W - hw);
    const minY = this.H * 0.07 + hh;
    const maxY = Math.max(minY, this.floorY - hh * (1 - relax));
    return { minX, maxX, minY, maxY };
  }

  private foodFloor(): number {
    return this.floorY - this.hostH * 0.18;
  }

  private flipSign(): 1 | -1 {
    return this.flip < 0 ? -1 : 1;
  }

  private mouthWorld(): Vec {
    const k = this.unit();
    return { x: this.x + this.flipSign() * MOUTH.x * k, y: this.y + MOUTH.y * k };
  }

  private get stageIdx(): number {
    return STAGES.indexOf(this.stage);
  }

  /* ========================================================================
     Interaction architecture: every user/world happening is an event.
     dispatch -> remember (memory/bond/personality) -> react (behaviour)
     ======================================================================== */
  private dispatch(ev: Omit<PlutoEvent, 'at'>): void {
    const e: PlutoEvent = { ...ev, at: Date.now() };
    this.remember(e);
    this.react(e);
    if (this.plutoEvent.observed) this.zone.run(() => this.plutoEvent.emit(e));
  }

  /** Memory + relationship + personality drift. */
  private remember(e: PlutoEvent): void {
    const m = this.memory;
    const tp = this.temper;
    const nudge = (k: Trait, v: number) => (tp[k] = clamp(tp[k] + v, 0.15, 0.9));

    if (e.type.startsWith('USER_')) m.todCounts[this.tod]++;

    switch (e.type) {
      case 'USER_PET':
        m.timesPetted++;
        m.lastInteraction = e.at;
        this.gainBond(this.grudge ? 0 : 0.012);
        nudge('playful', 0.004);
        nudge('sleepy', -0.002);
        break;
      case 'USER_PLAY':
        m.timesPlayed++;
        m.lastInteraction = e.at;
        this.gainBond(this.grudge ? 0 : 0.015);
        nudge('playful', 0.008);
        break;
      case 'USER_FEED':
        m.timesFed++;
        m.lastInteraction = e.at;
        this.gainBond(0.008);
        break;
      case 'FOOD_EATEN':
        if (e.food) m.foodCounts[e.food]++;
        m.lastFed = e.at;
        this.updateFavorite();
        if (e.favorite) this.gainBond(0.02);
        break;
      case 'USER_HOVER':
        m.lastInteraction = e.at;
        break;
      case 'USER_RETURNED':
        m.lastInteraction = e.at;
        this.gainBond(0.01);
        break;
      case 'USER_TOY':
        m.toysGiven++;
        m.lastInteraction = e.at;
        this.gainBond(0.004);
        if (m.toysGiven === 1 && e.toy) this.addDiary(`My human gave me a ${TOYS[e.toy].label.toLowerCase()}!`);
        break;
      case 'TOY_PLAYED':
        if (e.toy) m.toyCounts[e.toy]++;
        m.lastInteraction = e.at;
        this.gainBond(0.015);
        nudge('playful', 0.008);
        this.updateFavoriteToy();
        break;
      case 'BUBBLE_POPPED':
        if (e.by === 'user') {
          m.bubblesPopped++;
          this.gainBond(0.002);
          nudge('playful', 0.002);
        }
        break;
      case 'RING_PASS':
        m.ringPasses++;
        break;
      case 'HIDE_FOUND':
        m.hideWins++;
        m.lastInteraction = e.at;
        this.gainBond(0.015);
        this.addDiary('My human found me while I was hiding!');
        break;
      case 'PLUTO_ANNOYED':
        m.timesAnnoyed++;
        this.addDiary('I was upset with my human today.');
        break;
      case 'PLUTO_FORGAVE':
        m.timesForgiven++;
        this.gainBond(0.02);
        this.addDiary('My human made it up to me. I forgave them.');
        break;
      case 'PLUTO_DISCOVERED': {
        m.discoveries++;
        nudge('curious', 0.012);
        const o = this.objects.find((x) => x.id === e.objectId);
        this.addDiary(`I discovered a ${o?.kind ?? 'treasure'} on the sand!`);
        break;
      }
    }

    // Caring events nudge growth (still limited by the daily cap; sulking slows it)
    const gg = GROWTH_FROM[e.type];
    if (gg) this.gainGrowth(gg * (this.grudge ? 0.3 : 1));

    this.checkAchievements();
  }

  private updateFavorite(): void {
    const c = this.memory.foodCounts;
    if (c.flake + c.pellet < 6) return; // needs a few meals to form a preference
    const prev = this.memory.favoriteFood;
    const next: FoodKind = c.pellet > c.flake ? 'pellet' : 'flake';
    this.memory.favoriteFood = next;
    if (!prev) {
      const label = FOODS[next].label.toLowerCase();
      this.addDiary(`I think ${label} might be my favourite food.`);
      this.toast(`Pluto seems to love ${label}!`);
    }
  }

  /** Favourite toy = what he has played with most, plus a hidden innate taste. */
  private updateFavoriteToy(): void {
    const m = this.memory;
    const total = TOY_KINDS.reduce((s, k) => s + m.toyCounts[k], 0);
    if (total < 5) return;
    let best: ToyKind = TOY_KINDS[0];
    let bestScore = -1;
    for (const k of TOY_KINDS) {
      const score = m.toyCounts[k] + this.temper.toyTaste[k] * 3;
      if (score > bestScore) {
        bestScore = score;
        best = k;
      }
    }
    const prev = m.favoriteToy;
    m.favoriteToy = best;
    if (!prev) {
      this.addDiary(`I think my favourite toy is the ${TOYS[best].label.toLowerCase()}.`);
      this.toast(`Pluto's favourite toy: ${TOYS[best].emoji} ${TOYS[best].label}!`);
    }
    if (!m.namedToy && m.toyCounts[best] >= NAMED_AFTER) {
      m.namedToy = best;
      this.addDiary(`${TOYS[best].own}. Nobody else may touch it.`);
      this.toast(`${TOYS[best].own}! It's officially his now.`);
    }
  }

  private gainBond(amount: number): void {
    this.bond = clamp(this.bond + amount * (1 - this.bond), 0, 1);
    const next = relationshipFor(this.bond);
    if (next !== this.stage) {
      const up = STAGES.indexOf(next) > this.stageIdx;
      this.stage = next;
      if (up) {
        this.bubblesToSpawn += 6; // a quiet little celebration
        this.addDiary(STAGE_DIARY[next]);
      }
      this.emit();
      this.checkAchievements();
    }
  }

  /** Behaviour: how Pluto responds to an event given who he is right now. */
  private react(e: PlutoEvent): void {
    // Sulking: he ignores petting, hovering and games. Too much poking makes it worse.
    if (this.grudge && (e.type === 'USER_PET' || e.type === 'USER_PLAY' || e.type === 'USER_HOVER')) {
      if (e.type !== 'USER_HOVER' && ++this.sulkPokes > 3) this.annoy(0.03);
      return;
    }

    switch (e.type) {
      case 'USER_PET':
        this.reactPet();
        break;
      case 'USER_PLAY':
        this.drives.happiness = Math.min(1, this.drives.happiness + 0.08);
        this.startExcited(4);
        this.chase = true;
        break;
      case 'USER_HOVER':
        // Friends come to say hello when you show up
        if (
          this.stageIdx >= 2 &&
          this.isFree() &&
          (this.mood !== 'sleepy' || this.stageIdx >= 3) &&
          Math.random() < (this.stageIdx === 2 ? 0.5 : 0.85)
        ) {
          this.pointer.nearTime = 0;
          this.startCurious();
        }
        break;
      case 'USER_RETURNED':
        // Drowsy: his eye follows the cursor first (see updateLook), then he swims over
        this.greetIn = this.state === 'resting' ? 2.4 : 0.3;
        break;
      case 'USER_TOY':
        this.onToyGiven(e.toy);
        break;
      case 'TOY_PLAYED':
        this.onToyPlayed(e.toy);
        break;
      case 'HIDE_FOUND':
        this.toast('Found me! 🎉');
        this.spin = 0;
        this.startExcited(3);
        break;
      case 'PLUTO_FORGAVE':
        this.toast('Pluto forgave you ❤️');
        this.drives.happiness = Math.min(1, this.drives.happiness + 0.12);
        this.bubblesToSpawn += 8;
        this.spin = 0;
        this.startExcited(2.4);
        break;
    }
  }

  private reactPet(): void {
    const d = this.drives;
    this.recentPets = this.recentPets.filter((x) => this.t - x < 20);
    this.recentPets.push(this.t);
    d.attention = 0;

    // Had enough: swims away (and isn't happy about it)
    if (this.recentPets.length > 7 && this.mood !== 'playful') {
      this.recentPets.length = 0;
      d.happiness = Math.max(0, d.happiness - 0.04);
      this.startSwim();
      this.annoy(0.12);
      return;
    }

    d.happiness = Math.min(1, d.happiness + 0.06 + this.stageIdx * 0.01);

    // Sleepy: wakes up a little, doesn't leap around. Only repeated poking grumbles him.
    if (this.state === 'resting' || this.mood === 'sleepy') {
      d.energy = Math.max(d.energy, 0.32);
      this.bubblesToSpawn += 1;
      this.setState('idle', rand(2, 3.5));
      if (this.recentPets.length > 3) this.annoy(this.tod === 'night' ? 0.05 : 0.02);
      return;
    }
    // Hungry: mostly ignores you and goes looking for food
    if (d.hunger > 0.7 && Math.random() < 0.7) {
      this.bubblesToSpawn += 1;
      this.startForage();
      return;
    }
    // Curious: stays, lingers
    if (this.state === 'curious') {
      this.bubblesToSpawn += 3;
      this.stateTime = Math.max(0, this.stateTime - 2);
      return;
    }

    const roll = Math.random();
    if (this.mood === 'playful' || roll < 0.25 + this.temper.playful * 0.25) {
      this.startExcited(this.mood === 'playful' ? 3 : 2.2);
      if (Math.random() < 0.3) this.spin = 0;
    } else {
      // calm pleasure: pauses and enjoys it
      this.bubblesToSpawn += 3;
      this.setState('idle', 2.5);
    }
    if (this.recentPets.length > 5) this.annoy(0.015);
  }

  private greet(): void {
    if (!['resting', 'idle', 'swimming', 'exploring'].includes(this.state)) return;
    this.drives.energy = Math.max(this.drives.energy, 0.4);
    this.pointer.nearTime = 0;
    this.startCurious();
    if (this.stageIdx >= 2) this.bubblesToSpawn += 4;
  }

  private isFree(): boolean {
    return (
      this.state === 'idle' ||
      this.state === 'swimming' ||
      this.state === 'exploring' ||
      this.state === 'resting'
    );
  }

  /* ========================================================================
     Growth: slow, time-gated, and never caused by a single click
     ======================================================================== */
  private gainGrowth(amount: number, silent = false, bypassCap = false): void {
    const m = this.memory;
    if (amount <= 0 || m.growth >= 1) return;
    let gain = amount;
    if (!bypassCap) {
      const day = new Date().toDateString();
      if (m.growthDay !== day) {
        m.growthDay = day;
        m.growthToday = 0;
      }
      gain = Math.min(amount, GROWTH_DAILY_CAP - m.growthToday);
      if (gain <= 0) return;
      m.growthToday += gain;
    }
    m.growth = Math.min(1, m.growth + gain);
    this.applyGrowthStage(silent);
  }

  /** Refreshes the behaviour profile, grants unlocks (idempotent) and celebrates stage-ups. */
  private applyGrowthStage(silent: boolean): void {
    const m = this.memory;
    this.prof = profileFor(m.growth);
    const next = growthStageFor(m.growth);
    const idx = GROWTH_STAGES.indexOf(next);

    for (const st of GROWTH_STAGES.slice(0, idx + 1)) {
      const u = GROWTH_UNLOCKS[st];
      u.outfits.forEach((o) => !m.unlocked.includes(o) && m.unlocked.push(o));
      u.decorations.forEach((d) => !m.decorations.includes(d) && m.decorations.push(d));
      u.environments.forEach((e) => !m.environments.includes(e) && m.environments.push(e));
    }
    if (next === m.growthStage) return;

    const up = idx > GROWTH_STAGES.indexOf(m.growthStage);
    m.growthStage = next;
    this.host.nativeElement.dataset['growth'] = next;
    if (!up) return;

    if (!silent) {
      const info = GROWTH_INFO[next];
      this.addDiary(info.diary);
      this.toast(`${info.emoji} Pluto is growing up: ${info.label}!`);
      this.toast('✨ New decorations, a new look and new tricks are waiting.');
      this.syncDecorations(true);
      this.bubblesToSpawn += 12;
      this.spin = 0;
      if (this.isFree()) this.startExcited(2.4);
      this.emit();
      this.dispatch({ type: 'PLUTO_GREW' });
    }
    this.checkAchievements();
    if (this.panelOpen) this.renderPanel();
  }

  /* ========================================================================
     Feelings: annoyance, sulking, forgiveness
     ======================================================================== */
  /** Something upset him. Strangers barely care; friends do. */
  private annoy(v: number): void {
    const scale = this.stageIdx === 0 ? 0.4 : 1;
    const before = this.annoyance;
    this.annoyance = clamp(this.annoyance + v * scale, 0, 1);
    if (before < ANNOYED_AT && this.annoyance >= ANNOYED_AT && this.t - this.lastAnnoyToast > 60) {
      this.lastAnnoyToast = this.t;
      this.toast('Pluto looks a bit annoyed… 😤');
    }
    if (!this.grudge && this.annoyance >= SULK_AT && this.stageIdx >= 1) this.startSulk();
  }

  /** You did something nice. Enough of it and he forgives you. */
  private soothe(v: number): void {
    if (this.annoyance <= 0) return;
    this.annoyance = Math.max(0, this.annoyance - v);
    if (this.grudge && this.annoyance < FORGIVE_AT) this.forgive();
  }

  private startSulk(silent = false): void {
    this.grudge = true;
    this.sulkPokes = 0;
    this.sulkSpotIn = rand(10, 18);
    this.zTarget = 0.25;
    this.target = this.sulkSpot();
    this.setState('sulking', 0);
    if (!silent) {
      this.drives.happiness = Math.max(0, this.drives.happiness - 0.15);
      this.dispatch({ type: 'PLUTO_ANNOYED' });
      this.toast('Pluto is giving you the cold shoulder… 😤');
      window.setTimeout(() => {
        if (!this.destroyed && this.grudge) this.toast('Maybe a treat, his favourite toy, or some space would help.');
      }, 6000);
    }
  }

  private forgive(): void {
    if (!this.grudge) return;
    this.grudge = false;
    this.annoyance = 0.08;
    this.dispatch({ type: 'PLUTO_FORGAVE' });
  }

  private sulkSpot(): Vec {
    const b = this.bounds();
    const left = this.pointer.active ? this.pointer.x > this.W / 2 : Math.random() < 0.5;
    return {
      x: clamp(left ? rand(this.W * 0.08, this.W * 0.3) : rand(this.W * 0.7, this.W * 0.92), b.minX, b.maxX),
      y: rand(b.minY + (b.maxY - b.minY) * 0.6, b.maxY),
    };
  }

  private updateSulking(dt: number): void {
    if (!this.grudge) {
      this.startIdle();
      return;
    }
    this.sulkSpotIn -= dt;
    if (this.sulkSpotIn <= 0 || this.arrived(24)) {
      this.target = this.sulkSpot();
      this.sulkSpotIn = rand(10, 18);
    }
    // Turns his back on you
    if (this.pointer.active) {
      const away: 1 | -1 = this.pointer.x > this.x ? -1 : 1;
      if (away !== this.facing && this.turnCooldown <= 0) this.turnTo(away);
    }
    this.steer(dt, this.cruise() * 0.3, { turn: false, align: false });
    if (this.stateTime > SULK_MAX_SECONDS) this.forgive(); // nobody stays angry forever
  }

  /* ========================================================================
     Toys
     ======================================================================== */
  private toggleToy(kind: ToyKind): void {
    if (this.toy?.kind === kind) {
      this.removeToy(true);
      return;
    }
    if (this.toy) this.removeToy(false); // swapping isn't "taking it away"
    this.spawnToy(kind);
  }

  private toyLook(kind: ToyKind): Record<string, string> {
    switch (kind) {
      case 'ball':
        return {
          background: 'radial-gradient(circle at 32% 28%, #b4d9ff, #2f6ff0 58%, #1a3fc4)',
          borderRadius: '50%',
          boxShadow: '0 4px 8px rgba(0,0,0,0.3), inset 0 2px 3px rgba(255,255,255,0.4)',
        };
      case 'ring':
        return {
          boxSizing: 'border-box',
          border: '7px solid #ffcf3d',
          borderRadius: '50%',
          boxShadow: '0 0 10px rgba(255,207,61,0.6), inset 0 0 6px rgba(255,255,255,0.4)',
        };
      default: {
        const s = TOYS[kind];
        return {
          fontSize: `${s.w - 4}px`,
          lineHeight: `${s.h}px`,
          textAlign: 'center',
          filter: 'drop-shadow(0 0 6px rgba(255,255,255,0.45))',
        };
      }
    }
  }

  private spawnToy(kind: ToyKind): void {
    if (!this.W) return;
    const spec = TOYS[kind];
    const el = document.createElement('div');
    Object.assign(el.style, {
      position: 'absolute',
      left: '0',
      top: '0',
      width: `${spec.w}px`,
      height: `${spec.h}px`,
      pointerEvents: 'none',
      zIndex: '5',
      opacity: '0',
      transition: 'opacity 0.5s ease',
      ...this.toyLook(kind),
    });
    if (kind === 'star' || kind === 'bubbles') el.textContent = spec.emoji;
    this.parent.appendChild(el);

    const b = this.bounds();
    const x = clamp(rand(this.W * 0.2, this.W * 0.8), b.minX + 30, Math.max(b.minX + 30, b.maxX - 30));
    const y =
      kind === 'ring' ? rand(this.H * 0.3, this.H * 0.5) : kind === 'bubbles' ? this.H * 0.12 : this.H * 0.16;

    const t: RuntimeToy = {
      kind,
      el,
      x,
      y,
      vx: rand(-30, 30),
      vy: 0,
      age: 0,
      hits: 0,
      goal: 0,
      cool: 0,
      spin: 0,
      held: false,
      side: 1,
      lastSign: Math.sign(this.x - x) || 1,
      spawnIn: 0.5,
    };
    this.toy = t;
    this.placeToy(t);
    requestAnimationFrame(() => (el.style.opacity = '1'));
    this.refreshToolbar();
    this.dispatch({ type: 'USER_TOY', toy: kind });
  }

  private removeToy(taken: boolean): void {
    const t = this.toy;
    if (!t) return;
    t.el.remove();
    this.toy = undefined;
    this.refreshToolbar();

    const wasPlaying = this.state === 'playing';
    const named = this.memory.namedToy === t.kind;
    if (taken && (wasPlaying || named)) {
      this.annoy(wasPlaying ? (named ? 0.2 : 0.1) : 0.05);
      this.toast(named ? `Pluto is searching for ${TOYS[t.kind].own}…` : "Pluto wasn't done playing! 😠");
      if (wasPlaying) this.addDiary(`My human took my ${TOYS[t.kind].label.toLowerCase()} away while I was playing.`);
      if (!this.grudge && (wasPlaying || this.isFree())) this.startExplore();
    } else if (wasPlaying) {
      this.startIdle();
    }
  }

  private placeToy(t: RuntimeToy): void {
    const s = TOYS[t.kind];
    const rot = t.kind === 'star' ? ` rotate(${t.spin.toFixed(0)}deg)` : '';
    t.el.style.transform = `translate3d(${(t.x - s.w / 2).toFixed(1)}px, ${(t.y - s.h / 2).toFixed(1)}px, 0)${rot}`;
  }

  private updateToy(dt: number): void {
    const t = this.toy;
    if (!t) return;
    t.age += dt;
    const s = TOYS[t.kind];
    const minX = s.w / 2 + 4;
    const maxX = this.W - s.w / 2 - 4;
    const minY = this.H * 0.06 + s.h / 2;
    const maxY = this.floorY - s.h / 2 + 6;

    switch (t.kind) {
      case 'ball':
      case 'star': {
        if (t.kind === 'star') {
          t.spin += dt * 70;
          if (t.held) {
            const m = this.mouthWorld();
            t.x = m.x;
            t.y = m.y;
            break;
          }
        }
        t.vy += (t.kind === 'ball' ? 26 : 8) * dt; // slow sink: it's underwater
        const drag = Math.exp(-dt * (t.kind === 'ball' ? 0.9 : 1.4));
        t.vx *= drag;
        t.vy *= drag;
        t.x += t.vx * dt;
        t.y += t.vy * dt;
        if (t.x < minX) {
          t.x = minX;
          t.vx = Math.abs(t.vx) * 0.8;
        } else if (t.x > maxX) {
          t.x = maxX;
          t.vx = -Math.abs(t.vx) * 0.8;
        }
        if (t.y < minY) {
          t.y = minY;
          t.vy = Math.abs(t.vy) * 0.5;
        } else if (t.y > maxY) {
          t.y = maxY;
          t.vy = -Math.abs(t.vy) * 0.5;
          t.vx *= 0.9;
        }
        break;
      }
      case 'ring':
        // hangs in the water, drifting very slowly
        t.x = clamp(t.x + Math.sin(t.age * 0.6) * 5 * dt, minX, maxX);
        t.y = clamp(t.y + Math.cos(t.age * 0.45) * 4 * dt, minY, maxY);
        break;
      case 'bubbles':
        break; // the wand stays put; see updatePops
    }
    this.placeToy(t);
  }

  private onToyGiven(kind?: ToyKind): void {
    if (!kind) return;
    const fav = this.memory.favoriteToy === kind;
    if (this.grudge && fav) this.soothe(0.3); // may forgive him right here
    this.playIn = fav ? 0.4 : rand(0.8, 2);
    if (fav && !this.grudge && this.isFree()) {
      this.spin = 0;
      this.startExcited(1.8); // favourite toy: 🤩🐟💨
    }
  }

  /** Called after his play-in timer: does he fancy it? Returns false if he's busy (try again). */
  private tryPlay(): boolean {
    const t = this.toy;
    if (!t) return true;
    const fav = this.memory.favoriteToy === t.kind;
    if (this.grudge) {
      // Sulking: only a favourite toy can tempt him
      if (fav && this.state === 'sulking') this.startPlay();
      return true;
    }
    if (!this.isFree()) return false;
    if (this.mood === 'sleepy' && !fav) return true;
    const eager = fav ? 1 : 0.35 + this.temper.toyTaste[t.kind] * 0.6;
    if (Math.random() < eager) this.startPlay();
    return true;
  }

  private startPlay(): void {
    const t = this.toy;
    if (!t) return;
    this.zTarget = 0.7;
    this.setState('playing', 0);
    t.hits = 0;
    t.cool = 0;
    t.goal = t.kind === 'ring' ? randInt(5, 8) : t.kind === 'ball' ? randInt(9, 15) : 0;
    t.held = false;
    if (t.kind === 'ring') {
      t.lastSign = Math.sign(this.x - t.x) || 1;
      t.side = (-t.lastSign) as 1 | -1;
    }
  }

  private updatePlaying(dt: number): void {
    const t = this.toy;
    if (!t) {
      this.startIdle();
      return;
    }
    const k = this.unit();
    const off = MOUTH.x * k;
    const m = this.mouthWorld();
    t.cool = Math.max(0, t.cool - dt);

    // Swim so that his mouth ends up on (px, py)
    const chaseAt = (px: number, py: number, speed: number) => {
      const dx = px - this.x;
      if (Math.abs(dx) > off * 1.2 && Math.sign(dx) !== this.facing && this.turnCooldown <= 0) {
        this.turnTo(Math.sign(dx) as 1 | -1);
      }
      this.target = { x: px - this.facing * off, y: py - MOUTH.y * k };
      this.steer(dt, speed, { turn: false, align: false });
    };

    switch (t.kind) {
      case 'ball': {
        chaseAt(t.x, t.y, this.cruise() * 1.7);
        if (t.cool <= 0 && Math.hypot(m.x - t.x, m.y - t.y) < 34 * this.scale) {
          // boop!
          const dx = t.x - m.x + this.facing * 30;
          const dy = t.y - m.y;
          const mag = Math.hypot(dx, dy) || 1;
          const sp = rand(240, 380);
          t.vx = (dx / mag) * sp;
          t.vy = (dy / mag) * sp - 50;
          t.hits++;
          t.cool = 0.4;
          this.chompT = 0.25;
          this.bubblesToSpawn += 1;
          if (t.hits >= t.goal) {
            this.finishPlay();
            return;
          }
        }
        break;
      }

      case 'ring': {
        this.target = { x: t.x + t.side * 120 * this.scale, y: t.y };
        this.steer(dt, this.cruise() * 1.5);
        const s = Math.sign(this.x - t.x);
        if (s !== 0 && s !== t.lastSign) {
          if (Math.abs(this.y - t.y) < 55) {
            t.hits++;
            this.bubblesToSpawn += 3;
            this.dispatch({ type: 'RING_PASS', toy: 'ring' });
          }
          t.lastSign = s;
          t.side = (-s) as 1 | -1; // swim back the other way
          if (t.hits >= t.goal) {
            this.finishPlay();
            return;
          }
        }
        break;
      }

      case 'star': {
        if (!t.held) {
          chaseAt(t.x, t.y, this.cruise() * 1.4);
          if (Math.hypot(m.x - t.x, m.y - t.y) < 32 * this.scale) {
            t.held = true; // got it! carries it somewhere
            this.waypoints = randInt(2, 3);
            this.bubblesToSpawn += 3;
            this.nextExcitedTarget();
          }
        } else {
          this.steer(dt, this.cruise());
          if (this.arrived(40)) {
            if (--this.waypoints > 0) this.nextExcitedTarget();
            else {
              t.held = false; // drops it with a flourish
              t.vx = this.facing * 60;
              t.vy = -30;
              this.spin = 0;
              this.finishPlay();
              return;
            }
          }
        }
        break;
      }

      case 'bubbles': {
        let best: PopBubble | undefined;
        let bd = Infinity;
        for (const b of this.pops) {
          const d = Math.hypot(b.x - this.x, b.y - this.y);
          if (d < bd) {
            bd = d;
            best = b;
          }
        }
        if (best) {
          chaseAt(best.x, best.y, this.cruise() * 1.8);
          if (Math.hypot(m.x - best.x, m.y - best.y) < (22 + best.r) * this.scale) this.popBubble(best, 'pluto');
        } else {
          this.target = { x: t.x, y: t.y + 160 };
          this.steer(dt, this.cruise() * 0.5);
        }
        if (this.stateTime > 18) {
          this.finishPlay();
          return;
        }
        break;
      }
    }

    if (this.stateTime > 40) this.finishPlay(); // never gets stuck on a toy
  }

  private finishPlay(): void {
    this.dispatch({ type: 'TOY_PLAYED', toy: this.toy?.kind });
    // Safety net: if nothing else moved him on (e.g. the toy vanished), don't stay in 'playing'
    if (this.state === 'playing') this.startIdle();
  }

  private onToyPlayed(kind?: ToyKind): void {
    if (!kind) return;
    const fav = this.memory.favoriteToy === kind;
    this.drives.happiness = Math.min(1, this.drives.happiness + (fav ? 0.15 : 0.08));
    this.soothe(fav ? 0.3 : 0.1);

    if (kind === 'bubbles') {
      this.toast(`Bubble chase: you ${this.userPops} · Pluto ${this.plutoPops}`);
      this.userPops = 0;
      this.plutoPops = 0;
    }
    if (this.grudge) {
      this.startSulk(true); // still not fully over it
      return;
    }
    if (this.state === 'excited') return; // forgiveness celebration already running
    if (fav) {
      this.spin = 0;
      this.bubblesToSpawn += 4;
      this.startExcited(2.6);
    } else if (Math.random() < 0.5) {
      this.startExcited(1.5);
    } else {
      this.startIdle();
    }
  }

  /** Tap a toy: flick the ball/star, or move the ring (play together). */
  private touchToy(t: RuntimeToy, p: Vec): void {
    if (t.kind === 'ring') {
      const b = this.bounds();
      t.x = clamp(rand(b.minX + 40, b.maxX - 40), 30, Math.max(30, this.W - 30));
      t.y = rand(this.H * 0.28, this.H * 0.55);
      t.lastSign = Math.sign(this.x - t.x) || 1;
      t.side = (-t.lastSign) as 1 | -1;
      this.bubblesToSpawn += 2;
    } else if (!t.held) {
      const dx = t.x - p.x;
      const dy = t.y - p.y;
      const mag = Math.hypot(dx, dy) || 1;
      t.vx = (dx / mag) * 340;
      t.vy = (dy / mag) * 340 - 60;
    }
    this.gainBond(0.002);
    if (!this.grudge && this.isFree()) this.startPlay();
  }

  /* ---------- Bubble chase (mini game) ---------- */
  private updatePops(dt: number): void {
    const t = this.toy;
    if (t && t.kind === 'bubbles') {
      t.spawnIn -= dt;
      if (t.spawnIn <= 0 && this.pops.length < 7) {
        t.spawnIn = rand(1.1, 2);
        this.spawnPop(t.x + rand(-12, 12), t.y + 12);
      }
    }
    for (let i = this.pops.length - 1; i >= 0; i--) {
      const b = this.pops[i];
      b.life += dt;
      b.y += b.vy * dt;
      b.x += Math.sin(b.life * 2 + b.phase) * 18 * dt;
      if (b.y < this.H * 0.04) {
        b.el.remove(); // got away
        this.pops.splice(i, 1);
        continue;
      }
      this.placePop(b);
    }
  }

  private spawnPop(x: number, y: number): void {
    const r = rand(11, 17);
    const el = document.createElement('span');
    Object.assign(el.style, {
      position: 'absolute',
      left: '0',
      top: '0',
      width: `${r * 2}px`,
      height: `${r * 2}px`,
      borderRadius: '50%',
      border: '2px solid rgba(220, 250, 255, 0.75)',
      background: 'radial-gradient(circle at 30% 25%, rgba(255,255,255,0.8), rgba(150,220,255,0.15) 55%)',
      boxShadow: 'inset 2px 2px 4px rgba(255,255,255,0.4), 0 0 8px rgba(160,230,255,0.35)',
      pointerEvents: 'none',
      zIndex: '5',
    });
    this.parent.appendChild(el);
    const b: PopBubble = { el, x, y, r, vy: -rand(40, 68), phase: rand(0, TAU), life: 0 };
    this.pops.push(b);
    this.placePop(b);
  }

  private placePop(b: PopBubble): void {
    b.el.style.transform = `translate3d(${(b.x - b.r).toFixed(1)}px, ${(b.y - b.r).toFixed(1)}px, 0)`;
  }

  private popBubble(b: PopBubble, by: 'user' | 'pluto'): void {
    const i = this.pops.indexOf(b);
    if (i < 0) return;
    this.pops.splice(i, 1);
    const base = b.el.style.transform;
    b.el.animate(
      [
        { transform: base, opacity: 0.9 },
        { transform: `${base} scale(1.8)`, opacity: 0 },
      ],
      { duration: 220, easing: 'ease-out', fill: 'forwards' },
    ).onfinish = () => b.el.remove();
    if (by === 'user') this.userPops++;
    else {
      this.plutoPops++;
      this.chompT = 0.2;
    }
    this.dispatch({ type: 'BUBBLE_POPPED', toy: 'bubbles', by });
  }

  /* ---------- Hide & seek (mini game) ---------- */
  private startHideGame(): void {
    if (this.grudge) {
      this.toast("Pluto isn't in the mood to play right now… 😒");
      return;
    }
    if (this.state === 'hiding') return;
    const b = this.bounds(1.5);
    this.target = { x: rand(b.minX, b.maxX), y: b.maxY };
    this.zTarget = 0.12;
    this.setState('hiding', 0);
    this.hideGame = { phase: 'go', t: 0, hintIn: 4 };
    this.toast('Pluto is hiding! Tap where you think he is 🙈');
  }

  private updateHiding(dt: number): void {
    const g = this.hideGame;
    g.t += dt;
    if (g.phase === 'go') {
      this.steer(dt, this.cruise() * 1.6);
      if (this.arrived(30) || this.stateTime > 6) {
        g.phase = 'hidden';
        g.t = 0;
      }
      return;
    }
    this.steer(dt, 6, { turn: false, align: false });
    g.hintIn -= dt;
    if (g.hintIn <= 0) {
      g.hintIn = rand(3, 5);
      this.bubblesToSpawn += 1; // a little hint
    }
    if (g.t > 30) {
      this.toast('Pluto popped out: "Here I am!"');
      this.startExcited(1.8);
    }
  }

  /* ========================================================================
     Journal, diary, achievements, toasts
     ======================================================================== */
  private addDiary(text: string): void {
    const d = this.memory.diary;
    if (d.length && d[d.length - 1].text === text) return;
    d.push({ at: Date.now(), text });
    if (d.length > 80) d.shift();
    if (this.panelOpen) this.renderPanel();
  }

  private checkAchievements(): void {
    const m = this.memory;
    let changed = false;
    for (const a of ACHIEVEMENTS) {
      if (m.achievements.includes(a.id) || !a.test(m, this.stageIdx)) continue;
      m.achievements.push(a.id);
      changed = true;
      this.toast(`🏆 ${a.title}`);
      if (a.reward && !m.unlocked.includes(a.reward)) {
        m.unlocked.push(a.reward);
        this.toast(`${OUTFITS[a.reward].emoji} Unlocked: ${OUTFITS[a.reward].label}`);
      }
    }
    if (changed && this.panelOpen) this.renderPanel();
  }

  private toast(msg: string): void {
    this.toastQ.push(msg);
    if (!this.toastBusy) this.nextToast();
  }

  private nextToast(): void {
    const el = this.toastEl;
    if (!el || this.destroyed) {
      this.toastBusy = false;
      return;
    }
    const msg = this.toastQ.shift();
    if (!msg) {
      this.toastBusy = false;
      return;
    }
    this.toastBusy = true;
    el.textContent = msg;
    el.classList.add('show');
    window.setTimeout(() => {
      el.classList.remove('show');
      window.setTimeout(() => this.nextToast(), 350);
    }, 3200);
  }

  private injectStyles(): void {
    if (document.getElementById('pluto-ui-style')) return;
    const s = document.createElement('style');
    s.id = 'pluto-ui-style';
    s.textContent = UI_CSS;
    document.head.appendChild(s);
  }

  private mkBtn(icon: string, label: string, onClick: () => void): HTMLButtonElement {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pluto-btn';
    b.textContent = icon;
    b.title = label;
    b.setAttribute('aria-label', label);
    b.addEventListener('click', onClick);
    return b;
  }

  private createToolbar(): void {
    const bar = document.createElement('div');
    bar.className = 'pluto-bar';
    // Taps on the bar must not drop food in the water
    bar.addEventListener('pointerdown', (e) => e.stopPropagation());

    for (const kind of TOY_KINDS) {
      const b = this.mkBtn(TOYS[kind].emoji, TOYS[kind].label, () => this.toggleToy(kind));
      this.toyBtns.set(kind, b);
      bar.appendChild(b);
    }
    const sep = document.createElement('span');
    sep.className = 'pluto-sep';
    bar.appendChild(sep);
    bar.appendChild(this.mkBtn('🙈', 'Hide and seek', () => this.startHideGame()));
    bar.appendChild(this.mkBtn('📖', "Pluto's journal", () => this.togglePanel()));

    this.parent.appendChild(bar);
    this.bar = bar;
    this.refreshToolbar();
  }

  private refreshToolbar(): void {
    this.toyBtns.forEach((b, kind) => b.classList.toggle('on', this.toy?.kind === kind));
  }

  private createToast(): void {
    const el = document.createElement('div');
    el.className = 'pluto-toast';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    this.parent.appendChild(el);
    this.toastEl = el;
    if (!this.toastBusy) this.nextToast(); // anything queued before the UI existed
  }

  private createPanel(): void {
    const el = document.createElement('div');
    el.className = 'pluto-panel';
    el.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.parent.appendChild(el);
    this.panel = el;
  }

  private togglePanel(open = !this.panelOpen): void {
    this.panelOpen = open;
    if (open) this.renderPanel();
    this.panel?.classList.toggle('open', open);
  }

  private setOutfit(o: Outfit): void {
    if (o !== 'none' && !this.memory.unlocked.includes(o)) return;
    this.outfit = o;
    this.host.nativeElement.dataset['outfit'] = o;
    if (o !== 'none') this.bubblesToSpawn += 3;
    this.emit();
  }

  private personality(): string[] {
    const tp = this.temper;
    const out: string[] = [];
    if (tp.playful > 0.55) out.push('Playful');
    if (tp.curious > 0.55) out.push('Curious');
    if (tp.sleepy > 0.55) out.push('Sleepy');
    if (this.stageIdx >= 2) out.push('Affectionate');
    if (this.memory.growthStage === 'grown') out.unshift('Graceful');
    if (!out.length) out.push('Easygoing');
    return out;
  }

  private favoriteTime(): string | null {
    const c = this.memory.todCounts;
    const keys = Object.keys(c) as TimeOfDay[];
    if (keys.reduce((s, k) => s + c[k], 0) < 10) return null;
    return TIME_LABEL[keys.reduce((a, b) => (c[b] > c[a] ? b : a))];
  }

  private renderPanel(): void {
    const p = this.panel;
    if (!p) return;
    const m = this.memory;
    const days = Math.max(1, Math.floor((Date.now() - m.firstSeen) / 864e5) + 1);
    const stage = this.stage[0].toUpperCase() + this.stage.slice(1);
    const undecided = 'Still deciding…';
    const favFood = m.favoriteFood ? FOODS[m.favoriteFood].label : undecided;
    const favToy = m.favoriteToy ? `${TOYS[m.favoriteToy].emoji} ${TOYS[m.favoriteToy].label}` : undecided;
    const own = m.namedToy ? TOYS[m.namedToy].own : '—';
    const date = (at: number) => new Date(at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

    const row = (k: string, v: string | number) => `<div class="pp-row"><span>${k}</span><span>${v}</span></div>`;
    const wardrobe = OUTFIT_KINDS.map((o) => {
      const ok = o === 'none' || m.unlocked.includes(o);
      return `<button type="button" class="pp-chip${this.outfit === o ? ' on' : ''}" data-outfit="${o}"${
        ok ? '' : ' disabled'
      }>${ok ? OUTFITS[o].emoji : '🔒'} ${OUTFITS[o].label}</button>`;
    }).join('');
    const envs = (Object.keys(ENVIRONMENTS) as Environment[])
      .map((e) => {
        const ok = e === 'tank' || m.environments.includes(e);
        return `<button type="button" class="pp-chip${this.environment === e ? ' on' : ''}" data-environment="${e}"${
          ok ? '' : ' disabled'
        }>${ok ? ENVIRONMENTS[e].emoji : '🔒'} ${ENVIRONMENTS[e].label}</button>`;
      })
      .join('');
    const gi = GROWTH_INFO[m.growthStage];
    const ach = ACHIEVEMENTS.map((a) => {
      const got = m.achievements.includes(a.id);
      return `<li class="pp-ach${got ? ' got' : ''}" title="${a.desc}">${got ? '🏆' : '🔒'} ${a.title}</li>`;
    }).join('');
    const diary = m.diary.length
      ? m.diary
          .slice(-15)
          .reverse()
          .map((d) => `<li><span class="pp-date">${date(d.at)}</span>“${d.text}”</li>`)
          .join('')
      : '<li class="pp-empty">Nothing yet. Pluto will write here as you spend time together.</li>';

    p.innerHTML = `
      <div class="pp-head"><h3>🐟 Pluto</h3><button type="button" class="pp-close" aria-label="Close journal">×</button></div>
      ${row('Mood', MOOD_LABEL[this.mood])}
      ${row('Relationship', stage)}
      ${row('Growth', `${gi.emoji} ${gi.label}`)}
      ${row('Personality', this.personality().join(' • '))}
      ${row('Days together', days)}
      <h4>Favourites</h4>
      ${row('Food', favFood)}
      ${row('Toy', favToy)}
      ${row('His own toy', own)}
      ${row('Time of day', this.favoriteTime() ?? undecided)}
      <h4>Together so far</h4>
      ${row('Meals shared', m.timesFed)}
      ${row('Pets', m.timesPetted)}
      ${row('Toy sessions', TOY_KINDS.reduce((s, k) => s + m.toyCounts[k], 0))}
      ${row('Bubbles you popped', m.bubblesPopped)}
      ${row('Hide & seek wins', m.hideWins)}
      ${row('Discoveries', m.discoveries)}
      <h4>Wardrobe</h4>
      <div class="pp-chips">${wardrobe}</div>
      <h4>Aquarium</h4>
      <div class="pp-chips">${envs}</div>
      ${row('Decorations', m.decorations.length ? m.decorations.map((d) => DECORATIONS[d].emoji).join(' ') : '—')}
      <h4>Achievements</h4>
      <ul>${ach}</ul>
      <h4>Pluto's diary</h4>
      <ul>${diary}</ul>`;

    p.querySelector('.pp-close')?.addEventListener('click', () => this.togglePanel(false));
    p.querySelectorAll<HTMLButtonElement>('[data-outfit]').forEach((b) =>
      b.addEventListener('click', () => {
        this.setOutfit(b.dataset['outfit'] as Outfit);
        this.renderPanel();
      }),
    );
    p.querySelectorAll<HTMLButtonElement>('[data-environment]').forEach((b) =>
      b.addEventListener('click', () => {
        this.setEnvironment(b.dataset['environment'] as Environment);
        this.renderPanel();
      }),
    );
  }

  /* ========================================================================
     World: time of day, rhythm, objects, tray, save timer
     ======================================================================== */
  private hourNow(): number {
    if (this.hourOverride !== null) return this.hourOverride;
    const d = new Date();
    return d.getHours() + d.getMinutes() / 60;
  }

  private updateWorld(dt: number): void {
    this.todIn -= dt;
    if (this.todIn <= 0) {
      this.todIn = 20;
      this.tod = timeOfDay(this.hourNow());
      this.host.nativeElement.dataset['time'] = this.tod;
    }

    this.objSpawnIn -= dt;
    if (this.objSpawnIn <= 0) {
      this.objSpawnIn = rand(240, 480);
      this.spawnObject();
    }

    this.trayIn -= dt;
    if (this.trayIn <= 0) {
      this.trayIn = 0.5;
      this.refreshTray();
    }

    this.saveIn -= dt;
    if (this.saveIn <= 0) {
      this.saveIn = 5;
      this.save();
    }

    // Passive growth is banked every frame and applied in small steps
    this.growIn -= dt;
    if (this.growIn <= 0) {
      this.growIn = 2;
      this.gainGrowth(this.growthAcc);
      this.growthAcc = 0;
    }

    if (this.greetIn > 0) {
      this.greetIn -= dt;
      if (this.greetIn <= 0) this.greet();
    }

    if (this.playIn > 0) {
      this.playIn -= dt;
      if (this.playIn <= 0 && !this.tryPlay()) this.playIn = 1.2; // busy: ask again shortly
    }
  }

  private createWash(): void {
    const el = document.createElement('div');
    Object.assign(el.style, {
      position: 'absolute',
      inset: '0',
      pointerEvents: 'none',
      zIndex: '8',
      opacity: String(this.wash),
      background:
        'linear-gradient(to bottom, rgba(4, 10, 40, 0.85), rgba(2, 6, 28, 0.95))',
      mixBlendMode: 'multiply',
    });
    this.parent.appendChild(el);
    this.washEl = el;
    this.lastWash = this.wash;
  }

  /* ---------- objects (shell, pearl) ---------- */
  private spawnObject(): void {
    if (this.objects.length >= MAX_OBJECTS || !this.W) return;
    let fx = rand(0.08, 0.92);
    for (let i = 0; i < 10 && this.objects.some((o) => Math.abs(o.fx - fx) < 0.1); i++) {
      fx = rand(0.08, 0.92);
    }
    const obj = this.addObject({
      id: `obj-${Date.now().toString(36)}-${randInt(0, 999)}`,
      kind: Math.random() < 0.6 ? 'shell' : 'pearl',
      fx,
      discovered: false,
      visits: 0,
    });
    // fade in so it feels like it "washed in"
    obj.el.style.opacity = '0';
    requestAnimationFrame(() => (obj.el.style.opacity = '1'));
  }

  private addObject(o: WorldObject): RuntimeObject {
    const el = document.createElement('span');
    const shell = o.kind === 'shell';
    Object.assign(el.style, {
      position: 'absolute',
      left: '0',
      top: '0',
      width: shell ? '26px' : '11px',
      height: shell ? '20px' : '11px',
      pointerEvents: 'none',
      zIndex: '5',
      transition: 'opacity 1.4s ease',
      ...(shell
        ? {
            background:
              'repeating-conic-gradient(from -50deg at 50% 100%, #ffe3d2 0deg 11deg, #eea386 11deg 22deg)',
            borderRadius: '60% 60% 18% 18% / 100% 100% 12% 12%',
            boxShadow: '0 3px 4px rgba(0,0,0,0.35), inset 0 2px 3px rgba(255,255,255,0.35)',
          }
        : {
            background: 'radial-gradient(circle at 32% 28%, #ffffff, #e9d9ee 55%, #b9a3c9)',
            borderRadius: '50%',
            boxShadow: '0 0 8px rgba(255,255,255,0.55), 0 2px 3px rgba(0,0,0,0.35)',
          }),
    });
    this.parent.appendChild(el);
    const obj: RuntimeObject = { ...o, el };
    this.objects.push(obj);
    if (this.W) this.placeObjects();
    return obj;
  }

  private objectBottom(): number {
    return this.floorY + this.seabedH * OBJECT_SINK;
  }

  private objPos(o: RuntimeObject): Vec {
    const h = o.kind === 'shell' ? 20 : 11;
    return { x: o.fx * this.W, y: this.objectBottom() - h / 2 };
  }

  private placeObjects(): void {
    for (const o of this.objects) {
      const w = o.kind === 'shell' ? 26 : 11;
      const h = o.kind === 'shell' ? 20 : 11;
      o.el.style.left = `${o.fx * this.W - w / 2}px`;
      o.el.style.top = `${this.objectBottom() - h}px`;
    }
    this.placeDecorations();
  }

  /* ---------- decorations and environments (unlocked by growth) ---------- */
  private syncDecorations(fade = false): void {
    for (const id of this.memory.decorations) {
      const spec = DECORATIONS[id];
      if (!spec || this.decoEls.has(id)) continue;
      const el = document.createElement('span');
      el.textContent = spec.emoji;
      Object.assign(el.style, {
        position: 'absolute',
        left: '0',
        top: '0',
        fontSize: `${spec.size}px`,
        lineHeight: '1',
        pointerEvents: 'none',
        // the lantern sits above the night wash (z 8) so it keeps glowing in the dark
        zIndex: id === 'lantern' ? '9' : '3',
        filter:
          id === 'lantern'
            ? 'drop-shadow(0 0 10px rgba(255,190,90,0.9))'
            : 'drop-shadow(0 3px 3px rgba(0,0,0,0.3))',
        transition: 'opacity 2s ease',
        opacity: fade ? '0' : '1',
      });
      this.parent.appendChild(el);
      this.decoEls.set(id, el);
      if (fade) requestAnimationFrame(() => requestAnimationFrame(() => (el.style.opacity = '1')));
    }
    this.placeDecorations();
  }

  private placeDecorations(): void {
    this.decoEls.forEach((el, id) => {
      const s = DECORATIONS[id];
      el.style.left = `${s.fx * this.W - s.size / 2}px`;
      el.style.top = `${this.objectBottom() - s.size * 0.92}px`;
    });
  }

  private createEnvironment(): void {
    const el = document.createElement('div');
    el.className = 'pluto-env';
    el.dataset['env'] = this.environment;
    this.parent.appendChild(el);
    this.envEl = el;
  }

  private setEnvironment(e: Environment): void {
    if (e !== 'tank' && !this.memory.environments.includes(e)) return;
    this.environment = e;
    if (this.envEl) this.envEl.dataset['env'] = e;
    this.bubblesToSpawn += 3;
    this.save();
  }

  /* ---------- food tray (tiny, bottom centre) ---------- */
  private createTray(): void {
    const tray = document.createElement('div');
    Object.assign(tray.style, {
      position: 'absolute',
      left: '50%',
      bottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
      transform: 'translateX(-50%)',
      display: 'flex',
      gap: '10px',
      padding: '6px 12px',
      borderRadius: '999px',
      background: 'rgba(2, 30, 45, 0.35)',
      backdropFilter: 'blur(6px)',
      zIndex: '30',
      pointerEvents: 'auto',
    });
    // Don't let taps on the tray drop food in the water
    tray.addEventListener('pointerdown', (e) => e.stopPropagation());

    for (const kind of FOOD_KINDS) {
      const spec = FOODS[kind];
      const b = document.createElement('button');
      b.type = 'button';
      b.title = spec.label;
      b.setAttribute('aria-label', `Feed ${spec.label}`);
      Object.assign(b.style, {
        width: '22px',
        height: '22px',
        borderRadius: '50%',
        border: '0',
        padding: '0',
        cursor: 'pointer',
        background: spec.fill,
        boxShadow: `0 0 6px ${spec.glow}`,
        transition: 'opacity 0.3s ease, outline-color 0.2s ease',
        outline: '2px solid transparent',
        outlineOffset: '2px',
      });
      b.addEventListener('click', () => {
        this.foodKind = kind;
        this.refreshTray();
      });
      tray.appendChild(b);
      this.trayButtons.set(kind, b);
    }
    this.parent.appendChild(tray);
    this.tray = tray;
    this.refreshTray();
  }

  private treatReady(): boolean {
    return this.t - this.lastTreatAt >= TREAT_COOLDOWN;
  }

  private refreshTray(): void {
    this.trayButtons.forEach((b, kind) => {
      b.style.outlineColor = kind === this.foodKind ? 'rgba(255,255,255,0.85)' : 'transparent';
      b.style.opacity = kind === 'treat' && !this.treatReady() ? '0.3' : '1';
    });
  }

  /* ========================================================================
     Drives and mood
     ======================================================================== */
  private updateDrives(dt: number): void {
    const d = this.drives;
    const r = RHYTHM[this.tod];
    const tp = this.temper;
    const night = this.tod === 'night';

    const energyRate =
      this.state === 'resting'
        ? night
          ? 0.035
          : 0.07
        : this.state === 'idle'
          ? 0.012
          : this.state === 'excited'
            ? -0.02
            : this.state === 'exploring' || this.state === 'investigating'
              ? -0.006
              : this.state === 'sulking' || this.state === 'hiding'
                ? -0.004
                : -0.012;
    const hungerDrain = d.hunger > 0.8 ? -0.004 : 0;

    d.energy = clamp(d.energy + (energyRate + (this.state === 'resting' ? 0 : r.energy) + hungerDrain) * dt, 0, 1);
    d.curiosity = clamp(d.curiosity + 0.018 * (0.6 + tp.curious * 0.8) * dt, 0, 1);

    // Hunger rises slowly; being full is also a (very) small drag on happiness
    d.hunger = clamp(d.hunger + (this.state === 'resting' ? 0.0012 : 0.003) * dt, 0, 1);
    this.overfed = Math.max(0, this.overfed - 0.01 * dt);

    // Happiness drifts towards a baseline shaped by hunger, friendship and grudges
    const base = 0.5 - Math.max(0, d.hunger - 0.6) * 0.4 + this.stageIdx * 0.03 - this.annoyance * 0.3;
    d.happiness += (base - d.happiness) * 0.01 * dt;

    const userPresent = this.t - this.pointer.lastMove < 90;
    const stageBoost = (1 + this.stageIdx * 0.35) * this.prof.attention;
    if (userPresent) d.attention = clamp(d.attention + 0.011 * stageBoost * dt, 0, 1);
    else if (this.stageIdx >= 1 && Date.now() - this.memory.lastInteraction > 180_000) {
      d.attention = clamp(d.attention + 0.004 * stageBoost * dt, 0, 1); // misses you
    }

    // Being ignored for a long time while begging: a very slow build-up of grumpiness
    if (userPresent && d.attention > 0.95 && this.stageIdx >= 1 && !this.grudge) this.annoy(0.003 * dt);

    // Cooling off. Giving him space (no mouse movement) is the fastest way.
    const quiet = this.t - this.pointer.lastMove > 6;
    const decay = this.grudge ? (quiet ? 0.012 : 0.005) : 0.006;
    this.annoyance = Math.max(0, this.annoyance - decay * dt);
    if (this.grudge && this.annoyance < FORGIVE_AT) this.forgive();

    this.exciteLevel = this.state === 'excited' ? 1 : Math.max(0, this.exciteLevel - dt * 1.5);
    this.chompT = Math.max(0, this.chompT - dt);
    if (this.foraging && Math.random() < dt * 0.4) this.chompT = 0.35;

    // Passive growth: only when cared for (fed, happy, not sulking); faster while asleep
    const care = clamp(0.4 + d.happiness * 0.8 - Math.max(0, d.hunger - 0.75) * 2 - this.annoyance * 0.5, 0, 1.2);
    this.growthAcc += GROWTH_PER_SECOND * care * (this.state === 'resting' ? 1.5 : 1) * dt;
  }

  private updateMood(): void {
    const d = this.drives;
    const night = this.tod === 'night';
    let m: PlutoMood = 'calm';
    if (this.state === 'sulking') m = 'sulking';
    else if (this.annoyance > ANNOYED_AT) m = 'annoyed';
    else if (d.energy < 0.25 || (night && d.energy < 0.45)) m = 'sleepy';
    else if (d.attention > 0.8) m = 'attention-seeking';
    else if (d.happiness > 0.75 && d.energy > 0.5) m = 'playful';
    else if (d.curiosity > 0.7) m = 'curious';

    if (m !== this.mood) {
      this.mood = m;
      this.host.nativeElement.dataset['mood'] = m;
      this.emit();
      if (this.panelOpen) this.renderPanel();
    }
  }

  private moodSpeed(): number {
    const base =
      this.mood === 'playful'
        ? 1.35
        : this.mood === 'sleepy'
          ? 0.6
          : this.mood === 'attention-seeking'
            ? 1.2
            : this.mood === 'annoyed'
              ? 0.9
              : this.mood === 'sulking'
                ? 0.45
                : 1;
    return base * RHYTHM[this.tod].speed * (0.9 + this.temper.playful * 0.25) * this.prof.speed;
  }

  private cruise(): number {
    return 140 * this.moodSpeed() * this.motion * clamp(this.W / 1400, 0.55, 1.5);
  }

  private accel(): number {
    return (
      (this.state === 'excited' ? 460 : 240) *
      (this.mood === 'sleepy' ? 0.7 : 1) *
      this.motion *
      this.prof.accel *
      (this.burst > 1 ? 2 : 1)
    );
  }

  /* ========================================================================
     Behaviour state machine
     ======================================================================== */
  private setState(next: PlutoState, duration: number, emit = true): void {
    const changed = next !== this.state;
    this.state = next;
    this.stateTime = 0;
    this.stateDuration = duration;
    this.arrival = undefined;
    this.foraging = false;
    this.chase = false;
    this.inv = undefined;
    this.burst = 1;
    if (changed && emit) this.emit();
  }

  private emit(): void {
    this.zone.run(() => this.stateChange.emit(this.getSnapshot()));
  }

  private updateBehaviour(dt: number): void {
    this.watchPointer(dt);
    this.watchFood();

    switch (this.state) {
      case 'idle':
        this.steer(dt, 25, { turn: false, align: false });
        if (this.stateTime >= this.stateDuration) this.decideNext();
        break;

      case 'swimming':
        this.steer(dt, this.cruise() * this.burst);
        if (this.arrived(14)) {
          const done = this.arrival;
          this.arrival = undefined;
          if (done) done();
          else this.startIdle();
        } else if (this.stateTime > 15) {
          this.startIdle();
        }
        break;

      case 'exploring':
        this.steer(dt, this.cruise() * (this.foraging ? 0.5 : 0.38));
        if (this.arrived(14)) {
          if (--this.waypoints > 0) this.nextWaypoint();
          else this.startIdle();
        } else if (this.stateTime > 20) {
          this.startIdle();
        }
        break;

      case 'resting': {
        this.steer(dt, 45);
        const wakeAt = this.tod === 'night' ? 1.1 : 0.95; // at night he sleeps it out
        if (this.stateTime >= this.stateDuration || this.drives.energy > wakeAt) this.startIdle();
        break;
      }

      case 'curious':
        this.updateCurious(dt);
        break;

      case 'feeding':
        this.updateFeeding(dt);
        break;

      case 'investigating':
        this.updateInvestigating(dt);
        break;

      case 'playing':
        this.updatePlaying(dt);
        break;

      case 'sulking':
        this.updateSulking(dt);
        break;

      case 'hiding':
        this.updateHiding(dt);
        break;

      case 'excited':
        this.steer(dt, this.cruise() * 2.1);
        if (this.chase && this.pointer.active) this.chaseTarget();
        else if (this.arrived(24)) this.nextExcitedTarget();
        if (this.stateTime >= this.stateDuration) this.startIdle();
        break;
    }
  }

  private decideNext(): void {
    const d = this.drives;
    const tp = this.temper;
    const r = RHYTHM[this.tod];

    // Attention-seeking, or a hungry friend who "asks" for food
    if (d.attention > 0.85 || (d.hunger > 0.8 && this.stageIdx >= 2 && Math.random() < 0.5)) {
      this.startAttentionSeeking();
      return;
    }

    const options: Array<[() => void, number]> = [
      [() => this.startSwim(), (2 + d.energy * 2.5) * (0.7 + tp.playful * 0.6) * this.prof.playful],
      [() => this.startExplore(), (0.8 + d.curiosity * 3) * (0.6 + tp.curious * 0.8) * this.prof.curious],
      [
        () => this.startRest(),
        (Math.max(0, 0.55 - d.energy) * 12 + 0.25) * (0.6 + tp.sleepy * 0.8) * r.rest,
      ],
    ];

    if (d.hunger > 0.55) options.push([() => this.startForage(), (d.hunger - 0.5) * 14]);

    // A toy in the water: he's drawn to it, more so if he likes it (but still swims about naturally)
    const toy = this.toy;
    if (toy) {
      const fav = this.memory.favoriteToy === toy.kind ? 2 : 0;
      options.push([() => this.startPlay(), 0.8 + tp.toyTaste[toy.kind] * 2 + fav]);
    }

    // New objects are exciting; known ones become favourite spots
    const fresh = this.objects.filter((o) => !o.discovered);
    if (fresh.length) {
      const o = fresh[randInt(0, fresh.length - 1)];
      options.push([() => this.startInvestigate(o), 1 + d.curiosity * 4]);
    }
    const known = this.objects.filter((o) => o.discovered && o.visits > 0);
    if (known.length) {
      const fav = known.reduce((a, b) => (b.visits > a.visits ? b : a));
      options.push([
        () => this.startInvestigate(fav),
        Math.min(2.5, fav.visits * 0.35) * (0.5 + d.curiosity),
      ]);
    }

    // Unlocked by growth: young fish dart, grown fish glide and blow bubble rings
    const gi = GROWTH_STAGES.indexOf(this.memory.growthStage);
    if (gi >= 1 && d.energy > 0.5) {
      options.push([() => this.startDart(), (d.energy - 0.4) * 3 * (0.6 + tp.playful)]);
    }
    if (gi >= 2) {
      options.push([() => this.startGlide(), 1.2 * (0.6 + tp.curious * 0.6)]);
      if (this.stageIdx >= 1) options.push([() => this.startRingBlow(), 0.5 + d.happiness]);
    }

    let roll = Math.random() * options.reduce((sum, o) => sum + o[1], 0);
    for (const [fn, weight] of options) {
      roll -= weight;
      if (roll <= 0) {
        fn();
        return;
      }
    }
    options[0][0]();
  }

  private startIdle(): void {
    if (this.grudge) {
      this.startSulk(true); // whatever just ended, he's still cross
      return;
    }
    this.target = { x: this.x + this.vx * 0.35, y: this.y + this.vy * 0.35 };
    const long = Math.random() < 0.4;
    this.setState('idle', long ? rand(2.5, 5) : rand(0.6, 1.5));
  }

  private startSwim(): void {
    const b = this.bounds();
    const minDist = Math.min(this.W * 0.25, 280);
    let tx = this.x;
    let ty = this.y;
    for (let i = 0; i < 12; i++) {
      if (Math.random() < 0.3) {
        tx = clamp(this.x + rand(-140, 140), b.minX, b.maxX);
        ty = rand(b.minY, b.maxY);
      } else {
        tx = rand(b.minX, b.maxX);
        ty =
          Math.random() < 0.7
            ? clamp(this.y + rand(-90, 90), b.minY, b.maxY)
            : rand(b.minY, b.maxY);
      }
      if (Math.hypot(tx - this.x, ty - this.y) >= minDist) break;
    }
    this.target = { x: tx, y: ty };
    this.zTarget = rand(0.15, 1);
    this.setState('swimming', 0);
  }

  /** Young+: a fast zig-zag burst across the tank. */
  private startDart(): void {
    const b = this.bounds();
    const dir = Math.random() < 0.5 ? -1 : 1;
    this.target = {
      x: clamp(this.x + dir * this.W * rand(0.35, 0.6), b.minX, b.maxX),
      y: clamp(this.y + rand(-80, 80), b.minY, b.maxY),
    };
    this.zTarget = clamp(this.z + rand(-0.2, 0.2), 0.3, 1);
    this.setState('swimming', 0);
    this.burst = 2.3;
    this.bubblesToSpawn += 3;
    this.drives.energy = Math.max(0, this.drives.energy - 0.05);
  }

  /** Grown: a slow, elegant sweep across the whole tank. */
  private startGlide(): void {
    const b = this.bounds();
    const toLeft = this.x > this.W / 2;
    this.target = {
      x: clamp(toLeft ? this.W * 0.1 : this.W * 0.9, b.minX, b.maxX),
      y: rand(b.minY + (b.maxY - b.minY) * 0.25, b.minY + (b.maxY - b.minY) * 0.6),
    };
    this.zTarget = rand(0.5, 0.9);
    this.setState('swimming', 0);
    this.burst = 0.6;
  }

  /** Grown: pauses and blows a ring of bubbles. */
  private startRingBlow(): void {
    this.setState('idle', 2.4);
    this.chompT = 0.5;
    this.blowRing();
    window.setTimeout(() => {
      if (!this.destroyed && this.state === 'idle') this.blowRing();
    }, 900);
  }

  private blowRing(): void {
    const m = this.mouthWorld();
    const fs = this.flipSign();
    const n = 10;
    const R = 20 * this.scale;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      this.emitBubble({ x: m.x + fs * 28 * this.scale + Math.cos(a) * R * 0.45, y: m.y + Math.sin(a) * R }, 6);
    }
  }

  private startExplore(): void {
    this.waypoints = randInt(2, 4);
    this.drives.curiosity = Math.max(0, this.drives.curiosity - 0.45);
    this.zTarget = clamp(this.z + rand(-0.2, 0.2), 0.15, 1);
    this.setState('exploring', 0);
    this.nextWaypoint();
  }

  /** Hungry: pokes around near the sand, chomping at nothing. */
  private startForage(): void {
    this.waypoints = randInt(3, 5);
    this.zTarget = rand(0.5, 0.85);
    this.setState('exploring', 0);
    this.foraging = true;
    this.nextWaypoint();
  }

  private nextWaypoint(): void {
    const b = this.bounds();
    if (this.foraging) {
      this.target = {
        x: clamp(this.x + rand(-240, 240), b.minX, b.maxX),
        y: rand(b.minY + (b.maxY - b.minY) * 0.55, b.maxY),
      };
      return;
    }
    const a = rand(0, TAU);
    const r = rand(80, 220);
    this.target = {
      x: clamp(this.x + Math.cos(a) * r, b.minX, b.maxX),
      y: clamp(this.y + Math.sin(a) * r * 0.6, b.minY, b.maxY),
    };
  }

  private startRest(): void {
    const b = this.bounds();
    this.target = {
      x: clamp(this.x + rand(-160, 160), b.minX, b.maxX),
      y: b.minY + (b.maxY - b.minY) * rand(0.7, 1),
    };
    this.zTarget = rand(0.2, 0.45);
    this.setState('resting', rand(7, 12) * (this.tod === 'night' ? 2.5 : 1) * this.prof.rest);
    this.dispatch({ type: 'PLUTO_RESTED' });
  }

  private startAttentionSeeking(): void {
    const b = this.bounds();
    this.zTarget = 0.95;
    this.target = {
      x: clamp(rand(this.W * 0.35, this.W * 0.65), b.minX, b.maxX),
      y: clamp(rand(this.H * 0.3, this.H * 0.5), b.minY, b.maxY),
    };
    this.setState('swimming', 0);
    this.arrival = () => {
      this.drives.attention = 0.1;
      this.startExcited(2.2);
    };
  }

  private startExcited(duration: number): void {
    this.setState('excited', duration);
    this.exciteLevel = 1;
    this.vy -= 80;
    this.drives.happiness = Math.min(1, this.drives.happiness + 0.15);
    this.drives.attention = 0;
    this.bubblesToSpawn += 4;
    this.nextExcitedTarget();
  }

  private nextExcitedTarget(): void {
    const b = this.bounds();
    const a = rand(0, TAU);
    const r = rand(120, 260);
    this.target = {
      x: clamp(this.x + Math.cos(a) * r, b.minX, b.maxX),
      y: clamp(this.y + Math.sin(a) * r * 0.5, b.minY, b.maxY),
    };
    this.zTarget = clamp(this.z + rand(-0.1, 0.15), 0.3, 1);
  }

  /** Double-tap play: he chases your cursor around. */
  private chaseTarget(): void {
    const b = this.bounds();
    const side = this.x >= this.pointer.x ? 1 : -1;
    this.target = {
      x: clamp(this.pointer.x + side * 70 * this.scale, b.minX, b.maxX),
      y: clamp(this.pointer.y, b.minY, b.maxY),
    };
  }

  private arrived(radius: number): boolean {
    return Math.hypot(this.target.x - this.x, this.target.y - this.y) < radius;
  }

  /* ========================================================================
     Investigating objects
     ======================================================================== */
  private startInvestigate(obj: RuntimeObject): void {
    this.zTarget = 0.7;
    this.setState('investigating', 0);
    this.inv = { obj, hold: 0, holdFor: rand(3, 5) };
  }

  private updateInvestigating(dt: number): void {
    const inv = this.inv;
    if (!inv || !this.objects.includes(inv.obj)) {
      this.startIdle();
      return;
    }
    const k = this.unit();
    const p = this.objPos(inv.obj);
    const b = this.bounds(0.5);
    const off = MOUTH.x * k * 0.7;
    const dx = p.x - this.x;
    if (Math.abs(dx) > off && Math.sign(dx) !== this.facing && this.turnCooldown <= 0) {
      this.turnTo(Math.sign(dx) as 1 | -1);
    }
    this.target = {
      x: clamp(p.x - this.facing * off, b.minX, b.maxX),
      y: clamp(p.y - this.hostH * this.scale * 0.28, b.minY, b.maxY),
    };
    this.steer(dt, this.cruise() * 0.8, { turn: false, align: false });

    if (this.arrived(34 * this.scale)) {
      if (inv.hold === 0) this.bubblesToSpawn += 2;
      inv.hold += dt;
      if (Math.random() < dt * 0.5) this.chompT = 0.3; // little nibble / poke
      if (inv.hold >= inv.holdFor) this.finishInvestigate(inv.obj);
    } else if (this.stateTime > 25) {
      this.startIdle();
    }
  }

  private finishInvestigate(o: RuntimeObject): void {
    const first = !o.discovered;
    o.visits++;
    o.discovered = true;
    const d = this.drives;
    d.curiosity = Math.max(0, d.curiosity - (first ? 0.5 : 0.25));
    d.happiness = Math.min(1, d.happiness + (first ? 0.08 : 0.03));
    this.bubblesToSpawn += first ? 6 : 2;
    if (first) this.dispatch({ type: 'PLUTO_DISCOVERED', objectId: o.id });
    this.startIdle();
  }

  /* ========================================================================
     Pointer
     ======================================================================== */
  private noticeRadius(): number {
    const m = [1, 1.15, 1.6, 2.2][this.stageIdx];
    return Math.max(240, this.hostW * this.scale * 1.1) * m * this.prof.follow;
  }

  private watchPointer(dt: number): void {
    const p = this.pointer;
    if (p.nearTime < 0) p.nearTime = Math.min(0, p.nearTime + dt);

    const active = p.active && this.t - p.lastMove < 2.5;
    if (!active) {
      p.nearTime = Math.min(p.nearTime, 0);
      return;
    }
    const dist = Math.hypot(p.x - this.x, p.y - this.y);
    if (dist < this.noticeRadius()) {
      p.nearTime += dt;
      this.memory.totalPlayTime += dt;
      this.gainBond(this.grudge ? 0 : 0.0004 * dt);
    } else if (p.nearTime > 0) p.nearTime = Math.max(0, p.nearTime - dt);

    const need = [1.8, 1.5, 0.8, 0.3][this.stageIdx] / this.prof.follow;
    const awake = this.mood !== 'sleepy' || this.stageIdx >= 3;
    if (p.nearTime > need && this.isFree() && awake) this.startCurious();
  }

  private startCurious(): void {
    this.curiousGone = 0;
    this.drives.curiosity = 0.1;
    this.zTarget = 0.85;
    this.pointer.nearTime = 0;
    this.setState('curious', rand(5, 8) + this.stageIdx * 1.5);
  }

  private updateCurious(dt: number): void {
    const p = this.pointer;
    const gone = !p.active || this.t - p.lastMove > 2.5;
    this.curiousGone = gone ? this.curiousGone + dt : 0;
    const far = Math.hypot(p.x - this.x, p.y - this.y) > this.noticeRadius() * 2.2;

    if (this.stateTime > this.stateDuration || this.curiousGone > 1.2 || far) {
      p.nearTime = -4;
      this.startIdle();
      return;
    }
    const b = this.bounds();
    const side = this.x >= p.x ? 1 : -1;
    const gap = (this.stageIdx >= 3 ? 100 : 140) * this.scale;
    this.target = {
      x: clamp(p.x + side * gap, b.minX, b.maxX),
      y: clamp(p.y - 10, b.minY, b.maxY),
    };
    this.steer(dt, this.cruise() * 0.7);
  }

  private onPointerMove = (e: PointerEvent): void => {
    const wasIdle = !this.pointer.active || this.t - this.pointer.lastMove > 8;
    const p = this.localPoint(e);
    this.pointer.x = p.x;
    this.pointer.y = p.y;
    this.pointer.active = true;
    this.pointer.lastMove = this.t;

    if (this.returnedPending) {
      this.returnedPending = false;
      this.dispatch({ type: 'USER_RETURNED' });
    } else if (wasIdle) {
      this.dispatch({ type: 'USER_HOVER' });
    }
  };

  private onPointerLeave = (): void => {
    this.pointer.active = false;
  };

  private onPointerDown = (e: PointerEvent): void => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const p = this.localPoint(e);
    this.pointer.x = p.x;
    this.pointer.y = p.y;
    this.pointer.lastMove = this.t;

    if (this.returnedPending) {
      this.returnedPending = false;
      this.dispatch({ type: 'USER_RETURNED' });
    }

    // 1. Pop a bubble
    for (const b of this.pops) {
      if (Math.hypot(p.x - b.x, p.y - b.y) < b.r + 14) {
        this.popBubble(b, 'user');
        return;
      }
    }
    // 2. Flick / move a toy
    const toy = this.toy;
    if (toy && toy.kind !== 'bubbles' && Math.hypot(p.x - toy.x, p.y - toy.y) < TOYS[toy.kind].h / 2 + 10) {
      this.touchToy(toy, p);
      return;
    }

    // Baby Pluto is tiny, so keep a usable tap target
    const hit = Math.hypot(p.x - this.x, p.y - this.y) < Math.max(this.hostW * this.scale * 0.4, 44);

    // 3. Hide & seek: tapping him wins the round
    if (this.state === 'hiding') {
      if (hit) this.dispatch({ type: 'HIDE_FOUND' });
      return;
    }

    // 4. Pet / play, or drop food
    if (hit) {
      const dbl = this.t - this.lastHitAt < 0.4;
      this.lastHitAt = this.t;
      this.dispatch({ type: dbl ? 'USER_PLAY' : 'USER_PET' });
    } else {
      this.dropFood(p.x, p.y);
    }
  };

  private localPoint(e: PointerEvent): Vec {
    const r = this.parent.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  /* ========================================================================
     Feeding
     ======================================================================== */
  private dropFood(px: number, py: number): void {
    if (this.foods.length >= 6 || this.t - this.lastFoodAt < 0.12) return;
    const kind = this.foodKind;
    if (kind === 'treat') {
      if (!this.treatReady()) return;
      this.lastTreatAt = this.t;
      this.refreshTray();
    }
    this.lastFoodAt = this.t;
    const spec = FOODS[kind];

    const el = document.createElement('span');
    Object.assign(el.style, {
      position: 'absolute',
      left: '0',
      top: '0',
      width: `${spec.size}px`,
      height: `${spec.size}px`,
      borderRadius: '50%',
      pointerEvents: 'none',
      zIndex: '5',
      background: spec.fill,
      boxShadow: `0 0 6px ${spec.glow}`,
    });
    this.parent.appendChild(el);

    const food: Food = {
      el,
      kind,
      size: spec.size,
      x: clamp(px, 8, this.W - 8),
      y: Math.min(py, this.foodFloor() - 6),
      age: 0,
      landedFor: 0,
      swayPhase: rand(0, TAU),
    };
    this.foods.push(food);
    this.placeFood(food);
    this.dispatch({ type: 'USER_FEED', food: kind });
  }

  private placeFood(f: Food): void {
    const h = f.size / 2;
    f.el.style.transform = `translate3d(${f.x - h}px, ${f.y - h}px, 0)`;
  }

  private updateFood(dt: number): void {
    const floor = this.foodFloor();
    for (let i = this.foods.length - 1; i >= 0; i--) {
      const f = this.foods[i];
      f.age += dt;
      if (f.y < floor) {
        f.y = Math.min(floor, f.y + FOODS[f.kind].sink * dt);
        f.x += Math.sin(f.age * 2 + f.swayPhase) * 10 * dt;
      } else {
        f.landedFor += dt;
        if (f.landedFor > 6) f.el.style.opacity = String(clamp(1 - (f.landedFor - 6) / 2, 0, 1));
        if (f.landedFor > 8) {
          f.el.remove();
          this.foods.splice(i, 1);
          continue;
        }
      }
      this.placeFood(f);
    }
  }

  private nearestFood(): Food | undefined {
    let best: Food | undefined;
    let bestD = Infinity;
    for (const f of this.foods) {
      const d = Math.hypot(f.x - this.x, f.y - this.y);
      if (d < bestD) {
        bestD = d;
        best = f;
      }
    }
    return best;
  }

  /** Does he actually want this right now? Personality, needs and mood decide. */
  private wants(f: Food): boolean {
    const d = this.drives;
    if (this.grudge) return f.kind === 'treat' || f.kind === this.memory.favoriteFood; // sulking: only a peace offering
    if (f.kind === 'treat') return true; // never says no to a treat
    if (this.overfed >= 2) return false;
    if (this.mood === 'sleepy' && d.hunger < 0.35) return false; // too drowsy to bother
    return d.hunger > 0.12;
  }

  private watchFood(): void {
    if (this.state === 'feeding' || this.state === 'excited' || this.state === 'hiding') return;
    if (this.foods.some((f) => f.age > 0.4 && this.wants(f))) {
      this.zTarget = 0.7;
      this.setState('feeding', 0);
    }
  }

  private updateFeeding(dt: number): void {
    const f = this.nearestFood();
    if (!f) {
      this.startIdle();
      return;
    }
    const k = this.unit();
    const off = MOUTH.x * k;
    const dx = f.x - this.x;
    if (Math.abs(dx) > off * 1.3 && Math.sign(dx) !== this.facing && this.turnCooldown <= 0) {
      this.turnTo(Math.sign(dx) as 1 | -1);
    }
    this.target = { x: f.x - this.facing * off, y: f.y - MOUTH.y * k };
    this.steer(dt, this.cruise() * 1.5, { turn: false, align: false });

    const m = this.mouthWorld();
    if (Math.hypot(m.x - f.x, m.y - f.y) < 30 * this.scale) this.eat(f);
  }

  private eat(f: Food): void {
    f.el.remove();
    this.foods = this.foods.filter((x) => x !== f);

    const spec = FOODS[f.kind];
    const d = this.drives;
    const before = d.hunger;
    d.hunger = clamp(before - spec.hunger, 0, 1);
    d.energy = clamp(d.energy + spec.energy, 0, 1);
    d.happiness = clamp(d.happiness + spec.happiness, 0, 1);
    if (before < 0.08) this.overfed += 1; // eating while full

    const favorite = f.kind !== 'treat' && this.memory.favoriteFood === f.kind;
    const special = favorite || f.kind === 'treat';
    this.chompT = 0.5;
    this.bubblesToSpawn += 3;
    this.dispatch({ type: 'FOOD_EATEN', food: f.kind, favorite });

    // Food repairs the relationship. A treat or his favourite food is a real peace offering:
    // it always ends a sulk. Ordinary food only helps a little.
    this.soothe(f.kind === 'treat' ? 0.3 : favorite ? 0.2 : 0.03);
    if (special && this.grudge) this.forgive();

    // Too much food: feels sluggish, goes to rest it off, and is a bit grumpy about it
    if (this.overfed >= 3) {
      d.happiness = Math.max(0, d.happiness - 0.1);
      d.energy = Math.max(0, d.energy - 0.25);
      this.startRest();
      this.annoy(0.08);
      return;
    }

    // Accepted ordinary food but still not over it
    if (this.grudge) {
      this.startSulk(true);
      return;
    }

    // Favourite food / rare treat: a proper little celebration with the happy spin
    if (special) {
      d.happiness = Math.min(1, d.happiness + (favorite ? 0.1 : 0.05));
      this.bubblesToSpawn += 6;
      this.spin = 0;
      this.startExcited(2.6);
      return;
    }

    if (!this.nearestFood()) this.startExcited(1.4);
  }

  /* ========================================================================
     Movement
     ======================================================================== */
  private turnTo(dir: 1 | -1): void {
    this.facing = dir;
    this.turnCooldown = 0.9;
  }

  private wanderVelocity(): Vec {
    const w = this.prof.wobble;
    return {
      x: Math.sin(this.t * 0.55 + this.seed) * 5 * w,
      y: (Math.sin(this.t * 0.8 + this.seed * 2) * 7 + Math.sin(this.t * 1.9 + this.seed * 3) * 3) * w,
    };
  }

  private steer(dt: number, maxSpeed: number, opts: SteerOptions = {}): void {
    const { turn = true, align = true } = opts;
    const dx = this.target.x - this.x;
    const dy = this.target.y - this.y;
    const dist = Math.hypot(dx, dy);

    if (turn && Math.abs(dx) > 45 && Math.sign(dx) !== this.facing && this.turnCooldown <= 0) {
      this.turnTo(Math.sign(dx) as 1 | -1);
    }

    let speed = Math.min(maxSpeed, dist * 1.6);

    if (align && Math.abs(dx) > 8) {
      const a = this.flip * Math.sign(dx);
      speed *= clamp((a + 0.15) / 1.15, 0, 1);
    }

    const wander = this.wanderVelocity();
    const dvx = (dist > 1 ? (dx / dist) * speed : 0) + wander.x * this.motion;
    const dvy = (dist > 1 ? (dy / dist) * speed : 0) + wander.y * this.motion;

    const ex = dvx - this.vx;
    const ey = dvy - this.vy;
    const len = Math.hypot(ex, ey);
    const maxDv = this.accel() * dt;
    const f = len > maxDv ? maxDv / len : 1;
    this.vx += ex * f;
    this.vy += ey * f;
  }

  private integrate(dt: number): void {
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    const low = this.state === 'feeding' || this.state === 'investigating' || this.state === 'playing';
    // Hiding: he is allowed to sink into the sand so only his fin peeks out
    const b = this.bounds(this.state === 'hiding' ? 1.5 : low ? 0.45 : 0);
    const pull = 1 - Math.exp(-dt * 6);
    if (this.x < b.minX) {
      this.x += (b.minX - this.x) * pull;
      this.vx = Math.max(0, this.vx) * 0.9;
    } else if (this.x > b.maxX) {
      this.x += (b.maxX - this.x) * pull;
      this.vx = Math.min(0, this.vx) * 0.9;
    }
    if (this.y < b.minY) {
      this.y += (b.minY - this.y) * pull;
      this.vy = Math.max(0, this.vy) * 0.9;
    } else if (this.y > b.maxY) {
      this.y += (b.maxY - this.y) * pull;
      this.vy = Math.min(0, this.vy) * 0.9;
    }

    this.z += clamp(this.zTarget - this.z, -0.3 * dt, 0.3 * dt);
  }

  /* ========================================================================
     Bubbles
     ======================================================================== */
  private updateBubbles(dt: number): void {
    this.ambientBubbleIn -= dt;
    if (this.ambientBubbleIn <= 0) {
      if (this.state !== 'sulking') this.bubblesToSpawn += randInt(1, 3);
      this.ambientBubbleIn = rand(4, 9);
    }
    this.bubbleCooldown -= dt;
    if (this.bubblesToSpawn > 0 && this.bubbleCooldown <= 0) {
      this.emitBubble();
      this.bubblesToSpawn--;
      this.bubbleCooldown = rand(0.1, 0.25);
    }
  }

  /** `at` + `fixedSize` are used by bubble rings so the ring rises together. */
  private emitBubble(at?: Vec, fixedSize?: number): void {
    const m = at ?? this.mouthWorld();
    const size = fixedSize ?? rand(5, 11) * (0.7 + 0.4 * this.z);
    const el = document.createElement('span');
    Object.assign(el.style, {
      position: 'absolute',
      left: `${m.x - size / 2}px`,
      top: `${m.y - size / 2}px`,
      width: `${size}px`,
      height: `${size}px`,
      borderRadius: '50%',
      border: '1px solid rgba(220, 250, 255, 0.55)',
      background: 'radial-gradient(circle at 30% 25%, rgba(255,255,255,0.75), transparent 38%)',
      boxShadow: 'inset 1px 1px 2px rgba(255,255,255,0.35)',
      pointerEvents: 'none',
      zIndex: String(this.layer),
    });
    this.parent.appendChild(el);
    this.spawned.add(el);

    const rise = at ? Math.min(150, m.y) : Math.min(rand(120, 240), m.y);
    const drift = at ? 0 : rand(-18, 18);
    el.animate(
      [
        { transform: 'translate(0, 0) scale(0.4)', opacity: 0 },
        { opacity: 0.9, offset: 0.15 },
        { transform: `translate(${drift}px, ${-rise}px) scale(1.1)`, opacity: 0 },
      ],
      { duration: at ? 3000 : rand(2200, 3800), easing: 'ease-out' },
    ).onfinish = () => {
      el.remove();
      this.spawned.delete(el);
    };
  }

  /* ========================================================================
     Rendering
     ======================================================================== */
  private render(dt: number): void {
    const speed = Math.hypot(this.vx, this.vy);
    const sn = clamp(speed / (this.cruise() * 1.8), 0, 1);
    const m = this.motion;

    this.flip += (this.facing - this.flip) * (1 - Math.exp(-dt * 6.5));
    const fs = this.flipSign();
    const sx = Math.abs(this.flip) < 0.1 ? 0.1 * fs : this.flip;
    const turning = clamp(Math.abs(this.facing - this.flip) / 2, 0, 1);

    const freq = (0.8 + sn * 2.6 + this.exciteLevel * 1.2) * this.prof.tail;
    this.phase += dt * TAU * freq;
    this.breath += dt * TAU * (this.state === 'resting' ? 0.45 : 0.85);

    const pitchTarget =
      clamp(Math.atan2(this.vy, Math.max(Math.abs(this.vx), 60)) * RAD, -22, 22) * fs;
    this.pitch += (pitchTarget - this.pitch) * (1 - Math.exp(-dt * 6));

    const wave = Math.sin(this.phase - 0.6) * 1.6 * sn * m;
    const wiggle = Math.sin(this.t * 22) * 7 * this.exciteLevel * m;
    const breathe = Math.sin(this.breath) * (0.01 + (1 - sn) * 0.006) * m;

    // Life moment: a happy full spin
    let spinDeg = 0;
    if (this.spin >= 0) {
      this.spin += dt / 0.9;
      if (this.spin >= 1) this.spin = -1;
      else {
        const s = this.spin;
        const e = s < 0.5 ? 2 * s * s : 1 - Math.pow(-2 * s + 2, 2) / 2;
        spinDeg = e * 360 * fs * m;
      }
    }

    const host = this.host.nativeElement;
    const s = this.scale;
    host.style.transform = `translate3d(${(this.x - this.hostW / 2).toFixed(1)}px, ${(
      this.y -
      this.hostH / 2
    ).toFixed(1)}px, 0) scale(${s.toFixed(3)})`;
    this.els.flip.style.transform = `rotate(${(this.pitch + wave + wiggle + spinDeg).toFixed(2)}deg) scale(${(
      sx *
      (1 + breathe)
    ).toFixed(3)}, ${(1 - breathe * 0.7).toFixed(3)})`;

    const tailAmp = (4 + sn * 14) * (1 + turning * 0.8) * m;
    this.els.tail.style.transform = `rotate(${(Math.sin(this.phase) * tailAmp).toFixed(2)}deg)`;
    this.els.finFront.style.transform = `rotate(${(
      Math.sin(this.phase * 0.5 + 1) * (5 + sn * 4) * m +
      sn * 6
    ).toFixed(2)}deg)`;
    this.els.dorsal.style.transform = `rotate(${(
      Math.sin(this.phase - 0.9) * (2 + sn * 3) * m
    ).toFixed(2)}deg)`;
    this.els.anal.style.transform = `rotate(${(
      Math.sin(this.phase - 1.4) * (2 + sn * 3) * m
    ).toFixed(2)}deg)`;

    this.updateLook(dt);
    this.els.pupil.style.transform = `translate(${this.look.x.toFixed(2)}px, ${this.look.y.toFixed(
      2,
    )}px)`;
    // Baby gets big eyes; blinking squashes the eye vertically
    const eyeK = this.prof.eye;
    this.els.eye.style.transform = `scale(${eyeK.toFixed(3)}, ${(eyeK * this.updateBlink(dt)).toFixed(3)})`;

    // Mouth: smiles when happy, flips into a frown when he's properly cross
    const chomp = this.chompT > 0 ? Math.abs(Math.sin(this.chompT * 18)) : 0;
    const grump = this.state === 'sulking' ? 1 : clamp((this.annoyance - 0.3) / 0.4, 0, 1);
    const happyMouth = 1 + (this.drives.happiness - 0.5) * 0.5;
    const smile = happyMouth * (1 - grump) + -0.7 * grump;
    this.els.mouth.style.transform = `scale(1, ${(smile + chomp * 1.4).toFixed(3)})`;

    // Night wash eases in and out with the time of day
    const washTarget = RHYTHM[this.tod].wash;
    this.wash += (washTarget - this.wash) * (1 - Math.exp(-dt * 0.6));
    if (this.washEl && Math.abs(this.wash - this.lastWash) > 0.004) {
      this.lastWash = this.wash;
      this.washEl.style.opacity = this.wash.toFixed(3);
    }

    this.applyDepth();
  }

  private applyDepth(): void {
    const host = this.host.nativeElement;
    if (Math.abs(this.z - this.lastDepthVar) > 0.01) {
      this.lastDepthVar = this.z;
      host.style.setProperty('--pluto-depth', this.z.toFixed(3));
    }

    // Growth drives the shadow size and the juvenile-yellow -> adult-blue colour mix (see pluto.scss)
    const g = this.memory.growth;
    if (Math.abs(g - this.lastGrowthVar) > 0.002 || this.lastGrowthVar < 0) {
      this.lastGrowthVar = g;
      host.style.setProperty('--pluto-growth', g.toFixed(3));
      host.style.setProperty('--pluto-blue', (blueMixFor(g) * 100).toFixed(1));
    }

    if (this.layer === 6 && this.z < 0.4) this.layer = 4;
    else if (this.layer === 4 && this.z > 0.5) this.layer = 6;
    host.style.zIndex = String(this.layer);
  }

  private updateLook(dt: number): void {
    const k = this.unit();
    const fs = this.flipSign();
    let focus: Vec | null = null;
    const pointerRecent = this.pointer.active && this.t - this.pointer.lastMove < 4;

    switch (this.state) {
      case 'curious':
      case 'excited':
        if (this.pointer.active) focus = this.pointer;
        break;
      case 'feeding': {
        const f = this.nearestFood();
        if (f) focus = f;
        break;
      }
      case 'swimming':
        focus = this.target;
        break;
      case 'investigating':
        if (this.inv) focus = this.objPos(this.inv.obj);
        break;
      case 'playing':
        if (this.toy) focus = { x: this.toy.x, y: this.toy.y };
        break;
      case 'sulking':
        // Refuses to look at you
        this.look.tx = -2;
        this.look.ty = 5;
        this.look.nextAt = this.t + 2;
        break;
      case 'resting':
        // Even half asleep, his eye slowly follows you
        if (pointerRecent) focus = this.pointer;
        break;
      case 'idle':
        // Familiar faces get noticed
        if (
          pointerRecent &&
          this.stageIdx >= 1 &&
          Math.hypot(this.pointer.x - this.x, this.pointer.y - this.y) < this.noticeRadius() * 1.5
        )
          focus = this.pointer;
        break;
    }

    if (focus) {
      const ex = this.x + fs * EYE.x * k;
      const ey = this.y + EYE.y * k;
      const dx = (focus.x - ex) * fs;
      const dy = focus.y - ey;
      const mag = Math.hypot(dx, dy) || 1;
      const amt = Math.min(1, mag / 160);
      this.look.tx = (dx / mag) * amt * 9;
      this.look.ty = (dy / mag) * amt * 7;
    } else if (this.t > this.look.nextAt) {
      const calm = this.state === 'resting';
      this.look.tx = Math.random() < 0.15 ? 3 : rand(-4, 9);
      this.look.ty = Math.random() < 0.15 ? 0 : rand(-6, 5);
      this.look.nextAt = this.t + (calm ? rand(3, 7) : rand(0.9, 3.2));
    }
    // slower, lazier eye while resting
    const rate = this.state === 'resting' ? 4 : 12;
    this.look.x += (this.look.tx - this.look.x) * (1 - Math.exp(-dt * rate));
    this.look.y += (this.look.ty - this.look.y) * (1 - Math.exp(-dt * rate));
  }

  private updateBlink(dt: number): number {
    let blink = 1;
    if (this.blinkT >= 0) {
      this.blinkT += dt;
      const dur = this.mood === 'sleepy' ? 0.38 : 0.16;
      if (this.blinkT >= dur) {
        this.blinkT = -1;
        this.blinkIn = Math.random() < 0.15 ? 0.2 : rand(2.2, 5.5);
      } else {
        blink = 1 - Math.sin((Math.PI * this.blinkT) / dur) * 0.94;
      }
    } else {
      this.blinkIn -= dt;
      if (this.blinkIn <= 0) this.blinkT = 0;
    }

    // Sleepy eyes droop; grumpy eyes narrow
    const droop =
      clamp((0.4 - this.drives.energy) / 0.3, 0, 1) * 0.4 +
      (this.state === 'resting' ? 0.3 : 0) +
      (this.state === 'sulking' ? 0.25 : clamp(this.annoyance - 0.3, 0, 0.3));
    this.lid += (1 - Math.min(0.7, droop) - this.lid) * (1 - Math.exp(-dt * 3));
    return this.lid * blink;
  }
}