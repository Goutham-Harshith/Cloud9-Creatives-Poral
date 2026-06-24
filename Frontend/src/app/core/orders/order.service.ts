import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

const API_BASE_URL = environment.apiBaseUrl;

interface CreateOrderPayload {
  bag: {
    fabric: string | null;
    quantity: number | null;
    dueDate: string | null;
    productionStartDate: string | null;
    width: number | null;
    height: number | null;
    gusset: number | null;
    zip: string | null;
    color: string | null;
    handle: string | null;
    print: string | null;
    notes: string | null;
  };
  designs: Array<{
    fileName: string | null;
    notes: string | null;
    file: File | null;
    previewUrl?: string | null;
    uploadedFile?: UploadedOrderFile | null;
  }>;
  customer: {
    name: string | null;
    phone: string | null;
    alternatePhone: string | null;
    address: string | null;
    courierType: string | null;
    courierNotes: string | null;
  };
}

export interface CreatedOrder {
  id: string;
  orderNumber?: string;
  status: string;
  createdAt: string;
}

export interface DashboardOrder {
  id: string;
  orderNumber: string;
  type: string;
  quantity: number | null;
  size: string;
  updatedDate: string;
  status: 'Ready to pick' | 'In progress' | 'Complete';
  dueDate: string;
}

export interface UploadedOrderFile {
  originalName: string;
  storedName: string;
  mimeType: string;
  size: number;
  path: string;
  url: string;
}

export interface OrderDetails {
  id: string;
  orderNumber: string;
  status: DashboardOrder['status'];
  updatedDate: string;
  bag: CreateOrderPayload['bag'];
  customer: CreateOrderPayload['customer'];
  designs: Array<{
    fileName: string | null;
    notes: string | null;
    uploadedFile: UploadedOrderFile | null;
  }>;
}

export interface UpdatedOrderStatus {
  id: string;
  orderNumber: string;
  status: DashboardOrder['status'];
}

export interface CapacityReservation {
  id: string;
  date: string;
  quantity: number;
  order: {
    id: string;
    orderNumber: string;
    customer: string;
    fabric: string;
  };
}

export interface CapacitySchedule {
  dailyCapacity: number;
  reservations: CapacityReservation[];
}

export interface DeletedOrder {
  id: string;
  orderNumber: string;
  deleted: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class OrderService {
  constructor(private readonly http: HttpClient) {}

  getUploadedFileUrl(uploadedFile: UploadedOrderFile | null): string | null {
    return uploadedFile?.url ? this.resolveUploadedFileUrl(uploadedFile.url) : null;
  }

  createOrder(order: CreateOrderPayload): Observable<CreatedOrder> {
    const formData = new FormData();
    const orderPayload = {
      ...order,
      designs: order.designs.map(({ file: _file, previewUrl: _previewUrl, ...design }) => design),
    };

    formData.append('order', JSON.stringify(orderPayload));

    order.designs.forEach((design, index) => {
      if (design.file) {
        formData.append(`designFile_${index}`, design.file, design.file.name);
      }
    });

    return this.http.post<CreatedOrder>(`${API_BASE_URL}/orders`, formData);
  }

  getOrders(): Observable<DashboardOrder[]> {
    return this.http.get<DashboardOrder[]>(`${API_BASE_URL}/orders`);
  }

  getOrder(orderId: string): Observable<OrderDetails> {
    return this.http.get<OrderDetails>(`${API_BASE_URL}/orders/${orderId}`);
  }

  getCapacitySchedule(from: string, to: string): Observable<CapacitySchedule> {
    return this.http.get<CapacitySchedule>(`${API_BASE_URL}/orders/capacity`, {
      params: { from, to },
    });
  }

  updateOrder(orderId: string, order: CreateOrderPayload): Observable<CreatedOrder> {
    const formData = new FormData();
    const orderPayload = {
      ...order,
      designs: order.designs.map(({ file: _file, previewUrl: _previewUrl, ...design }) => design),
    };

    formData.append('order', JSON.stringify(orderPayload));

    order.designs.forEach((design, index) => {
      if (design.file) {
        formData.append(`designFile_${index}`, design.file, design.file.name);
      }
    });

    return this.http.put<CreatedOrder>(`${API_BASE_URL}/orders/${orderId}`, formData);
  }

  updateOrderStatus(
    orderId: string,
    status: DashboardOrder['status'],
  ): Observable<UpdatedOrderStatus> {
    return this.http.patch<UpdatedOrderStatus>(`${API_BASE_URL}/orders/${orderId}/status`, {
      status,
    });
  }

  deleteOrder(orderId: string): Observable<DeletedOrder> {
    return this.http.delete<DeletedOrder>(`${API_BASE_URL}/orders/${orderId}`);
  }

  private resolveUploadedFileUrl(url: string): string {
    if (url.startsWith('blob:') || url.startsWith('data:')) {
      return url;
    }

    try {
      const parsedUrl = new URL(url);

      if (environment.production && this.isLocalhostUrl(parsedUrl)) {
        return this.resolveUploadedFilePath(`${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`);
      }

      return parsedUrl.href;
    } catch {
      return this.resolveUploadedFilePath(url);
    }
  }

  private resolveUploadedFilePath(path: string): string {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;

    if (/^https?:\/\//i.test(API_BASE_URL)) {
      const apiUrl = new URL(API_BASE_URL);
      return `${apiUrl.origin}${normalizedPath}`;
    }

    return normalizedPath;
  }

  private isLocalhostUrl(url: URL): boolean {
    return ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
  }
}
