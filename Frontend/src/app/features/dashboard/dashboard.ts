import { Component, computed, signal } from '@angular/core';

type OrderStatus = 'Ready to pick' | 'In progress' | 'Complete';
type OrderTab = 'current' | 'due' | 'completed';

interface Order {
  orderNumber: string;
  type: 'Jute' | 'Juco' | 'Paper';
  size: string;
  updatedDate: string;
  status: OrderStatus;
  dueDate: string;
}

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  protected readonly activeTab = signal<OrderTab>('current');
  protected readonly currentPage = signal(1);
  protected readonly pageSize = signal(5);
  protected readonly pageSizeOptions = [10, 25, 50, 75, 100];

  protected readonly tabs: { id: OrderTab; label: string }[] = [
    { id: 'current', label: 'Current orders' },
    { id: 'due', label: 'Due orders' },
    { id: 'completed', label: 'Completed orders' },
  ];

  private readonly today = new Date(new Date().setHours(0, 0, 0, 0));

  private readonly orders: Order[] = [
    {
      orderNumber: 'C9-1054',
      type: 'Jute',
      size: '10w x 12h x 5g',
      updatedDate: '2026-06-15',
      status: 'In progress',
      dueDate: '2026-06-18',
    },
    {
      orderNumber: 'C9-1052',
      type: 'Paper',
      size: '8w x 10h x 4g',
      updatedDate: '2026-06-14',
      status: 'Ready to pick',
      dueDate: '2026-06-20',
    },
    {
      orderNumber: 'C9-1051',
      type: 'Juco',
      size: '14w x 16h x 6g',
      updatedDate: '2026-06-12',
      status: 'In progress',
      dueDate: '2026-06-24',
    },
    {
      orderNumber: 'C9-1050',
      type: 'Jute',
      size: '11w x 13h x 5g',
      updatedDate: '2026-06-13',
      status: 'Ready to pick',
      dueDate: '2026-06-26',
    },
    {
      orderNumber: 'C9-1047',
      type: 'Paper',
      size: '7w x 9h x 3g',
      updatedDate: '2026-06-12',
      status: 'In progress',
      dueDate: '2026-06-28',
    },
    {
      orderNumber: 'C9-1045',
      type: 'Juco',
      size: '16w x 18h x 7g',
      updatedDate: '2026-06-10',
      status: 'Ready to pick',
      dueDate: '2026-07-01',
    },
    {
      orderNumber: 'C9-1043',
      type: 'Jute',
      size: '9w x 12h x 4g',
      updatedDate: '2026-06-09',
      status: 'In progress',
      dueDate: '2026-07-03',
    },
    {
      orderNumber: 'C9-1041',
      type: 'Paper',
      size: '13w x 15h x 5g',
      updatedDate: '2026-06-07',
      status: 'Ready to pick',
      dueDate: '2026-07-06',
    },
    {
      orderNumber: 'C9-1039',
      type: 'Juco',
      size: '12w x 16h x 6g',
      updatedDate: '2026-06-05',
      status: 'In progress',
      dueDate: '2026-07-09',
    },
    {
      orderNumber: 'C9-1049',
      type: 'Jute',
      size: '12w x 14h x 5g',
      updatedDate: '2026-06-13',
      status: 'In progress',
      dueDate: '2026-06-14',
    },
    {
      orderNumber: 'C9-1048',
      type: 'Paper',
      size: '9w x 11h x 4g',
      updatedDate: '2026-06-11',
      status: 'Ready to pick',
      dueDate: '2026-06-15',
    },
    {
      orderNumber: 'C9-1042',
      type: 'Juco',
      size: '11w x 14h x 5g',
      updatedDate: '2026-06-08',
      status: 'In progress',
      dueDate: '2026-06-12',
    },
    {
      orderNumber: 'C9-1040',
      type: 'Paper',
      size: '8w x 12h x 4g',
      updatedDate: '2026-06-06',
      status: 'Ready to pick',
      dueDate: '2026-06-10',
    },
    {
      orderNumber: 'C9-1038',
      type: 'Jute',
      size: '13w x 17h x 6g',
      updatedDate: '2026-06-04',
      status: 'In progress',
      dueDate: '2026-06-08',
    },
    {
      orderNumber: 'C9-1036',
      type: 'Juco',
      size: '10w x 15h x 5g',
      updatedDate: '2026-06-02',
      status: 'Ready to pick',
      dueDate: '2026-06-05',
    },
    {
      orderNumber: 'C9-1034',
      type: 'Paper',
      size: '9w x 10h x 4g',
      updatedDate: '2026-05-30',
      status: 'In progress',
      dueDate: '2026-06-02',
    },
    {
      orderNumber: 'C9-1046',
      type: 'Juco',
      size: '10w x 13h x 5g',
      updatedDate: '2026-06-10',
      status: 'Complete',
      dueDate: '2026-06-11',
    },
    {
      orderNumber: 'C9-1044',
      type: 'Jute',
      size: '15w x 18h x 7g',
      updatedDate: '2026-06-08',
      status: 'Complete',
      dueDate: '2026-06-09',
    },
    {
      orderNumber: 'C9-1037',
      type: 'Paper',
      size: '8w x 11h x 4g',
      updatedDate: '2026-06-03',
      status: 'Complete',
      dueDate: '2026-06-06',
    },
    {
      orderNumber: 'C9-1035',
      type: 'Jute',
      size: '12w x 15h x 5g',
      updatedDate: '2026-06-01',
      status: 'Complete',
      dueDate: '2026-06-04',
    },
    {
      orderNumber: 'C9-1033',
      type: 'Juco',
      size: '14w x 17h x 6g',
      updatedDate: '2026-05-29',
      status: 'Complete',
      dueDate: '2026-06-01',
    },
    {
      orderNumber: 'C9-1031',
      type: 'Paper',
      size: '7w x 10h x 3g',
      updatedDate: '2026-05-27',
      status: 'Complete',
      dueDate: '2026-05-29',
    },
    {
      orderNumber: 'C9-1029',
      type: 'Jute',
      size: '10w x 14h x 5g',
      updatedDate: '2026-05-25',
      status: 'Complete',
      dueDate: '2026-05-27',
    },
    {
      orderNumber: 'C9-1027',
      type: 'Juco',
      size: '15w x 19h x 7g',
      updatedDate: '2026-05-22',
      status: 'Complete',
      dueDate: '2026-05-24',
    },
  ];

  protected readonly filteredOrders = computed(() => {
    const activeTab = this.activeTab();

    return this.orders
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
      .sort((first, second) => this.toDate(first.dueDate).getTime() - this.toDate(second.dueDate).getTime());
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
    return this.toDate(date).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  protected statusClass(status: OrderStatus): string {
    return status.toLowerCase().replaceAll(' ', '-');
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

  private toDate(date: string): Date {
    return new Date(`${date}T00:00:00`);
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
