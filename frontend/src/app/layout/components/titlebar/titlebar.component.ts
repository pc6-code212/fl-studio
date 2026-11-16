import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-titlebar',
  standalone: true,
  templateUrl: './titlebar.component.html',
  styleUrl: './titlebar.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TitlebarComponent {}
