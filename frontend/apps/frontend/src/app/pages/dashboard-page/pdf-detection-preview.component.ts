import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HlmButtonDirective } from '@ragyt/ui';
import { PdfPageOverlay, YoutubeTranscriptService } from '@ragyt/api-client/youtube-transcript';

type Chunk = { id: number; content: string; metadataJson: string | null; pdfPageId: number | null };
type Page = { id: number; pageNumber: number; text: string };

@Component({
  selector: 'app-pdf-detection-preview', standalone: true,
  imports: [CommonModule, FormsModule, HlmButtonDirective],
  template: `
    <section class="my-4 grid gap-3" aria-label="PDF 文字偵測預覽">
      <h3 class="font-semibold">PDF 頁面與文字偵測框</h3>
      <div class="flex flex-wrap items-center gap-3 text-sm">
        <button hlmBtn type="button" size="sm" variant="outline" [disabled]="pageIndex() <= 0" (click)="step(-1)">上一頁</button>
        <label>頁碼
          <select class="ml-2 rounded border bg-transparent p-1" aria-label="預覽頁碼"
            [ngModel]="activePage()?.id" (ngModelChange)="pageId.set(+$event)">
            @for (page of pages(); track page.id) { <option [ngValue]="page.id">{{ page.pageNumber }}</option> }
          </select>
        </label>
        <button hlmBtn type="button" size="sm" variant="outline" [disabled]="pageIndex() >= pages().length - 1" (click)="step(1)">下一頁</button>
        <label><input type="checkbox" [ngModel]="showText()" (ngModelChange)="showText.set($event)" /> 文字偵測框（藍）</label>
        <label><input type="checkbox" [ngModel]="showLayout()" (ngModelChange)="showLayout.set($event)" /> 版面區塊（綠）</label>
        <label>縮放
          <select class="ml-2 rounded border bg-transparent p-1" aria-label="預覽縮放" [ngModel]="zoom()" (ngModelChange)="zoom.set(+$event)">
            <option [ngValue]="100">符合寬度</option><option [ngValue]="150">150%</option><option [ngValue]="200">200%</option>
          </select>
        </label>
      </div>
      @if (status() === 'loading') { <p role="status">正在讀取頁面與文字框…</p> }
      @if (error()) { <p role="status" class="text-sm text-amber-700 dark:text-amber-300">{{ error() }}</p> }
      @if (overlay(); as preview) {
        <p class="text-xs text-slate-600 dark:text-slate-400">{{ preview.detections.length }} 個文字框 · {{ preview.device }} · 橘色為目前選取。底圖為 MinerU 解析的對應 PDF 頁面。</p>
        <div class="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(14rem,1fr)]">
          <div class="max-h-[65vh] min-w-0 overflow-auto rounded border border-slate-300 bg-slate-100 dark:border-slate-700">
            <div class="relative" [style.width.%]="zoom()">
              <img class="block h-auto w-full" [src]="'data:image/png;base64,' + preview.imageBase64" [alt]="'PDF 第 ' + preview.pageNumber + ' 頁'" />
              <svg class="absolute inset-0 h-full w-full" [attr.viewBox]="'0 0 ' + preview.width + ' ' + preview.height"
                preserveAspectRatio="none" aria-label="文字與版面框">
                @if (showLayout()) {
                  @for (block of preview.layoutBlocks; track $index) {
                    <rect [attr.x]="block.bbox[0]" [attr.y]="block.bbox[1]" [attr.width]="block.bbox[2] - block.bbox[0]" [attr.height]="block.bbox[3] - block.bbox[1]"
                      fill="none" stroke="#16a34a" stroke-width="1.5" stroke-dasharray="5 3" vector-effect="non-scaling-stroke" pointer-events="none"><title>{{ block.type }}</title></rect>
                  }
                }
                @if (selectedChunkBox(); as box) {
                  <rect [attr.x]="box[0]" [attr.y]="box[1]" [attr.width]="box[2] - box[0]" [attr.height]="box[3] - box[1]"
                    fill="none" stroke="#f97316" stroke-width="3" vector-effect="non-scaling-stroke" pointer-events="none" />
                }
                @if (showText()) {
                  @for (detection of preview.detections; track detection.id) {
                    <polygon [attr.points]="points(detection.polygon)" [attr.fill]="selectedDetection() === detection.id ? '#f97316' : '#2563eb'" fill-opacity="0.10"
                      [attr.stroke]="selectedDetection() === detection.id ? '#f97316' : '#2563eb'" stroke-width="1.5" vector-effect="non-scaling-stroke"
                      role="button" tabindex="0" [attr.aria-label]="'文字框 ' + detection.id + '：' + (detection.text || '尚未辨識文字')"
                      [attr.aria-pressed]="selectedDetection() === detection.id" class="cursor-pointer focus:outline focus:outline-2 focus:outline-orange-500"
                      (click)="selectedDetection.set(detection.id)" (keydown.enter)="selectedDetection.set(detection.id)" (keydown.space)="$event.preventDefault(); selectedDetection.set(detection.id)">
                      <title>#{{ detection.id }} {{ detection.text }}</title>
                    </polygon>
                  }
                }
              </svg>
            </div>
          </div>
          <aside class="grid min-w-0 content-start gap-3 text-sm">
            @if (activeDetection(); as detection) {
              <div class="rounded border border-orange-300 p-3">
                <p class="font-medium">選取文字框 #{{ detection.id }}</p>
                <p class="my-2 whitespace-pre-wrap break-words">{{ detection.text || '偵測到文字區域，但沒有辨識文字。' }}</p>
                @if (detection.confidence != null) { <p>辨識信心：{{ detection.confidence | percent:'1.0-1' }}</p> }
                <p class="mt-2 font-medium">對應 RAG 切塊</p>
                @for (chunk of relatedChunks(); track chunk.id) {
                  <button hlmBtn type="button" variant="outline" size="sm" class="mt-1 mr-1" (click)="chunkSelected.emit(chunk.id)">Chunk #{{ chunk.id }}</button>
                } @empty { <p>沒有對應切塊。</p> }
              </div>
            } @else { <p>點選頁面上的藍框或下方文字，查看辨識結果。</p> }
            <ol class="grid max-h-[45vh] gap-1 overflow-auto" aria-label="偵測文字列表">
              @for (detection of preview.detections; track detection.id) {
                <li><button type="button" class="w-full rounded border p-2 text-left break-words hover:bg-blue-50 dark:hover:bg-slate-800"
                  [class.border-orange-500]="selectedDetection() === detection.id" [attr.aria-pressed]="selectedDetection() === detection.id"
                  (click)="selectedDetection.set(detection.id)">#{{ detection.id }} {{ detection.text || '未辨識文字' }}</button></li>
              }
            </ol>
          </aside>
        </div>
      }
    </section>
  `,
})
export class PdfDetectionPreviewComponent {
  private readonly service = inject(YoutubeTranscriptService);
  readonly sourceId = input<number | null>(null);
  readonly pages = input<Page[]>([]);
  readonly chunks = input<Chunk[]>([]);
  readonly selectedChunkId = input<number | null>(null);
  readonly chunkSelected = output<number>();
  readonly pageId = signal<number | null>(null);
  readonly zoom = signal(100);
  readonly showText = signal(true);
  readonly showLayout = signal(false);
  readonly overlay = signal<PdfPageOverlay | null>(null);
  readonly status = signal<'loading' | 'ready' | 'error'>('ready');
  readonly error = signal('');
  readonly selectedDetection = signal<number | null>(null);
  readonly activePage = computed<Page | undefined>(() => this.pages().find(page => page.id === this.pageId()) ?? this.pages()[0]);
  readonly pageIndex = computed(() => this.pages().findIndex(page => page.id === this.activePage()?.id));
  readonly activeDetection = computed(() => this.overlay()?.detections.find(item => item.id === this.selectedDetection()));
  readonly selectedChunkBox = computed(() => {
    const chunk = this.chunks().find(item => item.id === this.selectedChunkId() && item.pdfPageId === this.activePage()?.id);
    return this.box(chunk);
  });
  readonly relatedChunks = computed(() => {
    const detection = this.activeDetection();
    if (!detection?.polygon.length) return [];
    const x = detection.polygon.reduce((sum, point) => sum + point[0], 0) / detection.polygon.length;
    const y = detection.polygon.reduce((sum, point) => sum + point[1], 0) / detection.polygon.length;
    return this.chunks().filter(chunk => {
      const box = this.box(chunk);
      return chunk.pdfPageId === this.activePage()?.id && box && x >= box[0] && x <= box[2] && y >= box[1] && y <= box[3];
    });
  });
  constructor() {
    effect(() => {
      const chunkId = this.selectedChunkId();
      const chunk = this.chunks().find(item => item.id === chunkId);
      if (chunk?.pdfPageId != null) this.pageId.set(chunk.pdfPageId);
    }, { allowSignalWrites: true });
    effect(onCleanup => {
      const source = this.sourceId(), page = this.activePage();
      this.overlay.set(null); this.error.set(''); this.selectedDetection.set(null);
      if (source == null || !page) { this.status.set('ready'); return; }
      this.status.set('loading');
      const request = this.service.pdfPageOverlay(source, page.pageNumber).subscribe({
        next: preview => { this.overlay.set(preview); this.status.set('ready'); },
        error: (error: { body?: { message?: string } }) => {
          this.error.set(error.body?.message ?? '無法讀取文字框預覽。請確認 API 已更新；舊 OCR 結果需重新建立切塊。');
          this.status.set('error');
        },
      });
      onCleanup(() => request.unsubscribe());
    }, { allowSignalWrites: true });
  }
  step(direction: number): void {
    const page = this.pages()[this.pageIndex() + direction];
    if (page) this.pageId.set(page.id);
  }
  points(polygon: number[][]): string { return polygon.map(point => point.join(',')).join(' '); }
  private box(chunk?: Chunk): number[] | null {
    try {
      const box = JSON.parse(chunk?.metadataJson ?? '{}').bbox;
      return Array.isArray(box) && box.length === 4 && box.every(Number.isFinite) ? box : null;
    } catch { return null; }
  }
}
