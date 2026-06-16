import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { LoadingSpinner } from './shared/loading-spinner/loading-spinner';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, LoadingSpinner],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {}
