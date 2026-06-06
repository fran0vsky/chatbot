import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
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
  imports: [FormsModule],
  templateUrl: './skill-manager.html',
})
export class SkillManager {
  @Input() skills: DinoSkill[] = [];
  @Input() memories: MemoryItem[] = [];
  @Output() skillDeleted = new EventEmitter<string>();
  @Output() memoryDeleted = new EventEmitter<string>();
  @Output() skillEdited = new EventEmitter<{ id: string; title: string; whenToActivate?: string; instruction: string }>();

  editingId: string | null = null;
  editTitle = '';
  editWhenToActivate = '';
  editInstruction = '';

  startEdit(skill: DinoSkill): void {
    this.editingId = skill.id;
    this.editTitle = skill.title;
    this.editWhenToActivate = skill.whenToActivate ?? '';
    this.editInstruction = skill.instruction;
  }

  cancelEdit(): void {
    this.editingId = null;
  }

  saveEdit(): void {
    const title = this.editTitle.trim();
    const instruction = this.editInstruction.trim();
    if (!title || !instruction || !this.editingId) return;
    const whenToActivate = this.editWhenToActivate.trim() || undefined;
    this.skillEdited.emit({ id: this.editingId, title, whenToActivate, instruction });
    this.cancelEdit();
  }
}
