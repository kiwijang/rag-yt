import { HttpClient } from '@angular/common/http';
import { Component, computed, effect, ElementRef, inject, Injectable, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, defer, Observable, of, shareReplay, switchMap } from 'rxjs';
import { cn } from '../utils/cn';

const iconNames = [
  'search', 'plus', 'x', 'check', 'trash-2', 'pencil', 'download', 'filter',
  'chevron-down', 'chevron-right', 'chevron-left', 'loader-2', 'alert-circle',
  'info', 'settings', 'user',
] as const;

export type IconName = typeof iconNames[number];

const svgNamespace = 'http://www.w3.org/2000/svg';
const geometry = new Set(['circle', 'ellipse', 'line', 'path', 'polygon', 'polyline', 'rect']);
const geometryAttributes = new Set([
  'cx', 'cy', 'd', 'height', 'points', 'r', 'rx', 'ry', 'width', 'x', 'x1', 'x2', 'y', 'y1', 'y2',
]);

@Injectable({ providedIn: 'root' })
class IconAssets {
  private readonly http = inject(HttpClient);
  private readonly cache = new Map<IconName, Observable<string>>();

  get(name: IconName): Observable<string> {
    const cached = this.cache.get(name);
    if (cached) return cached;

    const request = defer(() => this.http.get(`assets/icons/${name}.svg`, { responseType: 'text' }))
      .pipe(shareReplay({ bufferSize: 1, refCount: false }));
    this.cache.set(name, request);
    return request;
  }
}

function createSvg(document: Document, source: string, strokeWidth: number): SVGSVGElement | null {
  const root = new DOMParser().parseFromString(source, 'image/svg+xml').documentElement;
  if (root.localName !== 'svg' || root.namespaceURI !== svgNamespace) return null;

  // Rebuild Lucide geometry without importing executable markup or external references.
  const svg = document.createElementNS(svgNamespace, 'svg');
  svg.setAttribute('viewBox', root.getAttribute('viewBox') ?? '0 0 24 24');
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '100%');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', String(strokeWidth));
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');

  for (const child of Array.from(root.children)) {
    if (child.namespaceURI !== svgNamespace || !geometry.has(child.localName)) continue;
    const shape = document.createElementNS(svgNamespace, child.localName);
    for (const attribute of Array.from(child.attributes)) {
      if (attribute.namespaceURI === null && geometryAttributes.has(attribute.name)) {
        shape.setAttribute(attribute.name, attribute.value);
      }
    }
    svg.append(shape);
  }
  return svg.childElementCount ? svg : null;
}

@Component({
  selector: 'ui-icon',
  standalone: true,
  template: '',
  host: {
    '[class]': 'classes()',
    '[attr.aria-hidden]': '"true"',
  },
})
export class UiIconComponent {
  readonly name = input.required<IconName>();
  readonly strokeWidth = input(2);
  readonly class = input('');

  protected readonly classes = computed(() => cn('size-4 shrink-0 inline-block', this.class()));
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly assets = inject(IconAssets);
  private readonly source = toSignal(toObservable(this.name).pipe(
    switchMap(name => iconNames.includes(name)
      ? this.assets.get(name).pipe(catchError(() => of(null)))
      : of(null)),
  ), { initialValue: null });

  constructor() {
    effect(() => {
      const source = this.source();
      const width = this.strokeWidth();
      const svg = source ? createSvg(this.host.ownerDocument, source, width) : null;
      this.host.replaceChildren(...(svg ? [svg] : []));
    });
  }
}
