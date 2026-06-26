import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AbstractControl, FormArray, FormBuilder, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';

import { OrderDetails, OrderService, UploadedOrderFile } from '../../core/orders/order.service';
import { AppSettings, AppSettingsService } from '../../core/settings/app-settings.service';

type WizardStep = 1 | 2 | 3;

interface PlannedCapacityDay {
  date: string;
  quantity: number;
  remainingCapacity: number;
  overCapacity: number;
}

interface PricingPreview {
  fabric: 'Jute' | 'Juco';
  imageUrl: string;
  price: number;
  normalPrice: number;
  bulkPrice: number;
  summary: string;
  items: string[];
  marginAmount: number;
  marginPercent: string;
  showMargin: boolean;
}

@Component({
  selector: 'app-sales',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './sales.html',
  styleUrl: './sales.scss',
})
export class Sales implements OnInit {

  constructor(
    private router : Router,
    private route: ActivatedRoute,
    private toastrService: ToastrService,
    private orderService: OrderService,
    private appSettingsService: AppSettingsService

  ){}

  private readonly formBuilder = inject(FormBuilder);

  protected readonly fabrics = ['Jute', 'Juco'];
  protected readonly zipOptions = ['None', 'Zip', 'Velcro', 'Button'];
  protected readonly colors = ['White', 'Natural', 'Combination'];
  protected readonly handles = ['Natural tape', 'White tape', 'Natural rope', 'White rope', 'Bamboo'];
  protected readonly prints = ['Plain', 'Single Print', 'Double Print', 'Full Print'];
  protected readonly courierTypes = ['Professional couriers', 'APSRTC', 'Self pickup', 'Others'];

  protected currentStep: WizardStep = 1;
  protected isSubmitting = false;
  protected isDeleting = false;
  protected readonly previewDialog = signal<{ url: string; name: string } | null>(null);
  protected readonly pricingPreview = signal<PricingPreview | null>(null);
  protected readonly showPricingCalculator = signal(false);
  protected calculatorQuantity: number | null = null;
  protected readonly calculatorResult = signal<{ quantity: number; price: number } | null>(null);
  protected readonly showDeleteConfirmation = signal(false);
  protected readonly showCapacityPreview = signal(true);
  protected readonly capacityReservations = signal<Array<{ date: string; quantity: number }>>([]);
  protected dailyJuteCapacity = 160;
  protected isPricingLoading = false;
  protected readonly minimumScheduleDate = this.toDateKey(new Date());
  protected orderNumber = '';
  private editOrderId: string | null = null;
  private appSettings: AppSettings | null = null;

  protected readonly orderForm = this.formBuilder.group({
    bag: this.formBuilder.group({
      fabric: ['', Validators.required],
      quantity: [null as number | null, Validators.required],
      dueDate: ['', Validators.required],
      productionStartDate: ['', Validators.required],
      includeSunday: [false],
      width: [null as number | null, Validators.required],
      height: [null as number | null, Validators.required],
      gusset: [null as number | null, Validators.required],
      zip: ['', Validators.required],
      color: ['', Validators.required],
      handle: ['', Validators.required],
      print: ['', Validators.required],
      notes: [''],
    }, { validators: this.scheduleDateValidator() }),
    designs: this.formBuilder.array([this.createDesignGroup()]),
    customer: this.formBuilder.group({
      name: [''],
      phone: [''],
      alternatePhone: [''],
      address: [''],
      courierType: [''],
      courierNotes: [''],
    }),
  });

  protected get designs(): FormArray {
    return this.orderForm.controls.designs;
  }

  protected get isEditMode(): boolean {
    return Boolean(this.editOrderId);
  }

  ngOnInit(): void {
    this.editOrderId = this.route.snapshot.queryParamMap.get('orderId');
    this.loadAppSettings();

    if (this.editOrderId) {
      this.loadOrder(this.editOrderId);
    }
  }

  protected get showCourierNotes(): boolean {
    return this.orderForm.controls.customer.controls.courierType.value === 'Others';
  }

