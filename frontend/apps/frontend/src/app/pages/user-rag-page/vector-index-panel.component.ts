import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RagIndexStatusService } from '../../services/rag-index-status.service';
import { RagService, VectorIndexProgress } from '@ragyt/api-client';
import { HlmButtonDirective } from '@ragyt/ui';

@Component({
  selector: 'app-vector-index-panel',
  standalone: true,
  imports: [HlmButtonDirective],
  template: `<div
    class="grid gap-3 rounded-lg border border-slate-300 p-4 dark:border-slate-700"
  >
    <h3 class="font-semibold">Weaviate 向量索引</h3>
    <p class="text-sm">
      BGE-M3：逐字稿與 PDF 文字 · Jina CLIP v2：PDF
      頁面圖像。支援中文、英文與日文，保留原文。
    </p>
    <p class="text-sm">
      管理切塊儲存時會自動更新該切塊 embedding；此處可補建全部索引。只處理變動資料，中斷後可接續。
    </p>
    <div class="flex flex-wrap gap-2">
      <button
        hlmBtn
        size="sm"
        type="button"
        [disabled]="busy() || status()?.supportsOriginalTextEmbedding !== true"
        (click)="start()"
      >
        建立／更新索引
      </button>
      @if (busy()) {
        <button
          hlmBtn
          size="sm"
          variant="outline"
          type="button"
          (click)="stop()"
        >
          停止索引
        </button>
      }
    </div>
    @if (status(); as p) {
      @if (p.supportsOriginalTextEmbedding !== true) { <p role="status" class="text-sm text-amber-700">目前 API 尚未支援原文索引，請讓正在執行的工作完成後重新啟動 API。</p> }
      <p role="status">
        {{ label(p.state) }} · {{ p.processed }} / {{ p.total }} · 本次更新
        {{ p.updated }}
      </p>
      @if (p.state === 'stopping') {
        <p class="text-sm">等待目前推論批次完成並釋放 GPU…</p>
      }
      @if (p.error) {
        <p role="alert" class="break-words text-red-600">{{ p.error }}</p>
      }
    }
    @if (error()) {
      <p role="alert" class="text-red-600">{{ error() }}</p>
    }
  </div>`,
})
export class VectorIndexPanelComponent {
  private readonly api = inject(RagService);
  private readonly destroy = inject(DestroyRef);
  private readonly indexStatus = inject(RagIndexStatusService);
  readonly status = signal<VectorIndexProgress | null>(null);
  readonly error = signal('');
  busy() {
    return ['queued', 'running', 'stopping'].includes(
      this.status()?.state ?? '',
    );
  }
  constructor() {
    this.indexStatus.state$.pipe(takeUntilDestroyed(this.destroy))
      .subscribe(state => {
        this.status.set(state.progress);
        this.error.set(state.error);
      });
  }
  label(state: string) {
    return (
      (
        {
          idle: '尚未啟動',
          queued: '等待處理',
          running: '建立索引中',
          stopping: '停止中',
          completed: '已完成',
          cancelled: '已停止',
          failed: '失敗',
        } as Record<string, string>
      )[state] ?? state
    );
  }
  start() {
    if(this.status()?.supportsOriginalTextEmbedding!==true)return;
    this.api
      .postApiRagIndex({})
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (p) => this.status.set(p),
        error: () => this.error.set('啟動失敗，請重新確認索引狀態。'),
      });
  }
  stop() {
    this.api
      .postApiRagIndexCancel()
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (p) => this.status.set(p),
        error: () => this.error.set('停止請求失敗。'),
      });
  }
}
