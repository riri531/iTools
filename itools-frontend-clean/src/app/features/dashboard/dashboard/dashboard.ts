import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss'
})
export class DashboardComponent {
  // Cette page utilise maintenant des graphiques HTML/CSS.
  // Pas besoin de ng2-charts, Chart.js, baseChart, data, options ou type.
}