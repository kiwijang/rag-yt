import { computed, Directive, input } from '@angular/core';
import { cn } from '../utils/cn';

const variants = {
  default: 'bg-indigo-700 text-white hover:bg-indigo-800 dark:bg-indigo-500 dark:text-slate-950 dark:hover:bg-indigo-400',
  destructive: 'bg-red-700 text-white hover:bg-red-800 dark:bg-red-500 dark:text-slate-950 dark:hover:bg-red-400',
  outline: 'border border-slate-200 bg-white text-slate-900 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-800',
  secondary: 'bg-slate-100 text-slate-900 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700',
  ghost: 'text-slate-900 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800',
  link: 'text-indigo-700 underline-offset-4 hover:underline dark:text-indigo-300',
};

const sizes = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-11 px-6 text-base',
  icon: 'size-10 p-0',
};

export type HlmButtonVariant = keyof typeof variants;
export type HlmButtonSize = keyof typeof sizes;

@Directive({
  selector: 'button[hlmBtn], a[hlmBtn]',
  standalone: true,
  host: { '[class]': 'classes()' },
})
export class HlmButtonDirective {
  readonly variant = input<HlmButtonVariant>('default');
  readonly size = input<HlmButtonSize>('md');
  readonly hlmClass = input('');

  protected readonly classes = computed(() => cn(
    'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium',
    'transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950',
    'disabled:cursor-not-allowed disabled:opacity-50',
    variants[this.variant()],
    sizes[this.size()],
    this.hlmClass(),
  ));
}
