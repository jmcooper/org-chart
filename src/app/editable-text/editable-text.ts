import {
  Component,
  ElementRef,
  afterNextRender,
  inject,
  Injector,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';

/**
 * Text that turns into an input when tapped. Enter or leaving the field commits,
 * Escape cancels. Emits the trimmed new value; an empty string means "remove".
 */
@Component({
  selector: 'app-editable-text',
  templateUrl: './editable-text.html',
  styleUrl: './editable-text.scss',
})
export class EditableText {
  readonly value = input.required<string>();
  readonly placeholder = input('');
  readonly label = input('');
  /** When empty, show only a faint "+" and reveal the placeholder on hover or focus. */
  readonly quiet = input(false);
  readonly commit = output<string>();

  protected readonly editing = signal(false);
  private readonly box = viewChild<ElementRef<HTMLInputElement>>('box');
  private readonly injector = inject(Injector);
  private cancelled = false;

  protected start(): void {
    this.cancelled = false;
    this.editing.set(true);
    afterNextRender(() => this.box()?.nativeElement.select(), { injector: this.injector });
  }

  protected finish(input: HTMLInputElement): void {
    if (!this.editing()) return;
    this.editing.set(false);
    if (this.cancelled) return;
    const next = input.value.trim();
    if (next !== this.value()) this.commit.emit(next);
  }

  protected cancel(input: HTMLInputElement): void {
    this.cancelled = true;
    input.blur();
    this.editing.set(false);
  }
}
