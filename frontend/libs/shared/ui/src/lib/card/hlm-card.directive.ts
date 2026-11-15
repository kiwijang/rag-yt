import { Directive } from '@angular/core';

@Directive({
  selector: '[hlmCard]',
  standalone: true,
  host: { class: 'rounded-xl border border-slate-200 bg-white text-slate-950 shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:text-slate-50' },
})
export class HlmCardDirective {}

@Directive({
  selector: '[hlmCardHeader]',
  standalone: true,
  host: { class: 'flex flex-col gap-1.5 p-6' },
})
export class HlmCardHeaderDirective {}

@Directive({
  selector: '[hlmCardTitle]',
  standalone: true,
  host: { class: 'm-0 text-xl font-semibold leading-tight tracking-tight' },
})
export class HlmCardTitleDirective {}

@Directive({
  selector: '[hlmCardDescription]',
  standalone: true,
  host: { class: 'm-0 text-sm text-slate-600 dark:text-slate-400' },
})
export class HlmCardDescriptionDirective {}

@Directive({
  selector: '[hlmCardContent]',
  standalone: true,
  host: { class: 'p-6 pt-0' },
})
export class HlmCardContentDirective {}

@Directive({
  selector: '[hlmCardFooter]',
  standalone: true,
  host: { class: 'flex flex-wrap items-center gap-2 p-6 pt-0' },
})
export class HlmCardFooterDirective {}
