import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { OrderService } from '../../core/orders/order.service';

type CapacityState = 'available' | 'partial' | 'full' | 'over';

interface CapacityBooking {
  orderId?: string;
  orderNumber: string;
  customer: string;
  fabric: string;
  quantity: number;
  date: string;
}

interface CalendarDay {
  date: Date;
  key: string;
  isCurrentMonth: boolean;
  used: number;
  remaining: number;
  overCapacity: number;
  meterPercent: number;
  state: CapacityState;
}

const DAILY_JUTE_CAPACITY = 160;

@Component({
  selector: 'app-scheduler',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './scheduler.html',
  styleUrl: './scheduler.scss',
})
export class Scheduler implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly orderService = inject(OrderService);

  protected readonly dailyCapacity = DAILY_JUTE_CAPACITY;
  protected readonly canEditOrders = this.authService.canAccessSales;
  protected readonly monthCursor = signal(new Date());
  protected readonly selectedDate = signal(this.toDateKey(new Date()));
  private readonly bookings = signal<CapacityBooking[]>([]);

  protected readonly monthLabel = computed(() =>
    this.monthCursor().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
  );

  protected readonly calendarDays = computed(() => this.createCalendarDays(this.monthCursor()));

  protected readonly selectedDay = computed(() =>
    this.calendarDays().find((day) => day.key === this.selectedDate()) ?? null,
  );

  protected readonly selectedBookings = computed(() =>
    this.bookings().filter((booking) => booking.date === this.selectedDate()),
  );

  ngOnInit(): void {
    this.loadCapacity();
  }

  protected previousMonth(): void {
    const current = this.monthCursor();
    this.monthCursor.set(new Date(current.getFullYear(), current.getMonth() - 1, 1));
    this.loadCapacity();
  }

  protected nextMonth(): void {
    const current = this.monthCursor();
    this.monthCursor.set(new Date(current.getFullYear(), current.getMonth() + 1, 1));
    this.loadCapacity();
  }

  protected selectDay(day: CalendarDay): void {
    this.selectedDate.set(day.key);
  }

  protected openOrder(booking: CapacityBooking): void {
    if (!this.canEditOrders || !booking.orderId) {
      return;
    }

    void this.router.navigate(['/sales'], { queryParams: { orderId: booking.orderId } });
  }

  protected formatDate(date: Date): string {
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  private createCalendarDays(month: Date): CalendarDay[] {
    const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
    const gridStart = new Date(month.getFullYear(), month.getMonth(), 1 - firstDay.getDay());

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + index);
      const key = this.toDateKey(date);
      const used = this.bookings()
        .filter((booking) => booking.date === key)
        .reduce((total, booking) => total + booking.quantity, 0);
      const remaining = Math.max(DAILY_JUTE_CAPACITY - used, 0);
      const overCapacity = Math.max(used - DAILY_JUTE_CAPACITY, 0);

      return {
        date,
        key,
        used,
        remaining,
        overCapacity,
        meterPercent: Math.min((used / DAILY_JUTE_CAPACITY) * 100, 100),
        isCurrentMonth: date.getMonth() === month.getMonth(),
        state: overCapacity > 0 ? 'over' : used === 0 ? 'available' : remaining === 0 ? 'full' : 'partial',
      };
    });
  }

  private toDateKey(date: Date): string {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
  }

  private loadCapacity(): void {
    const month = this.monthCursor();
    const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
    const firstVisibleDay = new Date(month.getFullYear(), month.getMonth(), 1 - firstDay.getDay());
    const lastVisibleDay = new Date(firstVisibleDay.getFullYear(), firstVisibleDay.getMonth(), firstVisibleDay.getDate() + 41);

    this.orderService.getCapacitySchedule(this.toDateKey(firstVisibleDay), this.toDateKey(lastVisibleDay)).subscribe({
      next: (schedule) => {
        this.bookings.set(
          schedule.reservations.map((reservation) => ({
            orderId: reservation.order.id,
            orderNumber: reservation.order.orderNumber,
            customer: reservation.order.customer,
            fabric: reservation.order.fabric,
            quantity: reservation.quantity,
            date: reservation.date,
          })),
        );
      },
      error: () => this.bookings.set([]),
    });
  }
}
