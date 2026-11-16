import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-status-bar',
  standalone: true,
  templateUrl: './status-bar.component.html',
  styleUrl: './status-bar.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StatusBarComponent {
  readonly patternNumber = input.required<number>();
  readonly patternName = input.required<string>();
  readonly selectedName = input.required<string>();
  readonly bpm = input.required<number>();
  readonly swing = input.required<number>();
}
