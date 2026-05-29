import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { DinoSkill } from '@org/shared-types';

interface MemoryItem {
  id: string;
  content: string;
}

/**
 * Presentational "what this dino knows" surface: lists user-taught skills and
 * auto-extracted memories, each with a delete action (MEM-06). Pure inputs +
 * outputs — the smart SkillService owns the HTTP.
 */
@Component({
  standalone: true,
  selector: 'app-skill-manager',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './skill-manager.html',
})
export class SkillManager {
  @Input() skills: DinoSkill[] = [];
  @Input() memories: MemoryItem[] = [];
  @Output() skillDeleted = new EventEmitter<string>();
  @Output() memoryDeleted = new EventEmitter<string>();
}
