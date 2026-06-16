import { Component } from '@angular/core';

@Component({
  selector: 'app-reports',
  templateUrl: './reports.html',
  styleUrl: './reports.scss',
})
export class Reports {
  protected readonly categories = [
    { name: 'Brand design', value: '$7,420', percentage: 40, color: 'purple' },
    { name: 'Event stationery', value: '$5,180', percentage: 28, color: 'pink' },
    { name: 'Social campaigns', value: '$3,650', percentage: 20, color: 'cyan' },
    { name: 'Other creative', value: '$2,350', percentage: 12, color: 'gold' },
  ];
}
