import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';

import { AuthService } from '../../core/auth/auth.service';
import { AppSettings, AppSettingsService } from '../../core/settings/app-settings.service';
import { ManagedUser, UserRole, UserService } from '../../core/users/user.service';

type AdminTab = 'users' | 'settings';
type UserSort = 'role' | 'name';
type SettingsKey = keyof AppSettings;

interface SettingsSection {
  id: string;
  title: string;
  fields: SettingsField[];
}

interface SettingsField {
  id: SettingsKey;
  label: string;
  type?: 'checkbox' | 'number';
}

const matchingPasswords: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const password = control.get('password')?.value ?? '';
  const confirmPassword = control.get('confirmPassword')?.value ?? '';

  if (!password && !confirmPassword) {
    return null;
  }

  return password && confirmPassword && password === confirmPassword ? null : { passwordMismatch: true };
};

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
  private readonly appSettingsService = inject(AppSettingsService);
  private readonly toastrService = inject(ToastrService);
  private readonly userService = inject(UserService);

  protected readonly activeTab = signal<AdminTab>('users');
  protected readonly roles: UserRole[] = [
    'SUPER_ADMIN',
    'ADMIN',
    'MANAGER',
    'SALES',
    'PRODUCTION',
    'DISPATCH',
    'CUSTOMER',
  ];

  protected readonly adminTabs: { id: AdminTab; label: string }[] = [
    { id: 'users', label: 'User management' },
    { id: 'settings', label: 'App settings' },
  ];

  protected readonly settingsSections: SettingsSection[] = [
    {
      id: 'general',
      title: 'General Settings',
      fields: [
        { id: 'currentCapacity', label: 'Current capacity' },
        { id: 'version', label: 'Version' },
        { id: 'withinStateCourier', label: 'Within state courier' },
        { id: 'otherStateCourier', label: 'Other state courier' },
      ],
    },
    {
      id: 'jute',
      title: 'Jute Bag Settings',
      fields: [
        { id: 'natural12x12', label: 'Natural 12 x 12' },
        { id: 'natural14x15', label: 'Natural 14 x 15' },
        { id: 'white12x12', label: 'White 12 x 12' },
        { id: 'white14x15', label: 'White 14 x 15' },
        { id: 'print', label: 'Single Print' },
        { id: 'doublePrint', label: 'Double Print' },
        { id: 'fullPrint', label: 'Full Print' },
        { id: 'singlePrintBulk', label: 'Single Print Bulk' },
        { id: 'doublePrintBulk', label: 'Double Print Bulk' },
        { id: 'fullPrintBulk', label: 'Full Print Bulk' },
        { id: 'labour', label: 'Labour' },
        { id: 'current', label: 'Current' },
        { id: 'machineDip', label: 'Machine Dip' },
        { id: 'thread', label: 'Thread' },
        { id: 'naturalHandle', label: 'Natural handle' },
        { id: 'whiteHandle', label: 'White handle' },
        { id: 'naturalInnerRope', label: 'Natural inner rope' },
        { id: 'whiteInnerRope', label: 'White inner rope' },
        { id: 'Dhori', label: 'Dhori' },
        { id: 'bambooHandle', label: 'Bamboo handle' },
        { id: 'zip', label: 'Zip' },
        { id: 'velcro', label: 'Velcro' },
        { id: 'button', label: 'Button' },
        { id: 'miscellaneous', label: 'Miscellaneous' },
      ],
    },
    {
      id: 'juco',
      title: 'Juco Bag Settings',
      fields: [
        { id: 'naturalJuco', label: 'Natural Juco' },
        { id: 'whiteJuco', label: 'White Juco' },
        { id: 'jucoPrint', label: 'Single Print' },
        { id: 'jucoDoublePrint', label: 'Double Print' },
        { id: 'jucoFullPrint', label: 'Full Print' },
        { id: 'jucoSinglePrintBulk', label: 'Single Print Bulk' },
        { id: 'jucoDoublePrintBulk', label: 'Double Print Bulk' },
        { id: 'jucoFullPrintBulk', label: 'Full Print Bulk' },
        { id: 'jucoLabour', label: 'Labour' },
        { id: 'jucoCurrent', label: 'Current' },
        { id: 'jucoMachineDip', label: 'Machine Dip' },
        { id: 'jucoThread', label: 'Thread' },
        { id: 'jucoNaturalHandle', label: 'Natural handle' },
        { id: 'jucoWhiteHandle', label: 'White handle' },
        { id: 'jucoNaturalInnerRope', label: 'Natural inner rope' },
        { id: 'jucoWhiteInnerRope', label: 'White inner rope' },
        { id: 'jucoDhori', label: 'Dhori' },
        { id: 'jucoBambooHandle', label: 'Bamboo handle' },
        { id: 'jucoZip', label: 'Zip' },
        { id: 'jucoVelcro', label: 'Velcro' },
        { id: 'jucoButton', label: 'Button' },
        { id: 'jucoMiscellaneous', label: 'Miscellaneous' },
      ],
    },
    {
      id: 'paper',
      title: 'Paper Bag Settings',
      fields: [
        { id: 'mini', label: 'Mini' },
        { id: 'small', label: 'Small' },
        { id: 'medium', label: 'Medium' },
        { id: 'packing', label: 'Packing' },
      ],
    },
    {
      id: 'tote',
      title: 'Tote Bag Settings',
      fields: [
        { id: 'cottonCost', label: 'Cotton cost' },
        { id: 'cottonSquareInch', label: 'Cotton square inch' },
        { id: 'cottonSinglePrint', label: 'Single Print' },
        { id: 'cottonDoublePrint', label: 'Double Print' },
        { id: 'cottonLabour', label: 'Labour' },
        { id: 'cottonCurrent', label: 'Current' },
        { id: 'cottonMachineDip', label: 'Machine Dip' },
        { id: 'cottonThread', label: 'Thread' },
        { id: 'cottonShortHandle', label: 'Short handle' },
        { id: 'cottonLongHandle', label: 'Long handle' },
        { id: 'cottonSmallTapeHandle', label: 'Small tape handle' },
        { id: 'cottonLongTapeHandle', label: 'Long tape handle' },
        { id: 'cottonMiscellaneous', label: 'Miscellaneous' },
      ],
    },
    {
      id: 'canvas',
      title: 'Canvas Bag Settings',
      fields: [
        { id: 'canvasCost', label: 'Canvas cost' },
        { id: 'canvasSquareInch', label: 'Canvas square inch' },
        { id: 'canvasSinglePrint', label: 'Single Print' },
        { id: 'canvasDoublePrint', label: 'Double Print' },
        { id: 'canvasFullPrint', label: 'Full Print' },
        { id: 'canvasLabour', label: 'Labour' },
        { id: 'canvasCurrent', label: 'Current' },
        { id: 'canvasMachineDip', label: 'Machine Dip' },
        { id: 'canvasThread', label: 'Thread' },
        { id: 'canvasTapeHandle', label: 'Tape handle' },
        { id: 'canvasRopeHandle', label: 'Rope handle' },
        { id: 'canvasMiscellaneous', label: 'Miscellaneous' },
        { id: 'canvasZip', label: 'Zip' },
        { id: 'canvasVelcro', label: 'Velcro' },
      ],
    },
    {
      id: 'combination',
      title: 'Combination Bag Settings',
      fields: [
        { id: 'combinationLabour', label: 'Labour' },
        { id: 'combinationMiscellaneous', label: 'Miscellaneous' },
        { id: 'naturalSquareInch', label: 'Natural square inch' },
      ],
    },
  ];

  protected readonly sortBy = signal<UserSort>('role');
  protected readonly users = signal<ManagedUser[]>([]);
  protected readonly isLoading = signal(false);
  protected readonly isSaving = signal(false);
  protected readonly isSettingsLoading = signal(false);
  protected readonly isSettingsSaving = signal(false);
  protected readonly expandedSettingsSection = signal<string | null>(null);
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
    confirmPassword: ['', [Validators.required]],
    role: ['SALES' as UserRole, Validators.required],
    isActive: [true],
  }, { validators: matchingPasswords });

  protected readonly settingsForm = this.createSettingsGroup();

  ngOnInit(): void {
    this.loadUsers();
    this.loadSettings();
  }

  protected selectAdminTab(tab: AdminTab): void {
    this.activeTab.set(tab);
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
      confirmPassword: '',
      role: 'SALES',
      isActive: true,
    });
    this.userForm.controls.password.setValidators([Validators.required, Validators.minLength(6)]);
    this.userForm.controls.confirmPassword.setValidators([Validators.required]);
    this.userForm.controls.password.updateValueAndValidity();
    this.userForm.controls.confirmPassword.updateValueAndValidity();
    this.setProfileControlsDisabled(false);
  }

  protected editUser(user: ManagedUser): void {
    this.editingUser.set(user);
    this.userForm.reset({
      email: user.email,
      name: user.name,
      password: '',
      confirmPassword: '',
      role: user.role,
      isActive: user.isActive,
    });
    this.userForm.controls.password.setValidators([Validators.minLength(6)]);
    this.userForm.controls.confirmPassword.setValidators([]);
    this.userForm.controls.password.updateValueAndValidity();
    this.userForm.controls.confirmPassword.updateValueAndValidity();
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

  protected toggleSettingsSection(sectionId: string): void {
    this.expandedSettingsSection.update((currentSectionId) =>
      currentSectionId === sectionId ? null : sectionId,
    );
  }

  protected saveSettings(): void {
    if (this.settingsForm.invalid || this.isSettingsSaving()) {
      this.settingsForm.markAllAsTouched();
      this.toastrService.error('Please check the settings and try again.');
      return;
    }

    this.isSettingsSaving.set(true);

    this.appSettingsService.updateSettings(this.normalizeSettings(this.settingsForm.getRawValue())).subscribe({
      next: (settings) => {
        this.settingsForm.reset(this.normalizeSettings(settings));
        this.isSettingsSaving.set(false);
        this.toastrService.success('Settings saved successfully');
      },
      error: (error) => {
        this.isSettingsSaving.set(false);
        this.toastrService.error(this.getErrorMessage(error, 'Unable to save settings.'));
      },
    });
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

  private loadSettings(): void {
    this.isSettingsLoading.set(true);

    this.appSettingsService.getSettings().subscribe({
      next: (settings) => {
        this.settingsForm.reset(this.normalizeSettings(settings));
        this.isSettingsLoading.set(false);
      },
      error: (error) => {
        this.settingsForm.reset(this.normalizeSettings());
        this.isSettingsLoading.set(false);
        this.toastrService.error(this.getErrorMessage(error, 'Unable to load app settings.'));
      },
    });
  }

  private createSettingsGroup() {
    return this.formBuilder.group({
      natural12x12: [''],
      natural14x15: [''],
      white12x12: [''],
      white14x15: [''],
      print: [''],
      doublePrint: [''],
      fullPrint: [''],
      singlePrintBulk: [''],
      doublePrintBulk: [''],
      fullPrintBulk: [''],
      labour: [''],
      current: [''],
      machineDip: [''],
      thread: [''],
      naturalHandle: [''],
      whiteHandle: [''],
      naturalInnerRope: [''],
      whiteInnerRope: [''],
      Dhori: [''],
      bambooHandle: [''],
      zip: [''],
      velcro: [''],
      button: [''],
      miscellaneous: [''],
      naturalJuco: [''],
      whiteJuco: [''],
      jucoPrint: [''],
      jucoDoublePrint: [''],
      jucoFullPrint: [''],
      jucoSinglePrintBulk: [''],
      jucoDoublePrintBulk: [''],
      jucoFullPrintBulk: [''],
      jucoLabour: [''],
      jucoCurrent: [''],
      jucoMachineDip: [''],
      jucoThread: [''],
      jucoNaturalHandle: [''],
      jucoWhiteHandle: [''],
      jucoNaturalInnerRope: [''],
      jucoWhiteInnerRope: [''],
      jucoDhori: [''],
      jucoBambooHandle: [''],
      jucoZip: [''],
      jucoVelcro: [''],
      jucoButton: [''],
      jucoMiscellaneous: [''],
      mini: [''],
      small: [''],
      medium: [''],
      packing: [''],
      currentCapacity: [''],
      version: [''],
      withinStateCourier: [''],
      otherStateCourier: [''],
      cottonCost: [''],
      cottonSquareInch: [''],
      cottonSinglePrint: [''],
      cottonDoublePrint: [''],
      cottonLabour: [''],
      cottonCurrent: [''],
      cottonMachineDip: [''],
      cottonThread: [''],
      cottonShortHandle: [''],
      cottonLongHandle: [''],
      cottonSmallTapeHandle: [''],
      cottonLongTapeHandle: [''],
      cottonMiscellaneous: [''],
      canvasCost: [''],
      canvasSquareInch: [''],
      canvasSinglePrint: [''],
      canvasDoublePrint: [''],
      canvasFullPrint: [''],
      canvasLabour: [''],
      canvasCurrent: [''],
      canvasMachineDip: [''],
      canvasThread: [''],
      canvasTapeHandle: [''],
      canvasRopeHandle: [''],
      canvasMiscellaneous: [''],
      canvasZip: [''],
      canvasVelcro: [''],
      combinationLabour: [''],
      combinationMiscellaneous: [''],
      naturalSquareInch: [''],
    });
  }

  private normalizeSettings(settings?: Partial<Record<keyof AppSettings, unknown>>): AppSettings {
    return {
      natural12x12: this.normalizeTextValue(settings?.natural12x12),
      natural14x15: this.normalizeTextValue(settings?.natural14x15),
      white12x12: this.normalizeTextValue(settings?.white12x12),
      white14x15: this.normalizeTextValue(settings?.white14x15),
      print: this.normalizeTextValue(settings?.print),
      doublePrint: this.normalizeTextValue(settings?.doublePrint),
      fullPrint: this.normalizeTextValue(settings?.fullPrint),
      singlePrintBulk: this.normalizeTextValue(settings?.singlePrintBulk),
      doublePrintBulk: this.normalizeTextValue(settings?.doublePrintBulk),
      fullPrintBulk: this.normalizeTextValue(settings?.fullPrintBulk),
      labour: this.normalizeTextValue(settings?.labour),
      current: this.normalizeTextValue(settings?.current),
      machineDip: this.normalizeTextValue(settings?.machineDip),
      thread: this.normalizeTextValue(settings?.thread),
      naturalHandle: this.normalizeTextValue(settings?.naturalHandle),
      whiteHandle: this.normalizeTextValue(settings?.whiteHandle),
      naturalInnerRope: this.normalizeTextValue(settings?.naturalInnerRope),
      whiteInnerRope: this.normalizeTextValue(settings?.whiteInnerRope),
      Dhori: this.normalizeTextValue(settings?.Dhori),
      bambooHandle: this.normalizeTextValue(settings?.bambooHandle),
      zip: this.normalizeTextValue(settings?.zip),
      velcro: this.normalizeTextValue(settings?.velcro),
      button: this.normalizeTextValue(settings?.button),
      miscellaneous: this.normalizeTextValue(settings?.miscellaneous),
      naturalJuco: this.normalizeTextValue(settings?.naturalJuco),
      whiteJuco: this.normalizeTextValue(settings?.whiteJuco),
      jucoPrint: this.normalizeTextValue(settings?.jucoPrint),
      jucoDoublePrint: this.normalizeTextValue(settings?.jucoDoublePrint),
      jucoFullPrint: this.normalizeTextValue(settings?.jucoFullPrint),
      jucoSinglePrintBulk: this.normalizeTextValue(settings?.jucoSinglePrintBulk),
      jucoDoublePrintBulk: this.normalizeTextValue(settings?.jucoDoublePrintBulk),
      jucoFullPrintBulk: this.normalizeTextValue(settings?.jucoFullPrintBulk),
      jucoLabour: this.normalizeTextValue(settings?.jucoLabour),
      jucoCurrent: this.normalizeTextValue(settings?.jucoCurrent),
      jucoMachineDip: this.normalizeTextValue(settings?.jucoMachineDip),
      jucoThread: this.normalizeTextValue(settings?.jucoThread),
      jucoNaturalHandle: this.normalizeTextValue(settings?.jucoNaturalHandle),
      jucoWhiteHandle: this.normalizeTextValue(settings?.jucoWhiteHandle),
      jucoNaturalInnerRope: this.normalizeTextValue(settings?.jucoNaturalInnerRope),
      jucoWhiteInnerRope: this.normalizeTextValue(settings?.jucoWhiteInnerRope),
      jucoDhori: this.normalizeTextValue(settings?.jucoDhori),
      jucoBambooHandle: this.normalizeTextValue(settings?.jucoBambooHandle),
      jucoZip: this.normalizeTextValue(settings?.jucoZip),
      jucoVelcro: this.normalizeTextValue(settings?.jucoVelcro),
      jucoButton: this.normalizeTextValue(settings?.jucoButton),
      jucoMiscellaneous: this.normalizeTextValue(settings?.jucoMiscellaneous),
      mini: this.normalizeTextValue(settings?.mini),
      small: this.normalizeTextValue(settings?.small),
      medium: this.normalizeTextValue(settings?.medium),
      packing: this.normalizeTextValue(settings?.packing),
      currentCapacity: this.normalizeTextValue(settings?.currentCapacity),
      version: this.normalizeTextValue(settings?.version),
      withinStateCourier: this.normalizeTextValue(settings?.withinStateCourier),
      otherStateCourier: this.normalizeTextValue(settings?.otherStateCourier),
      cottonCost: this.normalizeTextValue(settings?.cottonCost),
      cottonSquareInch: this.normalizeTextValue(settings?.cottonSquareInch),
      cottonSinglePrint: this.normalizeTextValue(settings?.cottonSinglePrint),
      cottonDoublePrint: this.normalizeTextValue(settings?.cottonDoublePrint),
      cottonLabour: this.normalizeTextValue(settings?.cottonLabour),
      cottonCurrent: this.normalizeTextValue(settings?.cottonCurrent),
      cottonMachineDip: this.normalizeTextValue(settings?.cottonMachineDip),
      cottonThread: this.normalizeTextValue(settings?.cottonThread),
      cottonShortHandle: this.normalizeTextValue(settings?.cottonShortHandle),
      cottonLongHandle: this.normalizeTextValue(settings?.cottonLongHandle),
      cottonSmallTapeHandle: this.normalizeTextValue(settings?.cottonSmallTapeHandle),
      cottonLongTapeHandle: this.normalizeTextValue(settings?.cottonLongTapeHandle),
      cottonMiscellaneous: this.normalizeTextValue(settings?.cottonMiscellaneous),
      canvasCost: this.normalizeTextValue(settings?.canvasCost),
      canvasSquareInch: this.normalizeTextValue(settings?.canvasSquareInch),
      canvasSinglePrint: this.normalizeTextValue(settings?.canvasSinglePrint),
      canvasDoublePrint: this.normalizeTextValue(settings?.canvasDoublePrint),
      canvasFullPrint: this.normalizeTextValue(settings?.canvasFullPrint),
      canvasLabour: this.normalizeTextValue(settings?.canvasLabour),
      canvasCurrent: this.normalizeTextValue(settings?.canvasCurrent),
      canvasMachineDip: this.normalizeTextValue(settings?.canvasMachineDip),
      canvasThread: this.normalizeTextValue(settings?.canvasThread),
      canvasTapeHandle: this.normalizeTextValue(settings?.canvasTapeHandle),
      canvasRopeHandle: this.normalizeTextValue(settings?.canvasRopeHandle),
      canvasMiscellaneous: this.normalizeTextValue(settings?.canvasMiscellaneous),
      canvasZip: this.normalizeTextValue(settings?.canvasZip),
      canvasVelcro: this.normalizeTextValue(settings?.canvasVelcro),
      combinationLabour: this.normalizeTextValue(settings?.combinationLabour),
      combinationMiscellaneous: this.normalizeTextValue(settings?.combinationMiscellaneous),
      naturalSquareInch: this.normalizeTextValue(settings?.naturalSquareInch),
    };
  }

  private normalizeTextValue(value: unknown): string {
    return value === null || value === undefined ? '' : String(value);
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

    if (this.userForm.hasError('passwordMismatch')) {
      return 'Passwords must match.';
    }

    return 'Please check the user details and try again.';
  }
}
