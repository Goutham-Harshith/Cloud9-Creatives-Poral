import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';

import { AuthService } from '../../core/auth/auth.service';
import { ManagedUser, UserRole, UserService } from '../../core/users/user.service';

type UserSort = 'role' | 'name';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './admin.html',
  styleUrl: './admin.scss',
})
export class Admin implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly toastrService = inject(ToastrService);
  private readonly userService = inject(UserService);

  protected readonly roles: UserRole[] = [
    'SUPER_ADMIN',
    'ADMIN',
    'MANAGER',
    'SALES',
    'PRODUCTION',
    'DISPATCH',
    'CUSTOMER',
  ];

  protected readonly sortBy = signal<UserSort>('role');
  protected readonly users = signal<ManagedUser[]>([]);
  protected readonly isLoading = signal(false);
  protected readonly isSaving = signal(false);
  protected readonly deletingUserId = signal<string | null>(null);
  protected readonly editingUser = signal<ManagedUser | null>(null);
  protected readonly userPendingDelete = signal<ManagedUser | null>(null);
  protected readonly currentUserId = this.authService.userId;

  protected readonly sortedUsers = computed(() => {
    const users = [...this.users()];
    const sortBy = this.sortBy();

    return users.sort((first, second) => {
      const superAdminSort = this.getSuperAdminRank(first) - this.getSuperAdminRank(second);

      if (superAdminSort !== 0) {
        return superAdminSort;
      }

      if (sortBy === 'role') {
        const roleSort = this.getRoleRank(first.role) - this.getRoleRank(second.role);

        if (roleSort !== 0) {
          return roleSort;
        }
      }

      if (sortBy === 'name') {
        const nameSort = this.getUserName(first).localeCompare(this.getUserName(second));

        if (nameSort !== 0) {
          return nameSort;
        }
      }

      return first.email.localeCompare(second.email);
    });
  });

  protected readonly userForm = this.formBuilder.group({
    email: ['', [Validators.required, Validators.email]],
    name: [''],
    password: ['', [Validators.required, Validators.minLength(6)]],
    role: ['SALES' as UserRole, Validators.required],
    isActive: [true],
  });

  ngOnInit(): void {
    this.loadUsers();
  }

  protected get isEditMode(): boolean {
    return Boolean(this.editingUser());
  }

  protected get canShowPasswordField(): boolean {
    const user = this.editingUser();
    return !user || user.role !== 'SUPER_ADMIN' || user.id === this.currentUserId;
  }

  protected get canSaveUser(): boolean {
    const user = this.editingUser();
    return !user || user.role !== 'SUPER_ADMIN' || user.id === this.currentUserId;
  }

  protected startAddUser(): void {
    this.editingUser.set(null);
    this.userForm.reset({
      email: '',
      name: '',
      password: '',
      role: 'SALES',
      isActive: true,
    });
    this.userForm.controls.password.setValidators([Validators.required, Validators.minLength(6)]);
    this.userForm.controls.password.updateValueAndValidity();
    this.setProfileControlsDisabled(false);
  }

  protected editUser(user: ManagedUser): void {
    this.editingUser.set(user);
    this.userForm.reset({
      email: user.email,
      name: user.name,
      password: '',
      role: user.role,
      isActive: user.isActive,
    });
    this.userForm.controls.password.setValidators(
      user.role === 'SUPER_ADMIN' && user.id === this.currentUserId
        ? [Validators.minLength(6)]
        : [Validators.minLength(6)],
    );
    this.userForm.controls.password.updateValueAndValidity();
    this.setProfileControlsDisabled(user.role === 'SUPER_ADMIN', user.id === this.currentUserId);
  }

  protected saveUser(): void {
    if (this.userForm.invalid || this.isSaving()) {
      this.userForm.markAllAsTouched();
      this.toastrService.error(this.getFormErrorMessage());
      return;
    }

    const editingUser = this.editingUser();
    const formValue = this.userForm.getRawValue();
    this.isSaving.set(true);

    const request = editingUser
      ? this.userService.updateUser(editingUser.id, {
          email: formValue.email || editingUser.email,
          name: formValue.name || this.createNameFromEmail(formValue.email || editingUser.email),
          role: formValue.role || editingUser.role,
          isActive: formValue.isActive ?? editingUser.isActive,
          ...(formValue.password ? { password: formValue.password } : {}),
        })
      : this.userService.createUser({
          email: formValue.email ?? '',
          name: formValue.name?.trim() || undefined,
          password: formValue.password ?? '',
          role: formValue.role ?? 'SALES',
        });

    request.subscribe({
      next: () => {
        this.isSaving.set(false);
        this.toastrService.success(editingUser ? 'User updated successfully' : 'User added successfully');
        this.startAddUser();
        this.loadUsers();
      },
      error: (error) => {
        this.isSaving.set(false);
        this.toastrService.error(
          this.getErrorMessage(error, editingUser ? 'Unable to update user.' : 'Unable to add user.'),
        );
      },
    });
  }

  protected requestDeleteUser(user: ManagedUser): void {
    if (user.role === 'SUPER_ADMIN') {
      return;
    }

    this.userPendingDelete.set(user);
  }

  protected cancelDeleteUser(): void {
    this.userPendingDelete.set(null);
  }

  protected confirmDeleteUser(): void {
    const user = this.userPendingDelete();

    if (!user || this.deletingUserId()) {
      return;
    }

    this.deletingUserId.set(user.id);

    this.userService.deleteUser(user.id).subscribe({
      next: () => {
        this.deletingUserId.set(null);
        this.userPendingDelete.set(null);
        this.toastrService.success('User deleted successfully');
        if (this.editingUser()?.id === user.id) {
          this.startAddUser();
        }
        this.loadUsers();
      },
      error: (error) => {
        this.deletingUserId.set(null);
        this.toastrService.error(this.getErrorMessage(error, 'Unable to delete user.'));
      },
    });
  }

  protected changeSort(event: Event): void {
    this.sortBy.set((event.target as HTMLSelectElement).value as UserSort);
  }

  protected canDeleteUser(user: ManagedUser): boolean {
    return user.role !== 'SUPER_ADMIN';
  }

  protected canEditUser(user: ManagedUser): boolean {
    return user.role !== 'SUPER_ADMIN' || user.id === this.currentUserId;
  }

  protected formatRole(role: string): string {
    return role.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  protected formatDate(date: string): string {
    return new Date(date).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  private loadUsers(): void {
    this.isLoading.set(true);

    this.userService.getUsers().subscribe({
      next: (users) => {
        this.users.set(users);
        this.isLoading.set(false);
      },
      error: (error) => {
        this.users.set([]);
        this.isLoading.set(false);
        this.toastrService.error(this.getErrorMessage(error, 'Unable to load users.'));
      },
    });
  }

  private setProfileControlsDisabled(disabled: boolean, isCurrentSuperAdmin = false): void {
    const controls = [
      this.userForm.controls.email,
      this.userForm.controls.role,
      this.userForm.controls.isActive,
    ];

    controls.forEach((control) => {
      if (disabled) {
        control.disable();
      } else {
        control.enable();
      }
    });

    if (isCurrentSuperAdmin) {
      this.userForm.controls.name.enable();
    } else if (disabled) {
      this.userForm.controls.name.disable();
    } else {
      this.userForm.controls.name.enable();
    }
  }

  private getSuperAdminRank(user: ManagedUser): number {
    return user.role === 'SUPER_ADMIN' ? 0 : 1;
  }

  private getRoleRank(role: UserRole): number {
    return this.roles.indexOf(role);
  }

  private getUserName(user: ManagedUser): string {
    return (user.name || this.createNameFromEmail(user.email)).toLowerCase();
  }

  private createNameFromEmail(email: string): string {
    return email
      .split('@')[0]
      .replace(/[._-]+/g, ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  private getErrorMessage(error: unknown, fallback: string): string {
    const responseMessage = (error as { error?: { message?: string | string[] } })?.error?.message;

    if (Array.isArray(responseMessage)) {
      return responseMessage[0] ?? fallback;
    }

    return responseMessage ?? fallback;
  }

  private getFormErrorMessage(): string {
    const email = this.userForm.controls.email;
    const password = this.userForm.controls.password;

    if (email.hasError('required')) {
      return 'Email is required.';
    }

    if (email.hasError('email')) {
      return 'Enter a valid email address.';
    }

    if (password.hasError('required')) {
      return 'Password is required.';
    }

    if (password.hasError('minlength')) {
      return 'Password must be at least 6 characters.';
    }

    return 'Please check the user details and try again.';
  }
}
