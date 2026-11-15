import { Directive } from '@angular/core';
import { BrnTooltipTriggerDirective, provideBrnTooltipDefaultOptions } from '@spartan-ng/brain/tooltip';

/** Angular 18 Helm adapter backed by Spartan Brain's tooltip and CDK overlay. */
@Directive({
  selector: '[hlmTooltip]',
  standalone: true,
  exportAs: 'hlmTooltip',
  providers: [provideBrnTooltipDefaultOptions({
    position: 'above',
    showDelay: 300,
    hideDelay: 100,
    tooltipContentClasses: 'z-50 max-w-xs rounded-md bg-slate-950 px-3 py-2 text-xs leading-relaxed text-white shadow-md dark:bg-slate-100 dark:text-slate-950',
  })],
  hostDirectives: [{
    directive: BrnTooltipTriggerDirective,
    inputs: ['brnTooltipTrigger: hlmTooltip', 'aria-describedby', 'position', 'showDelay', 'hideDelay', 'brnTooltipDisabled: tooltipDisabled'],
  }],
})
export class HlmTooltipDirective {}

export const HlmTooltipImports = [HlmTooltipDirective] as const;
