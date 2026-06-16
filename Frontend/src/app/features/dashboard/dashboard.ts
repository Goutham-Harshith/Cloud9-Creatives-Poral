import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { DashboardOrder, OrderService } from '../../core/orders/order.service';

type OrderStatus = 'Ready to pick' | 'In progress' | 'Complete';
type OrderTab = 'current' | 'due' | 'completed';

type Order = DashboardOrder;

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard implements OnInit {
  private readonly orderService = inject(OrderService);
  private readonly router = inject(Router);

  protected readonly activeTab = signal<OrderTab>('current');
  protected readonly currentPage = signal(1);
  protected readonly pageSize = signal(5);
  protected readonly pageSizeOptions = [10, 25, 50, 75, 100];
  protected readonly orders = signal<Order[]>([]);
  protected readonly isLoading = signal(false);
  protected readonly openStatusMenu = signal<string | null>(null);
  protected readonly statusOptions: OrderStatus[] = ['Ready to pick', 'In progress', 'Complete'];

  protected readonly tabs: { id: OrderTab; label: string }[] = [
    { id: 'current', label: 'Current orders' },
    { id: 'due', label: 'Due orders' },
    { id: 'completed', label: 'Completed orders' },
  ];

  private readonly today = new Date(new Date().setHours(0, 0, 0, 0));

  protected readonly filteredOrders = computed(() => {
    const activeTab = this.activeTab();

    return this.orders()
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
      .sort(
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

  protected goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
    }
  }

  protected formatDate(date: string): string {
    return this.toDate(date).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  }

  protected statusClass(status: OrderStatus): string {
    return status.toLowerCase().replaceAll(' ', '-');
  }

  protected toggleStatusMenu(orderNumber: string): void {
    this.openStatusMenu.update((currentOrderNumber) =>
      currentOrderNumber === orderNumber ? null : orderNumber,
    );
  }

  protected updateStatus(order: Order, status: OrderStatus): void {
    this.openStatusMenu.set(null);

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

  protected editOrder(order: Order): void {
    this.router.navigate(['/admin'], {
      queryParams: {
        orderId: order.id,
      },
    });
  }

  protected downloadOrder(order: Order): void {
    const lines = [
      'Cloud9 Creatives',
      'Order details',
      '',
      `Order number: ${order.orderNumber}`,
      `Type: ${order.type}`,
      `Size: ${order.size}`,
      `Updated date: ${this.formatDate(order.updatedDate)}`,
      `Status: ${order.status}`,
      `Due date: ${this.formatDate(order.dueDate)}`,
    ];
    const pdf = this.createPdf(lines);
    const url = URL.createObjectURL(new Blob([pdf], { type: 'application/pdf' }));
    const link = document.createElement('a');

    link.href = url;
    link.download = `${order.orderNumber}-order-details.pdf`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
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

  private createPdf(lines: string[]): string {
    const escapeText = (text: string) =>
      text.replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)');
    const content = [
      'BT',
      '/F1 18 Tf',
      '72 760 Td',
      ...lines.flatMap((line, index) => [
        index === 0 ? `(${escapeText(line)}) Tj` : `0 -28 Td (${escapeText(line)}) Tj`,
        index === 1 ? '/F1 12 Tf' : '',
      ]),
      'ET',
    ]
      .filter(Boolean)
      .join('\n');
    const objects = [
      '<< /Type /Catalog /Pages 2 0 R >>',
      '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
      `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    ];
    let pdf = '%PDF-1.4\n';
    const offsets = [0];

    objects.forEach((object, index) => {
      offsets.push(pdf.length);
      pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
    });

    const xrefOffset = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    pdf += offsets
      .slice(1)
      .map((offset) => `${offset.toString().padStart(10, '0')} 00000 n \n`)
      .join('');
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

    return pdf;
  }
}