  protected getSuggestedCapacityPlan(): PlannedCapacityDay[] {
    const { dueDate, productionStartDate, includeSunday, quantity } = this.orderForm.controls.bag.getRawValue();

    if (!dueDate || !quantity || quantity < 1) {
      return [];
    }

    const days: PlannedCapacityDay[] = [];
    let remainingQuantity = quantity;
    const date = new Date(`${dueDate}T12:00:00`);
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const todayKey = this.toDateKey(today);
    const earliestDateKey = productionStartDate && productionStartDate > todayKey ? productionStartDate : todayKey;
    const earliestDate = new Date(`${earliestDateKey}T12:00:00`);

    while (remainingQuantity > 0 && date >= earliestDate) {
      if (date.getDay() === 0 && !includeSunday) {
        date.setDate(date.getDate() - 1);
        continue;
      }

      const isEarliestDate = this.toDateKey(date) === earliestDateKey;
      const dateKey = this.toDateKey(date);
      const bookedCapacity = this.capacityReservations()
        .filter((reservation) => reservation.date === dateKey)
        .reduce((total, reservation) => total + reservation.quantity, 0);
      const availableCapacity = Math.max(this.dailyJuteCapacity - bookedCapacity, 0);
      const plannedQuantity = isEarliestDate
        ? remainingQuantity
        : Math.min(remainingQuantity, availableCapacity);

      if (!plannedQuantity) {
        date.setDate(date.getDate() - 1);
        continue;
      }

      const remainingCapacity = this.dailyJuteCapacity - bookedCapacity - plannedQuantity;

      days.push({
        date: dateKey,
        quantity: plannedQuantity,
        remainingCapacity: Math.max(remainingCapacity, 0),
        overCapacity: Math.max(-remainingCapacity, 0),
      });
      remainingQuantity -= plannedQuantity;
      date.setDate(date.getDate() - 1);
    }

    return days;
  }

