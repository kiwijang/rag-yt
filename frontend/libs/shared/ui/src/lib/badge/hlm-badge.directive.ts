import { computed, Directive, input } from '@angular/core';
import { cn } from '../utils/cn';

const variants = {
  default: 'border-transparent bg-indigo-700 text-white dark:bg-indigo-400 dark:text-slate-950',
  secondary: 'border-transparent bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100',
  destructive: 'border-transparent bg-red-700 text-white dark:bg-red-400 dark:text-slate-950',
  outline: 'border-slate-200 text-slate-800 dark:border-slate-800 dark:text-slate-100',
};

export type HlmBadgeVariant = keyof typeof variants;

@Directive({
  selector: '[hlmBadge]',
  standalone: true,
  host: { '[class]': 'classes()' },
})
export class HlmBadgeDirective {
  readonly variant = input<HlmBadgeVariant>('default');
  readonly hlmClass = input('');

  protected readonly classes = computed(() => cn(
    'inline-flex w-fit items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold self-center',
    variants[this.variant()],
    this.hlmClass(),
  ));
}
