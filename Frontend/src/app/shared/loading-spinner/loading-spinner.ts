import { Component, inject } from '@angular/core';

import { LoadingService } from '../../core/loading/loading.service';

@Component({
  selector: 'app-loading-spinner',
  imports: [],
  templateUrl: './loading-spinner.html',
  styleUrl: './loading-spinner.scss',
})
export class LoadingSpinner {
  protected readonly loadingService = inject(LoadingService);
}