  protected formatScheduleDate(date: string): string {
    return new Date(`${date}T12:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  }

  protected toggleCapacityPreview(): void {
    this.showCapacityPreview.update((show) => !show);
  }

  protected refreshCapacityPlan(): void {
    const bagForm = this.orderForm.controls.bag;
    const { dueDate, productionStartDate } = bagForm.getRawValue();

    if (!dueDate || !productionStartDate || this.getScheduleDateErrorMessage()) {
      this.capacityReservations.set([]);
      return;
    }

    this.orderService.getCapacitySchedule(productionStartDate, dueDate).subscribe({
      next: (schedule) => {
        this.dailyJuteCapacity = schedule.dailyCapacity;
        this.capacityReservations.set(
          schedule.reservations
            .filter((reservation) => reservation.order.id !== this.editOrderId)
            .map((reservation) => ({ date: reservation.date, quantity: reservation.quantity })),
        );
      },
      error: () => this.capacityReservations.set([]),
    });
  }

  protected handleScheduleDateChange(): void {
    this.orderForm.controls.bag.updateValueAndValidity();
    this.refreshCapacityPlan();
  }

  protected goBack(): void {
    if (this.currentStep > 1) {
      this.currentStep = (this.currentStep - 1) as WizardStep;
    }
  }

  protected goNext(): void {
    if (this.currentStep === 1 && this.orderForm.controls.bag.invalid) {
      this.orderForm.controls.bag.markAllAsTouched();
      const dateErrorMessage = this.getScheduleDateErrorMessage();

      if (dateErrorMessage) {
        this.toastrService.error(dateErrorMessage);
      }

      return;
    }

    if (this.currentStep === 1) {
      this.openPricingPreview();
      return;
    }

    if (this.currentStep < 3) {
      this.currentStep = (this.currentStep + 1) as WizardStep;
    }
  }

  protected addDesign(): void {
    this.designs.push(this.createDesignGroup());
  }

  protected removeDesign(index: number): void {
    this.designs.removeAt(index);
  }

  protected updateDesignFile(event: Event, index: number): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    const previewUrl = file && file.type.startsWith('image/') ? URL.createObjectURL(file) : null;

    this.designs.at(index).patchValue({
      file,
      fileName: file?.name ?? '',
      previewUrl,
      uploadedFile: null,
    });
  }

  protected clearDesignFile(index: number): void {
    this.designs.at(index).patchValue({
      file: null,
      fileName: '',
      previewUrl: null,
      uploadedFile: null,
    });
  }

  protected openPreview(index: number): void {
    const design = this.designs.at(index).value;

    if (design.previewUrl) {
      this.previewDialog.set({
        url: design.previewUrl,
        name: design.fileName || 'Design preview',
      });
    }
  }

  protected closePreview(): void {
    this.previewDialog.set(null);
  }

  protected closePricingPreview(): void {
    this.pricingPreview.set(null);
    this.showPricingCalculator.set(false);
  }

  protected confirmPricingPreview(): void {
    this.pricingPreview.set(null);
    this.showPricingCalculator.set(false);
    this.currentStep = 2;
  }

  protected openPricingCalculator(): void {
    this.calculatorQuantity = this.orderForm.controls.bag.controls.quantity.value;
    this.calculatorResult.set(null);
    this.showPricingCalculator.set(true);
  }

  protected closePricingCalculator(): void {
    this.showPricingCalculator.set(false);
  }

  protected calculateQuantityPrice(pricing: PricingPreview): void {
    const quantity = Number(this.calculatorQuantity);

    if (!Number.isFinite(quantity) || quantity < 1) {
      this.toastrService.error('Please enter a valid quantity.');
      return;
    }

    const priceDiff = pricing.normalPrice - pricing.bulkPrice;
    const priceForHundred = priceDiff / 5;
    const discountRatio = quantity >= 100 ? quantity / 100 : 0;
    const discount = priceForHundred * discountRatio;

    this.calculatorResult.set({
      quantity,
      price: Math.ceil(pricing.normalPrice - discount),
    });
  }

  protected requestDeleteOrder(): void {
    this.showDeleteConfirmation.set(true);
  }

  protected cancelDeleteOrder(): void {
    this.showDeleteConfirmation.set(false);
  }

  protected confirmDeleteOrder(): void {
    if (!this.editOrderId || this.isDeleting) {
      return;
    }

    this.isDeleting = true;

    this.orderService.deleteOrder(this.editOrderId).subscribe({
      next: () => {
        this.isDeleting = false;
        this.showDeleteConfirmation.set(false);
        this.toastrService.success('Order deleted successfully');
        this.router.navigate(['/dashboard']);
      },
      error: () => {
        this.isDeleting = false;
        this.toastrService.error('Unable to delete order. Please try again.');
      },
    });
  }

  protected createOrder(): void {
    if (this.orderForm.invalid || this.isSubmitting) {
      this.orderForm.markAllAsTouched();
      const dateErrorMessage = this.getScheduleDateErrorMessage();

      if (dateErrorMessage) {
        this.toastrService.error(dateErrorMessage);
      }

      return;
    }

    this.isSubmitting = true;
    const isEditMode = this.isEditMode;
    const request = this.editOrderId
      ? this.orderService.updateOrder(this.editOrderId, this.getOrderPayload())
      : this.orderService.createOrder(this.getOrderPayload());

    request.subscribe({
      next: () => {
        this.isSubmitting = false;
        this.resetForm();
        this.router.navigate(['/dashboard']);
        this.toastrService.success(
          isEditMode ? 'Order updated successfully' : 'Order created successfully',
        );
      },
      error: (error) => {
        this.isSubmitting = false;
        this.toastrService.error(this.getErrorMessage(
          error,
          this.isEditMode ? 'Unable to update order. Please try again.' : 'Unable to create order. Please try again.',
        ));
      },
    });
  }

  private loadOrder(orderId: string): void {
    this.orderService.getOrder(orderId).subscribe({
      next: (order) => this.patchOrder(order),
      error: () => {
        this.toastrService.error('Unable to load order for editing.');
        this.router.navigate(['/dashboard']);
      },
    });
  }

  private loadAppSettings(): void {
    this.appSettingsService.getSettings().subscribe({
      next: (settings) => {
        this.appSettings = settings;
      },
      error: () => {
        this.appSettings = null;
      },
    });
  }

  private openPricingPreview(): void {
    if (this.appSettings) {
      this.pricingPreview.set(this.calculatePricingPreview(this.appSettings));
      return;
    }

    if (this.isPricingLoading) {
      return;
    }

    this.isPricingLoading = true;
    this.appSettingsService.getSettings().subscribe({
      next: (settings) => {
        this.isPricingLoading = false;
        this.appSettings = settings;
        this.pricingPreview.set(this.calculatePricingPreview(settings));
      },
      error: () => {
        this.isPricingLoading = false;
        this.toastrService.error('Unable to load pricing settings. Please try again.');
      },
    });
  }

  private calculatePricingPreview(settings: AppSettings): PricingPreview {
    const bag = this.orderForm.controls.bag.getRawValue();
    const fabric = bag.fabric === 'Juco' ? 'Juco' : 'Jute';
    const color = this.toPricingColor(bag.color);
    const closure = this.toPricingClosure(bag.zip);
    const handle = this.toPricingHandle(bag.handle);
    const printType = this.toPricingPrint(bag.print);
    const height = Number(bag.height);
    const width = Number(bag.width);
    const gusset = Number(bag.gusset);
    const level1 = ((height + 0.5) * width) * 2;
    const level2 = ((height + 0.5) + width + (height + 0.5)) * (gusset + 2.5);
    const level3 = (width - 1) * (gusset + 1);
    const isSmallBag = (Math.ceil(level1) + Math.ceil(level2)) < 300;
    const totalFabric = Math.ceil(level1) + Math.ceil(level2) + (closure === 'zip' ? Math.ceil(level3) : 0);
    const bagCountPerMeter = Math.floor((1800 / totalFabric) * 10) / 10;
    const items: string[] = [];
    let fabricPrice = 0;

    if (fabric === 'Juco') {
      if (color === 'natural') {
        fabricPrice = this.toNumber(settings.naturalJuco);
        items.push('Natural Juco');
      } else if (color === 'white and natural combination') {
        fabricPrice = this.toNumber(settings.whiteJuco);
        items.push('White and Natural combination');
      } else {
        fabricPrice = this.toNumber(settings.whiteJuco);
        items.push('White Juco');
      }
    } else {
      if (color === 'natural') {
        fabricPrice = this.toNumber(settings.natural14x15);
      } else {
        fabricPrice = this.toNumber(settings.white14x15);
      }
      items.push('14x15 quality');
    }

    const basePrice = fabricPrice / bagCountPerMeter
      + this.toNumber(fabric === 'Juco' ? settings.jucoLabour : settings.labour)
      + this.toNumber(fabric === 'Juco' ? settings.jucoMachineDip : settings.machineDip)
      + this.toNumber(fabric === 'Juco' ? settings.jucoCurrent : settings.current)
      + this.toNumber(fabric === 'Juco' ? settings.jucoThread : settings.thread)
      + this.toNumber(fabric === 'Juco' ? settings.jucoMiscellaneous : settings.miscellaneous);
    let totalPrice = basePrice;
    let bulkTotalPrice = basePrice;

    totalPrice += this.getPrintCost(settings, fabric, printType, isSmallBag);
    bulkTotalPrice += this.getPrintCost(settings, fabric, printType, true);
    items.push(this.getPrintDescription(printType));

    totalPrice += this.getHandleCost(settings, fabric, handle);
    bulkTotalPrice += this.getHandleCost(settings, fabric, handle);
    items.push(this.getHandleDescription(handle));

    const closureCost = this.getClosureCost(settings, fabric, closure);
    if (closureCost.description) {
      items.push(closureCost.description);
    }
    totalPrice += closureCost.cost;
    bulkTotalPrice += closureCost.cost;

    let profit = totalPrice * 0.65;
    if (profit < 20) {
      profit = 20;
    }
    let bulkProfit = bulkTotalPrice * 0.5;
    if (bulkProfit < 20) {
      bulkProfit = 20;
    }
    const normalPrice = Math.ceil(totalPrice + profit);
    const bulkPrice = Math.floor(Math.ceil(bulkTotalPrice + bulkProfit));

    return {
      fabric,
      imageUrl: fabric === 'Juco' ? '/assets/juco_bag.jpg' : '/assets/jute_bag.png',
      price: normalPrice,
      normalPrice,
      bulkPrice,
      summary: `${width}w x ${height}h x ${gusset}g ${color} ${fabric.toLowerCase()} bag contains the following elements.`,
      items,
      marginAmount: Math.floor(profit),
      marginPercent: '65%',
      showMargin: !this.toBoolean((settings as AppSettings & { hideSettings?: string | boolean }).hideSettings),
    };
  }

  private getPrintCost(settings: AppSettings, fabric: 'Jute' | 'Juco', printType: string, useBulkPrice: boolean): number {
    const keyPrefix = fabric === 'Juco' ? 'juco' : '';

    switch (printType) {
      case 'single':
        return this.toNumber(useBulkPrice
          ? (keyPrefix ? settings.jucoSinglePrintBulk : settings.singlePrintBulk)
          : (keyPrefix ? settings.jucoPrint : settings.print));
      case 'double':
        return this.toNumber(useBulkPrice
          ? (keyPrefix ? settings.jucoDoublePrintBulk : settings.doublePrintBulk)
          : (keyPrefix ? settings.jucoDoublePrint : settings.doublePrint));
      case 'full':
        return this.toNumber(useBulkPrice
          ? (keyPrefix ? settings.jucoFullPrintBulk : settings.fullPrintBulk)
          : (keyPrefix ? settings.jucoFullPrint : settings.fullPrint));
      default:
        return 0;
    }
  }

  private getHandleCost(settings: AppSettings, fabric: 'Jute' | 'Juco', handle: string): number {
    const isJuco = fabric === 'Juco';

    switch (handle) {
      case 'naturalTape':
        return this.toNumber(isJuco ? settings.jucoNaturalHandle : settings.naturalHandle);
      case 'whiteTape':
        return this.toNumber(isJuco ? settings.jucoWhiteHandle : settings.whiteHandle);
      case 'naturalRope':
        return this.toNumber(isJuco ? settings.jucoNaturalInnerRope : settings.naturalInnerRope);
      case 'whiteRope':
        return this.toNumber(isJuco ? settings.jucoWhiteInnerRope : settings.whiteInnerRope);
      case 'bamboo':
        return this.toNumber(isJuco ? settings.jucoBambooHandle : settings.bambooHandle);
      default:
        return 0;
    }
  }

  private getClosureCost(settings: AppSettings, fabric: 'Jute' | 'Juco', closure: string): { cost: number; description: string } {
    const isJuco = fabric === 'Juco';

    switch (closure) {
      case 'zip':
        return { cost: this.toNumber(isJuco ? settings.jucoZip : settings.zip), description: 'includes zip' };
      case 'velcro':
        return { cost: this.toNumber(isJuco ? settings.jucoVelcro : settings.velcro), description: 'includes velcro' };
      case 'button':
        return { cost: this.toNumber(isJuco ? settings.jucoButton : settings.button), description: 'includes button' };
      default:
        return { cost: 0, description: '' };
    }
  }

  private getPrintDescription(printType: string): string {
    switch (printType) {
      case 'single':
        return 'Single side print';
      case 'double':
        return 'Double side print';
      case 'full':
        return 'Three side print';
      default:
        return 'without print';
    }
  }

  private getHandleDescription(handle: string): string {
    switch (handle) {
      case 'naturalTape':
        return 'Natural tape handle';
      case 'whiteTape':
        return 'White tape handle';
      case 'naturalRope':
        return 'Natural rope handle';
      case 'whiteRope':
        return 'White rope handle';
      case 'bamboo':
        return 'Bamboo handle';
      default:
        return 'No handle selected';
    }
  }

  private toPricingColor(color: string | null): string {
    switch (color) {
      case 'Natural':
        return 'natural';
      case 'Combination':
        return 'white and natural combination';
      default:
        return 'white';
    }
  }

  private toPricingClosure(closure: string | null): string {
    return (closure ?? 'none').toLowerCase();
  }

  private toPricingHandle(handle: string | null): string {
    switch (handle) {
      case 'Natural tape':
        return 'naturalTape';
      case 'White tape':
        return 'whiteTape';
      case 'Natural rope':
        return 'naturalRope';
      case 'White rope':
        return 'whiteRope';
      case 'Bamboo':
        return 'bamboo';
      default:
        return '';
    }
  }

  private toPricingPrint(printType: string | null): string {
    switch (printType) {
      case 'Single Print':
        return 'single';
      case 'Double Print':
        return 'double';
      case 'Full Print':
        return 'full';
      default:
        return 'plain';
    }
  }

  private toNumber(value: string | number | null | undefined): number {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : 0;
  }

  private toBoolean(value: string | boolean | null | undefined): boolean {
    return value === true || value === 'true';
  }

  private patchOrder(order: OrderDetails): void {
    this.orderNumber = order.orderNumber;
    this.designs.clear();

    order.designs.forEach((design) => {
      this.designs.push(
        this.createDesignGroup({
          fileName: design.fileName ?? design.uploadedFile?.originalName ?? '',
          notes: design.notes ?? '',
          previewUrl: this.getPreviewUrl(design.uploadedFile),
          uploadedFile: design.uploadedFile,
        }),
      );
    });

    if (this.designs.length === 0) {
      this.designs.push(this.createDesignGroup());
    }

    this.orderForm.patchValue({
      bag: {
        fabric: order.bag.fabric ?? '',
        quantity: order.bag.quantity ?? null,
        dueDate: order.bag.dueDate ?? '',
        productionStartDate: order.bag.productionStartDate ?? '',
        includeSunday: order.bag.includeSunday ?? false,
        width: order.bag.width ?? null,
        height: order.bag.height ?? null,
        gusset: order.bag.gusset ?? null,
        zip: order.bag.zip ?? '',
        color: order.bag.color ?? '',
        handle: order.bag.handle ?? '',
        print: order.bag.print ?? '',
        notes: order.bag.notes ?? '',
      },
      customer: order.customer,
    });
    this.refreshCapacityPlan();
  }

  private getPreviewUrl(uploadedFile: UploadedOrderFile | null): string | null {
    return uploadedFile?.mimeType.startsWith('image/')
      ? this.orderService.getUploadedFileUrl(uploadedFile)
      : null;
  }

  private createDesignGroup(value?: {
    fileName?: string;
    notes?: string;
    previewUrl?: string | null;
    uploadedFile?: UploadedOrderFile | null;
  }) {
    return this.formBuilder.group({
      file: [null as File | null],
      fileName: [value?.fileName ?? ''],
      notes: [value?.notes ?? ''],
      previewUrl: [value?.previewUrl ?? null as string | null],
      uploadedFile: [value?.uploadedFile ?? null as UploadedOrderFile | null],
    });
  }

  private resetForm(): void {
    this.editOrderId = null;
    this.orderNumber = '';
    this.designs.clear();
    this.designs.push(this.createDesignGroup());
    this.currentStep = 1;
    this.showCapacityPreview.set(true);
    this.capacityReservations.set([]);
    this.orderForm.reset({
      bag: {
        fabric: '',
        quantity: null,
        dueDate: '',
        productionStartDate: '',
        includeSunday: false,
        width: null,
        height: null,
        gusset: null,
        zip: '',
        color: '',
        handle: '',
        print: '',
        notes: '',
      },
      customer: {
        name: '',
        phone: '',
        alternatePhone: '',
        address: '',
        courierType: '',
        courierNotes: '',
      },
    });
  }

  private toDateKey(date: Date): string {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
  }

  private getOrderPayload() {
    return this.orderForm.getRawValue();
  }

  private scheduleDateValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const dueDate = control.get('dueDate')?.value as string | null;
      const productionStartDate = control.get('productionStartDate')?.value as string | null;

      if (!dueDate || !productionStartDate) {
        return null;
      }

      if (dueDate < this.minimumScheduleDate || productionStartDate < this.minimumScheduleDate) {
        return { pastScheduleDate: true };
      }

      if (productionStartDate > dueDate) {
        return { startDateAfterDueDate: true };
      }

      return null;
    };
  }

  private getScheduleDateErrorMessage(): string | null {
    const bagForm = this.orderForm.controls.bag;

    if (bagForm.hasError('pastScheduleDate')) {
      return 'Production start and dispatch dates cannot be in the past.';
    }

    if (bagForm.hasError('startDateAfterDueDate')) {
      return 'Production start date must be on or before the dispatch date.';
    }

    return null;
  }

  private getErrorMessage(error: unknown, fallback: string): string {
    const responseMessage = (error as { error?: { message?: string | string[] } })?.error?.message;

    if (Array.isArray(responseMessage)) {
      return responseMessage[0] ?? fallback;
    }

    return responseMessage ?? fallback;
  }
}
