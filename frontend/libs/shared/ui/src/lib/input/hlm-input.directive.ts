import { booleanAttribute, computed, Directive, input } from '@angular/core';
import { cn } from '../utils/cn';

@Directive({
  selector: 'input[hlmInput], textarea[hlmInput], select[hlmInput]',
  standalone: true,
  host: {
    '[class]': 'classes()',
    '[attr.aria-invalid]': 'isInvalid() ? "true" : null',
  },
})
export class HlmInputDirective {
  readonly invalid = input(false, { transform: booleanAttribute });
  readonly error = input(false, { transform: booleanAttribute });
  protected readonly isInvalid = computed(() => this.invalid() || this.error());
  readonly hlmClass = input('');

  protected readonly classes = computed(() => cn(
    'block w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm placeholder:text-slate-500',
    'dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-400',
    'transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
    'disabled:cursor-not-allowed disabled:opacity-50',
    'aria-[invalid=true]:border-red-600 dark:aria-[invalid=true]:border-red-400 aria-[invalid=true]:focus-visible:ring-red-500',
    '[&.ng-invalid.ng-touched]:border-red-600 dark:[&.ng-invalid.ng-touched]:border-red-400',
    'file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-2 file:py-1 file:text-slate-800 dark:file:bg-slate-800 dark:file:text-slate-100',
    this.hlmClass(),
  ));
}
