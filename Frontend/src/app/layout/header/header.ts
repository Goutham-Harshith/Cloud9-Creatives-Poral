import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-header',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './header.html',
  styleUrl: './header.scss',
})
export class Header {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly userEmail = this.authService.userEmail;
  protected readonly profileInitial = this.authService.profileInitial;
  protected readonly canManageUsers = this.authService.canManageUsers;
  protected readonly canAccessSales = this.authService.canAccessSales;
  protected readonly canAccessScheduler = this.authService.canAccessScheduler;

  protected logout(): void {
    this.authService.logout();
    void this.router.navigate(['/login']);
  }
}
