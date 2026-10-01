import { Component, OnDestroy, OnInit } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { PlutoComponent } from '../pluto/pluto';

interface VisitReward { emoji: string; title: string; }

@Component({
  imports: [PlutoComponent, NgIf, NgFor],
  selector: 'app-aqaurium',
  styleUrl: './aqaurium.scss',
  templateUrl: './aqaurium.html',
})
export class Aqaurium implements OnInit, OnDestroy {
  showWelcome = true;
  showInstructions = false;
  showJourney = false;
  hintVisible = true;
  currentHint = 'Tap Pluto, feed him, play with him, and see what he remembers.';
  days = Array.from({ length: 30 }, (_, i) => i + 1);
  completed = new Set<number>();
  nextDay = 1;
  private readonly storageKey = 'pluto.gift.30day.v1';
  private hintTimer?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    this.loadJourney();
    this.showWelcome = !this.hasSeenWelcome();
    this.nextDay = this.findNextDay();
    this.hintTimer = setTimeout(() => this.dismissHint(), 9000);
  }

  ngOnDestroy(): void {
    if (this.hintTimer) clearTimeout(this.hintTimer);
  }

  get completedDays(): number { return this.completed.size; }
  get progressPercent(): number { return Math.round((this.completedDays / 30) * 100); }

  closeWelcome(): void {
    this.showWelcome = false;
    try { localStorage.setItem('pluto.gift.welcome.seen', '1'); } catch {}
  }

  dismissHint(): void { this.hintVisible = false; }
  closeModals(): void { this.showInstructions = false; this.showJourney = false; }

  isDone(day: number): boolean { return this.completed.has(day); }
  isUnlocked(day: number): boolean { return day <= this.nextDay; }

  checkIn(day: number): void {
    if (day !== this.nextDay || this.isDone(day)) return;
    this.completed.add(day);
    this.nextDay = this.findNextDay();
    this.saveJourney();
    if (day < 30) {
      this.currentHint = `${this.rewardFor(day).emoji} Day ${day} complete! Come back tomorrow for the next little reward.`;
      this.hintVisible = true;
    } else {
      this.currentHint = '💙 You made it through all 30 days with Pluto. This little friendship is yours forever.';
      this.hintVisible = true;
    }
  }

  rewardFor(day: number): VisitReward {
    const rewards: Record<number, VisitReward> = {
      1: { emoji: '💙', title: 'Pluto says hello' },
      2: { emoji: '🫧', title: 'Bubble buddy' },
      3: { emoji: '🌸', title: 'A tiny flower' },
      4: { emoji: '🍪', title: 'Pluto snack' },
      5: { emoji: '⭐', title: 'Little lucky star' },
      6: { emoji: '🎀', title: 'Friendship ribbon' },
      7: { emoji: '🏅', title: 'One week together' },
      10: { emoji: '🪸', title: 'Coral keepsake' },
      14: { emoji: '💌', title: 'A love note from Pluto' },
      21: { emoji: '👑', title: 'Best-friend crown' },
      30: { emoji: '🏆', title: '30-day Pluto friendship' },
    };
    return rewards[day] ?? { emoji: day % 2 ? '🐚' : '✨', title: `Day ${day} keepsake` };
  }

  private findNextDay(): number {
    for (let day = 1; day <= 30; day++) if (!this.completed.has(day)) return day;
    return 30;
  }

  private hasSeenWelcome(): boolean {
    try { return localStorage.getItem('pluto.gift.welcome.seen') === '1'; } catch { return false; }
  }

  private loadJourney(): void {
    try {
      const raw = localStorage.getItem(this.storageKey);
      const data = raw ? JSON.parse(raw) : [];
      if (Array.isArray(data)) this.completed = new Set(data.filter((d) => Number.isInteger(d) && d >= 1 && d <= 30));
    } catch { this.completed = new Set(); }
  }

  private saveJourney(): void {
    try { localStorage.setItem(this.storageKey, JSON.stringify([...this.completed].sort((a, b) => a - b))); } catch {}
  }
}
