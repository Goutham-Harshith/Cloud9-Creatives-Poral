import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';

import { OrderDetails, OrderService, UploadedOrderFile } from '../../core/orders/order.service';

type WizardStep = 1 | 2 | 3;

@Component({
  selector: 'app-sales',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './sales.html',
  styleUrl: './sales.scss',
})
export class Sales implements OnInit {

  constructor(
    private router : Router,
    private route: ActivatedRoute,
    private toastrService: ToastrService,
    private orderService: OrderService

  ){}

  private readonly formBuilder = inject(FormBuilder);

  protected readonly fabrics = ['Jute', 'Juco'];
  protected readonly zipOptions = ['None', 'Zip', 'Velcro', 'Button'];
  protected readonly colors = ['White', 'Natural', 'Combination'];
  protected readonly handles = ['Natural tape', 'White tape', 'Natural rope', 'White rope'];
  protected readonly prints = ['Plain', 'Single Print', 'Double Print', 'Full Print'];
  protected readonly courierTypes = ['Professional couriers', 'APSRTC', 'Self pickup', 'Others'];

  protected currentStep: WizardStep = 1;
  protected isSubmitting = false;
  protected isDeleting = false;
  protected readonly previewDialog = signal<{ url: string; name: string } | null>(null);
  protected readonly showDeleteConfirmation = signal(false);
  protected orderNumber = '';
  private editOrderId: string | null = null;

  protected readonly orderForm = this.formBuilder.group({
    bag: this.formBuilder.group({
      fabric: ['', Validators.required],
      quantity: [null as number | null, Validators.required],
      dueDate: ['', Validators.required],
      width: [null as number | null, Validators.required],
      height: [null as number | null, Validators.required],
      gusset: [null as number | null, Validators.required],
      zip: ['', Validators.required],
      color: ['', Validators.required],
      handle: ['', Validators.required],
      print: ['', Validators.required],
      notes: [''],
    }),
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

    if (this.editOrderId) {
      this.loadOrder(this.editOrderId);
    }
  }

  protected get showCourierNotes(): boolean {
    return this.orderForm.controls.customer.controls.courierType.value === 'Others';
  }

  protected goBack(): void {
    if (this.currentStep > 1) {
      this.currentStep = (this.currentStep - 1) as WizardStep;
    }
  }

  protected goNext(): void {
    if (this.currentStep === 1 && this.orderForm.controls.bag.invalid) {
      this.orderForm.controls.bag.markAllAsTouched();
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
      return;
    }

    this.isSubmitting = true;
    const isEditMode = this.isEditMode;
    const request = this.editOrderId
      ? this.orderService.updateOrder(this.editOrderId, this.orderForm.getRawValue())
      : this.orderService.createOrder(this.orderForm.getRawValue());

    request.subscribe({
      next: () => {
        this.isSubmitting = false;
        this.resetForm();
        this.router.navigate(['/dashboard']);
        this.toastrService.success(
          isEditMode ? 'Order updated successfully' : 'Order created successfully',
        );
      },
      error: () => {
        this.isSubmitting = false;
        this.toastrService.error(
          this.isEditMode ? 'Unable to update order. Please try again.' : 'Unable to create order. Please try again.',
        );
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
    this.orderForm.reset({
      bag: {
        fabric: '',
        quantity: null,
        dueDate: '',
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
}
