import { Component, ViewChild, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { NavigationCancel, NavigationEnd, NavigationError, NavigationStart, Router, RouterLink, ActivatedRoute } from '@angular/router';
import { HlmButtonDirective, HlmCardDirective, HlmInputDirective } from '@ragyt/ui';
import { WorkspaceNavComponent } from '../../components/workspace-nav.component';
import { MuscleViewerComponent } from './muscle-viewer.component';
import { ANATOMY_COUNTS, ANATOMY_ITEMS, ANATOMY_REGIONS, VisibleType, resolveAnatomyId, isVisibleInSystem } from './muscle-catalog';

@Component({
  selector: 'app-muscles-page', standalone: true,
  imports: [FormsModule, RouterLink, HlmButtonDirective, HlmCardDirective, HlmInputDirective, WorkspaceNavComponent, MuscleViewerComponent],
  template: `
    <div class="rag-page">
      <main class="rag-page-shell">
        <app-workspace-nav />
        <header><p class="text-xs font-semibold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">MUSCLE ATLAS 3D</p><h1 class="mt-1 text-3xl font-semibold">3D 人體肌肉選擇</h1><p class="mt-2 text-sm text-slate-600 dark:text-slate-400">{{ counts.muscles }} 個肌肉、{{ counts.support }} 個筋膜相關結構；{{ counts.bones }} 個骨骼系統結構。旋轉模型、點選部位或以中英文搜尋。</p></header>
        <div class="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section hlmCard class="grid min-w-0 grid-cols-1 content-start gap-4 p-4">
            <div class="rag-search-panel grid min-w-0 grid-cols-1 gap-4">
              <div class="flex flex-wrap gap-2" role="group" aria-label="模型呈現方式">
                <button hlmBtn type="button" size="sm" [variant]="visibleType() === 'all' ? 'default' : 'outline'" [attr.aria-pressed]="visibleType() === 'all'" (click)="setType('all')">全部顯示</button>
                <button hlmBtn type="button" size="sm" [variant]="visibleType() === 'myofascial' ? 'default' : 'outline'" [attr.aria-pressed]="visibleType() === 'myofascial'" (click)="setType('myofascial')">肌筋膜系統</button>
                <button hlmBtn type="button" size="sm" [variant]="visibleType() === 'bone' ? 'default' : 'outline'" [attr.aria-pressed]="visibleType() === 'bone'" (click)="setType('bone')">骨骼系統</button>
                <button hlmBtn type="button" size="sm" variant="ghost" (click)="resetAll()">一鍵復原模型</button>
              </div>
              <div class="grid min-w-0 gap-4 sm:grid-cols-2">
                <label class="grid min-w-0 gap-2 text-sm font-medium">肌肉不透明度：{{ muscleOpacity() }}%<input type="range" min="0" max="100" step="1" aria-label="肌肉不透明度" class="w-full min-w-0 accent-indigo-600" [ngModel]="muscleOpacity()" (ngModelChange)="muscleOpacity.set(+$event)" /></label>
                <label class="grid min-w-0 gap-2 text-sm font-medium">骨骼不透明度：{{ boneOpacity() }}%<input type="range" min="0" max="100" step="1" aria-label="骨骼不透明度" class="w-full min-w-0 accent-indigo-600" [ngModel]="boneOpacity()" (ngModelChange)="boneOpacity.set(+$event)" /></label>
              </div>
              <label class="grid min-w-0 gap-2 text-sm font-medium">筋膜相關結構不透明度：{{ supportOpacity() }}%<input type="range" min="0" max="100" step="1" aria-label="筋膜相關結構不透明度" class="w-full min-w-0 accent-indigo-600" [ngModel]="supportOpacity()" (ngModelChange)="supportOpacity.set(+$event)" /></label>
              <label class="grid min-w-0 gap-2 text-sm font-medium">爆炸圖展開程度：{{ explosion() }}%<input type="range" min="0" max="100" step="1" aria-label="爆炸圖展開程度" [disabled]="!canExplode()" aria-describedby="explosion-hint" class="w-full min-w-0 accent-indigo-600" [ngModel]="explosion()" (ngModelChange)="setExplosion(+$event)" /></label>
              <div class="flex flex-wrap items-center gap-2"><button hlmBtn type="button" size="sm" variant="outline" [disabled]="!canExplode()" (click)="setExplosion(explosion() > 0 ? 0 : 55)">{{ explosion() > 0 ? '收合肌肉' : '展開肌肉爆炸圖' }}</button><label class="flex items-center gap-2 text-sm"><input type="checkbox" [ngModel]="wireframe()" (ngModelChange)="wireframe.set($event)" />線框模式</label></div>
              <p id="explosion-hint" class="text-xs text-slate-500">{{ !region() ? '請先在「篩選部位」選擇分類，才能展開肌肉爆炸圖。' : !canExplode() ? '請切換為「全部顯示」或「肌筋膜系統」以使用爆炸圖。' : '爆炸圖只展開「' + selectedRegionName() + '」分類的肌肉；切換分類會自動收合。' }}</p>
<p class="text-xs leading-5 text-slate-600 dark:text-slate-400">依解剖部位分類，跨部位結構會在相關分類顯示；原分類保留於對照文件。重複的整組肌肉已整併為獨立分部。此模型沒有皮膚層；爆炸圖只移動肌肉。</p>
            </div>
            <div class="flex flex-wrap items-center gap-2" role="group" aria-label="模型視角">
              <button hlmBtn type="button" size="sm" [variant]="view() === 'front' ? 'default' : 'outline'" [attr.aria-pressed]="view() === 'front'" (click)="view.set('front')">正面</button>
              <button hlmBtn type="button" size="sm" [variant]="view() === 'back' ? 'default' : 'outline'" [attr.aria-pressed]="view() === 'back'" (click)="view.set('back')">背面</button>
              <button hlmBtn type="button" size="sm" variant="ghost" (click)="resetView()">重置視角</button>
              <button hlmBtn type="button" size="sm" variant="outline" [disabled]="!selected()" (click)="focusSelected()">聚焦選取</button>
              <span class="ml-auto flex items-center gap-2 text-xs text-slate-500"><span class="h-3 w-3 rounded-full bg-amber-400" aria-hidden="true"></span>已選結構</span>
            </div>
            <label class="flex items-center gap-2 text-sm"><input type="checkbox" [ngModel]="isolated()" (ngModelChange)="isolated.set($event)" [disabled]="!selected()" />只顯示已選結構（查看深層肌肉）</label>
            @if (active()) { <app-muscle-viewer [selected]="selectedId()" [locateTarget]="locateId()" [view]="view()" [isolated]="isolated()" [visibleType]="visibleType()" [regionFilter]="region()" [muscleOpacity]="muscleOpacity()" [boneOpacity]="boneOpacity()" [supportOpacity]="supportOpacity()" [showAggregates]="showAggregates()" [wireframe]="wireframe()" [explosion]="explosion()" (muscleSelected)="select($event)" /> }
            <p class="text-xs leading-5 text-slate-500">肌肉依 Startup.blend 整理並去重，保留既有 FJ／TP 編號對照，新增部件使用 ZA 編號。顏色用於區分結構，不代表激痛點或疼痛分布。</p>
            <p class="text-xs leading-5 text-slate-500"><a class="underline" href="https://github.com/zhangguanghao523/muscle-atlas-3d" target="_blank" rel="noopener noreferrer">muscle-atlas-3d</a> · BodyParts3D © DBCLS · <a class="underline" href="https://creativecommons.org/licenses/by-sa/2.1/jp/" target="_blank" rel="noopener noreferrer">CC BY-SA 2.1 Japan</a> · <a class="underline" href="assets/anatomy/startup-reconciled/ATTRIBUTION.md" target="_blank" rel="noopener noreferrer">Z-Anatomy／來源與修改說明</a></p>
          </section>
          <aside class="grid min-w-0 content-start gap-4">
            <section hlmCard class="grid min-w-0 gap-3 p-4" aria-live="polite">
              <p class="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">目前選擇</p>
              @if (selected(); as item) {
                <h2 class="break-words text-xl font-semibold">{{ item.name }}</h2><p lang="en" class="break-words text-sm text-slate-500">{{ item.english }}</p>
                <dl class="grid grid-cols-[auto_minmax(0,1fr)] gap-2 text-sm"><dt class="text-slate-500">類型</dt><dd>{{ typeLabel(item.type) }}</dd><dt class="text-slate-500">部位</dt><dd>{{ item.region }}</dd><dt class="text-slate-500">側別</dt><dd>{{ item.location }}</dd><dt class="text-slate-500">模型來源</dt><dd>{{ item.source }}</dd><dt class="text-slate-500">來源編號</dt><dd>{{ item.id }}</dd></dl>
                <a hlmBtn size="sm" routerLink="/chat" [queryParams]="{muscle: item.name}">帶入 LLM 對話</a>
                <a hlmBtn variant="outline" size="sm" routerLink="/user-rag" [queryParams]="{q: item.name}">帶入 RAG 檢索</a>
                <button hlmBtn variant="ghost" size="sm" type="button" (click)="clearSelection()">清除選擇</button>
              } @else { <h2 class="font-semibold">尚未選擇結構</h2><p class="text-sm text-slate-500">點選模型或從清單選擇肌筋膜結構與骨骼。</p> }
            </section>
            <section hlmCard class="grid min-w-0 gap-3 p-4">
              <div class="rag-search-panel grid min-w-0 gap-3"><label class="grid gap-1 text-sm font-medium">搜尋肌肉或骨骼<input hlmInput aria-label="搜尋肌肉或骨骼" placeholder="中文、英文、FJ 或 TP 編號" [ngModel]="search()" (ngModelChange)="search.set($event)" /></label>
                <label class="grid gap-1 text-sm font-medium">篩選部位<select hlmInput aria-label="篩選部位" [ngModel]="region()" (ngModelChange)="setRegion($event)"><option value="">全部部位</option>@for (zone of zones; track zone.id) { <option [value]="zone.id">{{ zone.name }}</option> }</select></label>
              </div>
              <p class="text-xs text-slate-500">{{ filtered().length }} / {{ counts.total }} 個模型結構 · 左右側分開顯示</p>
              <div class="grid max-h-80 gap-2 overflow-y-auto" role="group" aria-label="結構清單">
                @for (item of filtered(); track item.id) {
                  <button type="button" class="min-w-0 break-words rounded-lg border px-3 py-2 text-left text-sm transition-colors hover:border-indigo-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500" [class]="selectedId() === item.id ? 'border-indigo-500 bg-indigo-50 text-indigo-900 dark:bg-indigo-950 dark:text-indigo-100' : 'border-slate-200 dark:border-slate-700'" [attr.aria-pressed]="selectedId() === item.id" (click)="select(item.id)"><span class="block font-medium">{{ item.name }}</span><span lang="en" class="block text-xs opacity-70">{{ item.english }}</span><span class="block text-xs opacity-60">{{ item.id }} · {{ typeLabel(item.type) }}</span></button>
                } @empty { <p class="py-5 text-center text-sm text-slate-500">沒有符合的結構。</p> }
              </div>
            </section>
          </aside>
        </div>
      </main>
    </div>
  `,
})
export class MusclesPageComponent {
  private readonly router = inject(Router);
  constructor() {
    inject(ActivatedRoute).queryParamMap.pipe(takeUntilDestroyed()).subscribe(params => {
      const id = params.get('id');
      if (id) {
        this.resetAll(false);
        this.view.set(params.get('view') === 'back' ? 'back' : 'front');
        this.select(id, { focus: true });
      }
    });
    this.router.events.pipe(takeUntilDestroyed()).subscribe(event => {
      if (event instanceof NavigationStart && event.url.split(/[?#]/)[0] !== '/muscles') this.active.set(false);
      else if (event instanceof NavigationEnd || event instanceof NavigationCancel || event instanceof NavigationError)
        this.active.set(this.router.url.split(/[?#]/)[0] === '/muscles');
    });
  }
  @ViewChild(MuscleViewerComponent) private viewer?: MuscleViewerComponent;
  readonly active = signal(true);
  readonly view = signal<'front' | 'back'>('front');
  readonly selectedId = signal<string | null>(null);
  readonly locateId = signal<string | null>(null);
  readonly visibleType = signal<VisibleType>('all');
  readonly region = signal('');
  readonly search = signal('');
  readonly isolated = signal(false);
  readonly muscleOpacity = signal(100);
  readonly boneOpacity = signal(100);
  readonly supportOpacity = signal(40);
  readonly showAggregates = signal(false);
  readonly wireframe = signal(false);
  readonly explosion = signal(0);
  readonly counts = ANATOMY_COUNTS;
  readonly zones = Object.entries(ANATOMY_REGIONS).map(([id,name]) => ({id,name}));
  readonly selectedRegionName = computed(() => ANATOMY_REGIONS[this.region()] ?? '');
  readonly canExplode = computed(() => !!this.region() &&
    (this.visibleType() === 'all' || this.visibleType() === 'myofascial') &&
    ANATOMY_ITEMS.some(item => item.type === 'muscle' && item.zones.includes(this.region())));
  readonly selected = computed(() => ANATOMY_ITEMS.find(item => item.id === this.selectedId()));
  readonly filtered = computed(() => ANATOMY_ITEMS.filter(item =>
    isVisibleInSystem(item.type, this.visibleType()) && (!this.region() || item.zones.includes(this.region())) &&
    `${item.name} ${item.english} ${item.id}`.toLowerCase().includes(this.search().trim().toLowerCase())));
  typeLabel(type: string): string { return type === 'muscle' ? '肌肉' : type === 'bone' ? '骨骼系統' : '筋膜相關結構'; }
  resetView(): void { this.viewer?.reset(); }
  focusSelected(): void { this.viewer?.focusSelected(); }
  clearSelection(): void {
    this.selectedId.set(null); this.locateId.set(null); this.isolated.set(false); this.muscleOpacity.set(100);
  }
  select(id: string, options: { focus?: boolean } = {}): void {
    const resolved = resolveAnatomyId(id);
    if (!resolved) return;
    this.selectedId.set(resolved);
    this.locateId.set(options.focus ? resolved : null);
    this.muscleOpacity.set(20);
  }
  setType(type: VisibleType): void {
    this.visibleType.set(type); this.clearSelection();
    if (type === 'bone') this.explosion.set(0);
  }
  setRegion(region: string): void { this.explosion.set(0); this.region.set(region); this.clearSelection(); }
  setExplosion(value: number): void {
    if (value > 0 && !this.canExplode()) return;
    this.explosion.set(Math.max(0,Math.min(100,Math.round(value))));
    if (value > 0) this.isolated.set(false);
  }
  resetAll(resetCamera = true): void {
    this.clearSelection(); this.visibleType.set('all'); this.region.set(''); this.search.set('');
    this.boneOpacity.set(100); this.supportOpacity.set(40); this.showAggregates.set(false); this.wireframe.set(false); this.explosion.set(0); this.view.set('front');
    if (resetCamera) setTimeout(() => this.viewer?.reset());
  }
}







