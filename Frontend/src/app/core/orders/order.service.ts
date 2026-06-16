import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

const API_BASE_URL = 'http://localhost:3000/api';

interface CreateOrderPayload {
  bag: {
    fabric: string | null;
    quantity: number | null;
    dueDate: string | null;
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
}
