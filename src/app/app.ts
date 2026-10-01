import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Aqaurium } from './aqaurium/aqaurium';

@Component({
  imports: [RouterOutlet, Aqaurium],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  protected readonly title = signal('Pluto.Web');
}
