import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import jsPDF from 'jspdf';

import { AuthService } from '../../core/auth/auth.service';
import { DashboardOrder, OrderArtifact, OrderDetails, OrderService } from '../../core/orders/order.service';

type OrderStatus = 'Ready to pick' | 'In progress' | 'Complete';
type OrderTab = 'current' | 'due' | 'completed';
type DownloadSection = 'all' | 'cutting' | 'printing' | 'address';

type Order = DashboardOrder;
type CutPieceHighlight = 'none' | 'juco' | 'natural';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly orderService = inject(OrderService);
  private readonly router = inject(Router);

  protected readonly activeTab = signal<OrderTab>('current');
  protected readonly searchTerm = signal('');
  protected readonly currentPage = signal(1);
  protected readonly pageSize = signal(25);
  protected readonly pageSizeOptions = [10, 25, 50, 75, 100];
  protected readonly orders = signal<Order[]>([]);
  protected readonly isLoading = signal(false);
  protected readonly openStatusMenu = signal<string | null>(null);
  protected readonly openDownloadMenu = signal<string | null>(null);
  protected readonly orderPendingEdit = signal<Order | null>(null);
  protected readonly orderPendingArtifacts = signal<Order | null>(null);
  protected readonly orderArtifacts = signal<OrderArtifact[]>([]);
  protected readonly isArtifactsLoading = signal(false);
  protected readonly orderPendingCompletion = signal<Order | null>(null);
  protected readonly completionOrderDetails = signal<OrderDetails | null>(null);
  protected readonly isCompletionPreviewLoading = signal(false);
  protected readonly completionProofFile = signal<File | null>(null);
  protected readonly completionProofPreviewUrl = signal<string | null>(null);
  protected readonly completionProofFileName = signal<string | null>(null);
  protected readonly statusOptions: OrderStatus[] = ['Ready to pick', 'In progress', 'Complete'];
  protected readonly canEditOrders = this.authService.canAccessSales;

  protected readonly tabs: { id: OrderTab; label: string }[] = [
    { id: 'current', label: 'Current orders' },
    { id: 'due', label: 'Due orders' },
    { id: 'completed', label: 'Completed orders' },
  ];

  private readonly today = new Date(new Date().setHours(0, 0, 0, 0));

  protected readonly dueOrdersCount = computed(
    () =>
      this.orders().filter(
        (order) => order.status !== 'Complete' && this.toDate(order.dueDate) < this.today,
      ).length,
  );

  protected readonly filteredOrders = computed(() => {
    const activeTab = this.activeTab();
    const searchTerm = this.searchTerm().trim().toLowerCase();

    const filteredOrders = this.orders()
      .filter((order) => {
        const dueDate = this.toDate(order.dueDate);

        if (activeTab === 'completed') {
          return order.status === 'Complete';
        }

        if (activeTab === 'due') {
          return order.status !== 'Complete' && dueDate < this.today;
        }

        return order.status !== 'Complete' && dueDate >= this.today;
      })
      .filter((order) => {
        if (!searchTerm) {
          return true;
        }

        return [
          order.id,
          order.orderNumber,
          order.size,
        ].some((value) => value.toLowerCase().includes(searchTerm));
      });

    if (activeTab === 'completed') {
      return filteredOrders.sort(
        (first, second) =>
          this.toDate(second.updatedDate).getTime() - this.toDate(first.updatedDate).getTime(),
      );
    }

    return filteredOrders.sort(
      (first, second) => this.toDate(first.dueDate).getTime() - this.toDate(second.dueDate).getTime(),
    );
  });

  protected readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredOrders().length / this.pageSize())),
  );

  protected readonly visibleOrders = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize();
    return this.filteredOrders().slice(start, start + this.pageSize());
  });

  protected readonly pageNumbers = computed(() =>
    Array.from({ length: this.totalPages() }, (_, index) => index + 1),
  );

  protected readonly resultStart = computed(() =>
    this.filteredOrders().length === 0 ? 0 : (this.currentPage() - 1) * this.pageSize() + 1,
  );

  protected readonly resultEnd = computed(() =>
    Math.min(this.currentPage() * this.pageSize(), this.filteredOrders().length),
  );

  ngOnInit(): void {
    this.loadOrders();
  }

  protected selectTab(tab: OrderTab): void {
    this.activeTab.set(tab);
    this.currentPage.set(1);
  }

  protected changePageSize(event: Event): void {
    this.pageSize.set(Number((event.target as HTMLSelectElement).value));
    this.currentPage.set(1);
  }

  protected updateSearchTerm(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
    this.currentPage.set(1);
  }

  protected clearSearch(): void {
    this.searchTerm.set('');
    this.currentPage.set(1);
  }

  protected goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
    }
  }

  protected formatDateTime(date: string): string {
    if (!date) {
      return '-';
    }

    return this.toDate(date).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  }

  protected formatDate(date: string): string {
    if (!date) {
      return '-';
    }

    return this.toDate(date).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  protected statusClass(status: OrderStatus): string {
    return status.toLowerCase().replaceAll(' ', '-');
  }

  protected toggleStatusMenu(orderNumber: string): void {
    this.openDownloadMenu.set(null);
    this.openStatusMenu.update((currentOrderNumber) =>
      currentOrderNumber === orderNumber ? null : orderNumber,
    );
  }

  protected toggleDownloadMenu(orderNumber: string): void {
    this.openStatusMenu.set(null);
    this.openDownloadMenu.update((currentOrderNumber) =>
      currentOrderNumber === orderNumber ? null : orderNumber,
    );
  }

  protected updateStatus(order: Order, status: OrderStatus): void {
    this.openStatusMenu.set(null);

    if (status === 'Complete') {
      this.openCompletionModal(order);
      return;
    }

    this.orderService.updateOrderStatus(order.id, status).subscribe({
      next: (updatedOrder) => {
        this.orders.update((orders) =>
          orders.map((currentOrder) =>
            currentOrder.id === updatedOrder.id
              ? { ...currentOrder, status: updatedOrder.status }
              : currentOrder,
          ),
        );
      },
    });
  }

  protected designImageUrl(design: OrderDetails['designs'][number]): string | null {
    return this.orderService.getUploadedFileUrl(design.uploadedFile);
  }

  protected handleCompletionProofUpload(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0] ?? null;

    this.revokeCompletionProofPreview();

    if (!file) {
      this.completionProofFile.set(null);
      this.completionProofFileName.set(null);
      return;
    }

    this.completionProofFile.set(file);
    this.completionProofFileName.set(file.name);
    this.completionProofPreviewUrl.set(URL.createObjectURL(file));
  }

  protected removeCompletionProof(): void {
    this.completionProofFile.set(null);
    this.completionProofFileName.set(null);
    this.revokeCompletionProofPreview();
  }

  protected cancelCompletion(): void {
    this.orderPendingCompletion.set(null);
    this.completionOrderDetails.set(null);
    this.isCompletionPreviewLoading.set(false);
    this.completionProofFile.set(null);
    this.completionProofFileName.set(null);
    this.revokeCompletionProofPreview();
  }

  protected confirmCompletion(): void {
    const order = this.orderPendingCompletion();
    const completionProof = this.completionProofFile();

    if (!order || !completionProof) {
      return;
    }

    this.orderService.completeOrder(order.id, completionProof).subscribe({
      next: (updatedOrder) => {
        this.orders.update((orders) =>
          orders.map((currentOrder) =>
            currentOrder.id === updatedOrder.id
              ? { ...currentOrder, status: updatedOrder.status }
              : currentOrder,
          ),
        );
        this.cancelCompletion();
      },
    });
  }

  protected openArtifactsModal(order: Order): void {
    this.openStatusMenu.set(null);
    this.openDownloadMenu.set(null);
    this.orderPendingArtifacts.set(order);
    this.orderArtifacts.set([]);
    this.isArtifactsLoading.set(true);

    this.orderService.getOrderArtifacts(order.id).subscribe({
      next: (artifacts) => {
        this.orderArtifacts.set(artifacts);
        this.isArtifactsLoading.set(false);
      },
      error: () => {
        this.orderArtifacts.set([]);
        this.isArtifactsLoading.set(false);
      },
    });
  }

  protected closeArtifactsModal(): void {
    this.orderPendingArtifacts.set(null);
    this.orderArtifacts.set([]);
    this.isArtifactsLoading.set(false);
  }

  protected artifactActorLabel(artifact: OrderArtifact): string {
    return artifact.actor.name || artifact.actor.email || 'Unknown user';
  }

  protected artifactMetadataValue(artifact: OrderArtifact, key: string): string | null {
    const value = artifact.metadata?.[key];

    return typeof value === 'string' && value ? value : null;
  }

  protected editOrder(order: Order): void {
    if (order.status === 'In progress') {
      this.orderPendingEdit.set(order);
      return;
    }

    this.openOrderForEditing(order);
  }

  protected cancelEditOrder(): void {
    this.orderPendingEdit.set(null);
  }

  protected confirmEditOrder(): void {
    const order = this.orderPendingEdit();

    if (!order) {
      return;
    }

    this.orderPendingEdit.set(null);
    this.openOrderForEditing(order);
  }

  private openOrderForEditing(order: Order): void {
    this.router.navigate(['/sales'], {
      queryParams: {
        orderId: order.id,
      },
    });
  }

  private openCompletionModal(order: Order): void {
    this.orderPendingCompletion.set(order);
    this.completionOrderDetails.set(null);
    this.completionProofFileName.set(null);
    this.revokeCompletionProofPreview();
    this.isCompletionPreviewLoading.set(true);

    this.orderService.getOrder(order.id).subscribe({
      next: (orderDetails) => {
        this.completionOrderDetails.set(orderDetails);
        this.isCompletionPreviewLoading.set(false);
      },
      error: () => {
        this.isCompletionPreviewLoading.set(false);
      },
    });
  }

  protected downloadOrder(order: Order): void {
    this.downloadOrderSection(order, 'all');
  }

  protected downloadOrderSection(order: Order, section: DownloadSection): void {
    this.openDownloadMenu.set(null);

    this.orderService.getOrder(order.id).subscribe({
      next: (orderDetails) => {
        void this.downloadOrderPdf(orderDetails, section);
      },
    });
  }

  private loadOrders(): void {
    this.isLoading.set(true);

    this.orderService.getOrders().subscribe({
      next: (orders) => {
        this.orders.set(orders);
        this.currentPage.set(1);
        this.isLoading.set(false);
      },
      error: () => {
        this.orders.set([]);
        this.isLoading.set(false);
      },
    });
  }

  private toDate(date: string): Date {
    return date.includes('T') ? new Date(date) : new Date(`${date}T00:00:00`);
  }

  private async downloadOrderPdf(order: OrderDetails, section: DownloadSection): Promise<void> {
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    if (section === 'cutting') {
      this.addCuttingPage(pdf, order);
    }

    if (section === 'printing') {
      await this.addDesignPages(pdf, order, false);
    }

    if (section === 'address') {
      this.addCustomerPage(pdf, order, false);
    }

    if (section === 'all') {
      this.addCuttingPage(pdf, order);
      await this.addDesignPages(pdf, order);
      this.addCustomerPage(pdf, order);
    }

    pdf.save(`${order.orderNumber}-${section === 'all' ? 'order-details' : section}.pdf`);
  }

  private addPageHeader(pdf: jsPDF, orderNumber: string): void {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(17);
    pdf.text(orderNumber, 105, 15, { align: 'center' });
    pdf.setDrawColor(232, 225, 237);
    pdf.line(14, 21, 196, 21);
  }

  private addSectionTitle(pdf: jsPDF, title: string, y: number): number {
    pdf.setFillColor(248, 245, 250);
    pdf.roundedRect(14, y, 182, 10, 2, 2, 'F');
    pdf.setTextColor(92, 32, 168);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.text(title, 18, y + 6.5);
    pdf.setTextColor(33, 26, 46);
    return y + 16;
  }

  private addLabelValue(pdf: jsPDF, label: string, value: string, x: number, y: number): void {
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(85, 76, 98);
    pdf.text(`${label}:`, x, y);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(33, 26, 46);
    pdf.text(value || '-', x + 34, y);
  }

  private addWrappedText(pdf: jsPDF, text: string, x: number, y: number, width: number, lineHeight = 5): number {
    const lines = pdf.splitTextToSize(text || '-', width);
    pdf.text(lines, x, y);
    return y + lines.length * lineHeight;
  }

  private addCuttingPage(pdf: jsPDF, order: OrderDetails): void {
    const bag = order.bag;
    const quantity = bag.quantity ?? 0;
    const width = Number(bag.width ?? 0);
    const displayHeight = Number(bag.height ?? 0);
    const gusset = Number(bag.gusset ?? 0);
    const cutDimensions = this.getCutDimensions(width, displayHeight, gusset);
    const height = cutDimensions.frontBackHeight;
    const gussetHeight = cutDimensions.gussetLength;
    const gussetWidth = cutDimensions.gussetWidth;
    const zipWidth = width - 1;
    const zipHeight = gusset + 1;
    const color = bag.color ?? '-';
    const fabric = this.normalizeFabricLabel(bag.fabric);
    const lowerColor = color.toLowerCase();
    const isCombination = lowerColor.includes('combination') || lowerColor.includes('white and natural');
    const frontBackColor = isCombination ? 'white' : color;
    const gussetColor = isCombination ? 'natural' : color;
    const zipColor = isCombination ? 'white' : color;

    this.addPageHeader(pdf, order.orderNumber);
    let y = this.addSectionTitle(pdf, 'Cutting dimensions', 29);
    this.addLabelValue(pdf, 'Bag size', `${width}w x ${displayHeight}h x ${gusset}g`, 18, y);
    this.addLabelValue(pdf, 'Bag count', `${quantity} bags`, 112, y);
    y += 8;
    this.addLabelValue(pdf, 'Color', color, 18, y);
    this.addLabelValue(pdf, 'Fabric', bag.fabric ?? '-', 112, y);
    y += 8;
    this.addLabelValue(pdf, 'Handle', bag.handle ?? '-', 18, y);
    this.addLabelValue(pdf, 'Print', bag.print ?? '-', 112, y);
    y += 8;
    this.addLabelValue(pdf, 'Closure', bag.zip ?? '-', 18, y);
    this.addLabelValue(pdf, 'Due date', this.formatDate(bag.dueDate ?? ''), 112, y);
    y += 10;

    if (bag.notes) {
      pdf.setFont('helvetica', 'bold');
      pdf.text('Notes:', 18, y);
      pdf.setFont('helvetica', 'normal');
      y = this.addWrappedText(pdf, bag.notes, 52, y, 138);
      y += 5;
    }

    y = this.addSectionTitle(pdf, 'Cut pieces', y);
    y = this.addCutLine(
      pdf,
      `${this.formatNumber(width)} x ${this.formatNumber(height)} ${quantity * 2}pcs ${fabric} ${frontBackColor}`,
      y,
      fabric,
      frontBackColor,
    );
    y = this.addMeasurementTable(pdf, width, y);
    y = this.addMeasurementTable(pdf, height, y) + 5;
    y = this.addCutLine(
      pdf,
      `${this.formatNumber(gussetHeight)} x ${this.formatNumber(gussetWidth)} ${quantity}pcs ${fabric} ${gussetColor}`,
      y,
      fabric,
      gussetColor,
    );
    y = this.addMeasurementTable(pdf, gussetHeight, y);
    y = this.addMeasurementTable(pdf, gussetWidth, y) + 5;

    if ((bag.zip ?? '').toLowerCase() === 'zip') {
      y = this.addCutLine(
        pdf,
        `${this.formatNumber(zipWidth)} x ${this.formatNumber(zipHeight)} ${quantity}pcs ${fabric} ${zipColor}`,
        y,
        fabric,
        zipColor,
      );
      y = this.addMeasurementTable(pdf, zipWidth, y);
      this.addMeasurementTable(pdf, zipHeight, y);
    }

    pdf.setDrawColor(232, 225, 237);
    pdf.line(14, 220, 196, 220);
    this.drawBagShape(pdf, width, displayHeight);
  }

  private addCutLine(pdf: jsPDF, text: string, y: number, fabric: string, pieceColor: string): number {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.setTextColor(33, 26, 46);
    this.addCutLineHighlight(pdf, text, y, fabric, pieceColor);
    pdf.text(text, 21, y);
    return y + 8;
  }

  private addCutLineHighlight(
    pdf: jsPDF,
    text: string,
    y: number,
    fabric: string,
    pieceColor: string,
  ): void {
    const highlight = this.getCutPieceHighlight(fabric, pieceColor);
    const lineWidth = pdf.getTextWidth(text);
    const lineX = 20;
    const lineY = y - 5.2;
    const lineHeight = 6.8;

    if (highlight === 'juco') {
      pdf.setFillColor(250, 204, 72);
      pdf.rect(lineX, lineY, lineWidth + 3, lineHeight, 'F');
    }

    if (highlight === 'natural') {
      const dimensionText = text.match(/^([\d.]+\s*x\s*[\d.]+)/)?.[0] ?? text;
      const dimensionWidth = pdf.getTextWidth(dimensionText);
      pdf.setFillColor(232, 196, 164);
      pdf.rect(lineX, lineY, dimensionWidth + 1.2, lineHeight, 'F');
    }
  }

  private getCutPieceHighlight(fabric: string, pieceColor: string): CutPieceHighlight {
    const normalizedFabric = fabric.toLowerCase();
    const normalizedColor = pieceColor.toLowerCase();

    if (normalizedColor.includes('natural') || normalizedColor.includes('brown')) {
      return 'natural';
    }

    if (normalizedFabric.includes('juco')) {
      return 'juco';
    }

    return 'none';
  }

  private addMeasurementTable(pdf: jsPDF, value: number, y: number): number {
    const table = this.generateMultiplicationTable(value);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9.5);
    pdf.setTextColor(85, 76, 98);
    pdf.text(table, 16, y);
    return y + 6;
  }

  private async addDesignPages(pdf: jsPDF, order: OrderDetails, addPageBeforeFirst = true): Promise<void> {
    const designs = order.designs.length ? order.designs : [{ fileName: 'No design added', notes: '-', uploadedFile: null }];

    for (const [index, design] of designs.entries()) {
      if (addPageBeforeFirst || index > 0) {
        pdf.addPage();
      }

      this.addPageHeader(pdf, order.orderNumber);
      let y = this.addSectionTitle(pdf, 'Print details', 29);
      y = this.addPrintDimensionSummary(pdf, order, y);

      const cardY = y;
      pdf.setDrawColor(232, 225, 237);
      pdf.roundedRect(12, cardY, 186, 211, 2, 2, 'S');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      pdf.setTextColor(33, 26, 46);
      pdf.text(`Design ${index + 1}`, 16, cardY + 8);

      const fileName = design.fileName || design.uploadedFile?.originalName || 'No file selected';
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.setTextColor(85, 76, 98);
      pdf.text(this.truncateText(pdf, fileName, 118), 44, cardY + 8);

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.setTextColor(33, 26, 46);
      pdf.text('Description:', 16, cardY + 17);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.setTextColor(85, 76, 98);
      pdf.text(this.truncateText(pdf, design.notes || '-', 141), 49, cardY + 17);

      const imageX = 16;
      const imageY = cardY + 27;
      const imageW = 178;
      const imageH = 179;
      pdf.setFillColor(248, 245, 250);
      pdf.roundedRect(imageX, imageY, imageW, imageH, 2, 2, 'F');

      if (design.uploadedFile?.url && design.uploadedFile.mimeType.startsWith('image/')) {
        try {
          const imageUrl = this.orderService.getUploadedFileUrl(design.uploadedFile);

          if (!imageUrl) {
            throw new Error('Missing design image URL');
          }

          const image = await this.loadImage(imageUrl);
          const dimensions = this.fitImage(image.width, image.height, imageW, imageH);
          pdf.addImage(
            image,
            design.uploadedFile.mimeType.includes('png') ? 'PNG' : 'JPEG',
            imageX + dimensions.x,
            imageY + dimensions.y,
            dimensions.width,
            dimensions.height,
          );
        } catch {
          this.addImagePlaceholder(pdf, imageX, imageY, imageW, imageH, 'Image unavailable');
        }
      } else {
        this.addImagePlaceholder(pdf, imageX, imageY, imageW, imageH, 'No image preview');
      }
    }
  }

  private addPrintDimensionSummary(pdf: jsPDF, order: OrderDetails, y: number): number {
    const width = Number(order.bag.width ?? 0);
    const displayHeight = Number(order.bag.height ?? 0);
    const gusset = Number(order.bag.gusset ?? 0);
    const cutDimensions = this.getCutDimensions(width, displayHeight, gusset);
    const height = cutDimensions.frontBackHeight;
    const gussetWidth = cutDimensions.gussetLength;
    const gussetHeight = cutDimensions.gussetWidth;

    pdf.setFillColor(255, 252, 242);
    pdf.setDrawColor(238, 226, 198);
    pdf.roundedRect(12, y - 5, 186, 20, 2, 2, 'FD');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9.5);
    pdf.setTextColor(33, 26, 46);
    pdf.text(
      `Front part: ${this.formatNumber(width)} w (${this.toMillimetres(width)}) x ${this.formatNumber(height)} h (${this.toMillimetres(height)})`,
      20,
      y + 2,
    );
    pdf.text(
      `Gusset part: ${this.formatNumber(gussetWidth)} w (${this.toMillimetres(gussetWidth)}) x ${this.formatNumber(gussetHeight)} h (${this.toMillimetres(gussetHeight)})`,
      20,
      y + 10,
    );

    return y + 21;
  }

  private getCutDimensions(width: number, displayHeight: number, gusset: number) {
    const frontBackHeight = displayHeight + 0.5;
    const gussetLength = frontBackHeight + width + frontBackHeight + 0.25;
    const gussetWidth = gusset + 2.25;

    return {
      frontBackHeight,
      gussetLength,
      gussetWidth,
    };
  }

  private addCustomerPage(pdf: jsPDF, order: OrderDetails, addPageBefore = true): void {
    if (addPageBefore) {
      pdf.addPage();
    }

    this.addPageHeader(pdf, order.orderNumber);
    let y = this.addSectionTitle(pdf, 'Customer and dispatch details', 29);
    const customer = order.customer;

    this.addLabelValue(pdf, 'Customer', customer.name || '-', 18, y);
    this.addLabelValue(pdf, 'Phone', customer.phone || '-', 112, y);
    y += 9;
    this.addLabelValue(pdf, 'Alt phone', customer.alternatePhone || '-', 18, y);
    this.addLabelValue(pdf, 'Courier', customer.courierType || '-', 112, y);
    y += 11;

    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(85, 76, 98);
    pdf.text('Address:', 18, y);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(33, 26, 46);
    y = this.addWrappedText(pdf, customer.address || '-', 52, y, 138);
    y += 8;

    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(85, 76, 98);
    pdf.text('Courier notes:', 18, y);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(33, 26, 46);
    y = this.addWrappedText(pdf, customer.courierNotes || '-', 52, y, 138);

    y += 16;
    y = this.addSectionTitle(pdf, 'Order summary', y);
    this.addLabelValue(pdf, 'Quantity', `${order.bag.quantity ?? '-'}`, 18, y);
    this.addLabelValue(pdf, 'Due date', this.formatDate(order.bag.dueDate ?? ''), 112, y);
    y += 9;
    this.addLabelValue(pdf, 'Updated', this.formatDateTime(order.updatedDate), 18, y);
    this.addLabelValue(pdf, 'Status', order.status, 112, y);
  }

  private drawBagShape(pdf: jsPDF, width: number, height: number): void {
    const base = 34;
    let rectWidth = base;
    let rectHeight = base;

    if (width > height) {
      rectWidth = base * 1.4;
    }

    if (height > width) {
      rectHeight = base * 1.3;
    }

    const x = (210 - rectWidth) / 2;
    const y = 252 - rectHeight / 2;
    pdf.setDrawColor(33, 26, 46);
    pdf.setLineWidth(1.1);
    pdf.rect(x, y, rectWidth, rectHeight);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.text(width === height ? 'Square' : width > height ? 'Landscape' : 'Portrait', 105, y + rectHeight / 2 + 2, {
      align: 'center',
    });
  }

  private addImagePlaceholder(pdf: jsPDF, x: number, y: number, width: number, height: number, text: string): void {
    pdf.setDrawColor(232, 225, 237);
    pdf.roundedRect(x + 4, y + 4, width - 8, height - 8, 2, 2, 'S');
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(140, 132, 149);
    pdf.text(text, x + width / 2, y + height / 2, { align: 'center' });
  }

  private generateMultiplicationTable(value: number): string {
    return Array.from({ length: 18 }, (_, index) => this.formatNumber(value * (index + 1))).join('  ');
  }

  private formatNumber(value: number): string {
    return Number.isInteger(value) ? `${value}` : value.toFixed(2).replace(/\.?0+$/, '');
  }

  private truncateText(pdf: jsPDF, text: string, maxWidth: number): string {
    const value = text || '-';

    if (pdf.getTextWidth(value) <= maxWidth) {
      return value;
    }

    let truncated = value;

    while (truncated.length > 0 && pdf.getTextWidth(`${truncated}...`) > maxWidth) {
      truncated = truncated.slice(0, -1);
    }

    return `${truncated.trimEnd()}...`;
  }

  private toMillimetres(inches: number): string {
    return this.formatNumber(inches * 25.4);
  }

  private normalizeFabricLabel(fabric: string | null): string {
    return (fabric || 'Jute').toLowerCase().includes('juco') ? 'Juco' : 'Jute';
  }

  private loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.crossOrigin = 'anonymous';
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = url;
    });
  }

  private fitImage(imageWidth: number, imageHeight: number, maxWidth: number, maxHeight: number) {
    const ratio = Math.min(maxWidth / imageWidth, maxHeight / imageHeight);
    const width = imageWidth * ratio;
    const height = imageHeight * ratio;

    return {
      x: (maxWidth - width) / 2,
      y: (maxHeight - height) / 2,
      width,
      height,
    };
  }

  private revokeCompletionProofPreview(): void {
    const previewUrl = this.completionProofPreviewUrl();

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      this.completionProofPreviewUrl.set(null);
    }
  }
}
