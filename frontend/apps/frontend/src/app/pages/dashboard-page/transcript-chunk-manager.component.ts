import { CommonModule } from '@angular/common';
import { Component, DestroyRef, ElementRef, ViewChild, inject, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { finalize, take } from 'rxjs';
import { ApiError, TranscriptChunksService } from '@ragyt/api-client';
import { AuthSessionService } from '../../services/auth-session.service';
import { RagIndexStatusService } from '../../services/rag-index-status.service';
import { SourceEmbeddingButtonComponent } from './source-embedding-button.component';
import { EditableTranscriptChunk, TranscriptChunkView, TranscriptDeletionPreview } from '@ragyt/api-client/youtube-transcript';
import { HlmButtonDirective, HlmInputDirective } from '@ragyt/ui';

@Component({
  selector: 'app-transcript-chunk-manager',
  standalone: true,
  imports: [CommonModule, FormsModule, HlmButtonDirective, HlmInputDirective, SourceEmbeddingButtonComponent],
  template: `
    <dialog #manager aria-labelledby="chunk-manager-title" (close)="onClosed()" (cancel)="guardClose($event)"
      class="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-5xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-0 text-slate-900 shadow-xl backdrop:bg-black/50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
      <header class="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-950">
        <div>
          <h2 id="chunk-manager-title" class="text-lg font-semibold">管理 RAG 切塊 · 逐字稿版本 #{{ transcriptId() ?? '—' }}</h2>
          <p class="text-sm text-slate-500">YouTube 來源 #{{ sourceId() }}</p>
        </div>
        <button hlmBtn variant="outline" size="sm" type="button" [disabled]="isMutating()" (click)="close()">關閉</button>
      </header>
      <div class="grid gap-4 p-4 sm:p-6">
        <form aria-label="逐字稿版本查詢" class="rag-search-panel flex flex-wrap items-end gap-3" (ngSubmit)="load()">
          <label class="grid gap-1 text-sm" for="chunk-transcript-id">YoutubeTranscripts.Id（逐字稿版本 ID）
            <input hlmInput id="chunk-transcript-id" name="transcriptId" type="number" min="1" step="1" required autofocus
              [disabled]="busy() !== null" [ngModel]="transcriptId()" (ngModelChange)="changeId($event)" />
          </label>
          <button hlmBtn type="submit" size="sm" [disabled]="busy() !== null || !transcriptId()">載入切塊</button>
        </form>
        <p class="text-sm text-slate-600 dark:text-slate-400">儲存會由後端一併更新切塊與 BGE-M3 embedding；向量準備失敗不修改切塊，不改原始逐字稿。重新建立搜尋片段會覆蓋手動修改。</p>
        <p class="text-sm text-slate-600 dark:text-slate-400">Embedding 使用原文。下方編輯的是原文切塊；舊切塊的譯文或手動修改不會因建立索引而被改寫，仍可展開對照。</p>
        @if (!combinedSaveReady()) { <p role="status" class="text-sm text-amber-700">正在確認後端支援。若尚未更新 API，請讓目前工作完成後重新啟動，再使用儲存與 embedding 功能。</p> }
        @if (error()) { <p role="alert" class="text-sm text-red-700 dark:text-red-300">{{ error() }}</p> }
        @if (message()) { <p role="status" class="text-sm text-indigo-700 dark:text-indigo-300">{{ message() }}</p> }
        @if (busy() === 'loading') { <p role="status">正在載入切塊…</p> }
        @if (view(); as version) {
          <div class="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-900">
            <div>
              <p class="font-medium">Version #{{ version.transcriptId }} · {{ version.videoId }} · {{ version.language }}</p>
              <p>{{ version.createdAt | date:'yyyy/MM/dd HH:mm:ss' }} · {{ version.segmentCount }} 個原始片段 · {{ version.chunks.length }} 個 RAG 切塊</p>
              <app-source-embedding-button [sourceType]="1" [sourceId]="sourceId()" [transcriptId]="version.transcriptId" [disabled]="busy() !== null || version.isBatchActive || !version.isLatest" />
            </div>
            <button hlmBtn variant="destructive" type="button" size="sm" [disabled]="busy() !== null || version.isBatchActive" (click)="previewDeletion()">刪除此版本及相關資料</button>
          </div>
          @if (!version.isLatest) { <p class="text-sm text-amber-700 dark:text-amber-300">這是歷史版本；目前的預設搜尋使用同影片最新版本。</p> }
          @if (version.isBatchActive) { <p role="status" class="text-sm text-amber-700 dark:text-amber-300">此來源有進行中的批次，目前只可瀏覽。請先停止批次，再重新載入以編輯或刪除。</p> }
          <ol class="grid list-none gap-4">
            @for (chunk of version.chunks; track chunk.id) {
              <li class="grid gap-2 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                <label class="font-medium" [for]="'rag-chunk-' + chunk.id">切塊 #{{ chunk.id }}</label>
                <p class="text-xs tabular-nums text-slate-500">起始字幕 #{{ chunk.firstSequence }} · {{ chunk.startSeconds | number:'1.0-2' }}s – {{ chunk.endSeconds | number:'1.0-2' }}s</p>
                <textarea hlmInput [id]="'rag-chunk-' + chunk.id" [attr.lang]="version.language || null" rows="5" maxlength="20000"
                  [disabled]="busy() !== null || version.isBatchActive" [ngModel]="drafts()[chunk.id] ?? embeddingText(chunk)"
                  (ngModelChange)="setDraft(chunk.id, $event)"></textarea>
                <div class="flex items-center gap-2">
                  <button hlmBtn type="button" size="sm" [disabled]="!combinedSaveReady() || busy() !== null || version.isBatchActive || !changedContent(chunk) || !(drafts()[chunk.id] ?? '').trim()" (click)="save(chunk)">{{ busy() === 'saving' ? '儲存並更新 embedding 中…' : '儲存並更新 embedding' }}</button>
                  <button hlmBtn variant="outline" type="button" size="sm" [disabled]="busy() !== null || !changedContent(chunk)" (click)="setDraft(chunk.id, embeddingText(chunk))">還原修改</button>
                </div>
                @if (chunk.content !== embeddingText(chunk)) { <details class="text-sm"><summary>既有切塊文字（保留對照）</summary><p class="whitespace-pre-wrap">{{ chunk.content }}</p></details> }
                <details class="text-xs text-slate-600 dark:text-slate-400"><summary>切塊對應資訊（唯讀）</summary><pre class="mt-2 whitespace-pre-wrap break-all">{{ chunk.metadataJson }}</pre></details>
              </li>
            } @empty { <li>此版本沒有 RAG 切塊；原始逐字稿仍可存在。</li> }
          </ol>
        }
      </div>
    </dialog>
    <dialog #deletion role="alertdialog" aria-labelledby="chunk-delete-title" aria-describedby="chunk-delete-description"
      (cancel)="guardClose($event)"
      class="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-xl border border-red-200 bg-white p-6 text-slate-900 shadow-xl backdrop:bg-black/50 dark:border-red-900 dark:bg-slate-950 dark:text-slate-100">
      @if (preview(); as target) {
        <h2 id="chunk-delete-title" class="text-lg font-semibold">確認刪除 Version #{{ target.transcriptId }}</h2>
        <p id="chunk-delete-description" class="mt-3 text-sm">將刪除影片 {{ target.videoId }} 的這一版逐字稿及以下資料。此操作無法復原。</p>
        <table class="my-4 w-full text-left text-sm"><thead><tr><th scope="col">受影響的 table</th><th scope="col">刪除筆數</th></tr></thead><tbody>
          <tr><td>YoutubeTranscripts</td><td>{{ target.transcriptCount }}</td></tr>
          <tr><td>YoutubeTranscriptSegments</td><td>{{ target.segmentCount }}</td></tr>
          <tr><td>RagDocumentChunks</td><td>{{ target.chunkCount }}</td></tr>
        </tbody></table>
        <p class="text-sm">保留 YoutubeSources、影片清單與其他逐字稿版本。同影片另有 {{ target.remainingVersionCount }} 個版本；刪除最新版本後，搜尋可能使用上一版本。</p>
        <label class="mt-4 grid gap-1 text-sm" for="delete-transcript-confirm">請輸入版本 ID {{ target.transcriptId }} 確認
          <input hlmInput id="delete-transcript-confirm" type="text" inputmode="numeric" autocomplete="off" [disabled]="busy() === 'deleting'"
            [ngModel]="confirmation()" (ngModelChange)="confirmation.set($event)" />
        </label>
        @if (deleteError()) { <p role="alert" class="mt-3 text-sm text-red-700 dark:text-red-300">{{ deleteError() }}</p> }
        <div class="mt-6 flex justify-end gap-2">
          <button hlmBtn variant="outline" type="button" autofocus [disabled]="busy() === 'deleting'" (click)="deletion.close()">取消，保留資料</button>
          <button hlmBtn variant="destructive" type="button" [disabled]="busy() === 'deleting' || confirmation().trim() !== '' + target.transcriptId" (click)="deleteVersion()">{{ busy() === 'deleting' ? '刪除中…' : '確定刪除此版本' }}</button>
        </div>
      }
    </dialog>
  `,
})
export class TranscriptChunkManagerComponent {
  private readonly api = inject(TranscriptChunksService);
  private readonly session = inject(AuthSessionService);
  private readonly indexStatus = inject(RagIndexStatusService);
  readonly combinedSaveReady = signal(false);
  private readonly destroyRef = inject(DestroyRef);
  @ViewChild('manager') private manager!: ElementRef<HTMLDialogElement>;
  @ViewChild('deletion') private deletion!: ElementRef<HTMLDialogElement>;
  readonly changed = output<{ sourceId: number; deletedTranscriptId?: number }>();
  readonly sourceId = signal(0);
  readonly transcriptId = signal<number | null>(null);
  readonly view = signal<TranscriptChunkView | null>(null);
  readonly drafts = signal<Partial<Record<number, string>>>({});
  readonly busy = signal<'loading' | 'saving' | 'preview' | 'deleting' | null>(null);
  readonly error = signal('');
  readonly message = signal('');
  readonly preview = signal<TranscriptDeletionPreview | null>(null);
  readonly confirmation = signal('');
  readonly deleteError = signal('');
  private request = 0;

  isMutating(): boolean { return this.busy() === 'saving' || this.busy() === 'deleting'; }
  open(sourceId: number, transcriptId?: number): void {
    if (this.isMutating() || !this.session.state()?.roles.includes('Admin')) return;
    this.request++;
    this.sourceId.set(sourceId);
    this.combinedSaveReady.set(false);
    this.indexStatus.state$.pipe(take(1),takeUntilDestroyed(this.destroyRef)).subscribe(state=>this.combinedSaveReady.set(state.progress?.supportsAtomicChunkEmbedding===true&&state.progress?.supportsOriginalTextEmbedding===true));
    this.transcriptId.set(transcriptId ?? null);
    this.view.set(null); this.drafts.set({}); this.error.set(''); this.message.set(''); this.busy.set(null);
    if (!this.manager.nativeElement.open) this.manager.nativeElement.showModal();
    if (transcriptId) this.load();
  }
  close(): void { if (!this.isMutating()) this.manager.nativeElement.close(); }
  guardClose(event: Event): void { if (this.isMutating()) event.preventDefault(); }
  onClosed(): void { this.request++; this.view.set(null); this.busy.set(null); }
  changeId(value: number | null): void {
    this.transcriptId.set(value); this.view.set(null); this.drafts.set({}); this.message.set(''); this.error.set('');
  }
  load(): void {
    const id = this.transcriptId();
    if (this.busy() !== null || id === null || !Number.isSafeInteger(id) || id < 1) return;
    const request = ++this.request;
    this.busy.set('loading'); this.view.set(null); this.error.set(''); this.message.set(''); this.drafts.set({});
    this.api.getApiSourceManagementYoutubeTranscriptsChunks({id:this.sourceId(),transcriptId:id}).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => {
      if (request === this.request) this.busy.set(null);
    })).subscribe({
      next: version => { if (request === this.request) this.view.set(version as TranscriptChunkView); },
      error: error => { if (request === this.request) this.error.set(this.apiError(error, '無法讀取此版本的切塊，請確認來源及版本 ID。')); },
    });
  }
  setDraft(id: number, content: string): void { this.drafts.update(values => ({ ...values, [id]: content })); }
  embeddingText(chunk: EditableTranscriptChunk): string { return chunk.embeddingText ?? chunk.content; }
  changedContent(chunk: EditableTranscriptChunk): boolean { return (this.drafts()[chunk.id] ?? this.embeddingText(chunk)) !== this.embeddingText(chunk); }
  save(chunk: EditableTranscriptChunk): void {
    const version = this.view();
    const content = this.drafts()[chunk.id] ?? this.embeddingText(chunk);
    if (!this.combinedSaveReady() || !version || version.isBatchActive || this.busy() !== null || !content.trim() || !this.changedContent(chunk)) return;
    this.busy.set('saving'); this.error.set(''); this.message.set('');
    this.api.putApiSourceManagementYoutubeTranscriptsChunks({id:this.sourceId(),transcriptId:version.transcriptId,chunkId:chunk.id,requestBody:{content,originalContent:chunk.content}})
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.busy.set(null))).subscribe({
        next: updated => {
          this.view.update(current => current ? { ...current, chunks: current.chunks.map(item => item.id === updated.id ? { ...item, content: updated.content!, embeddingText: updated.content! } : item) } : null);
          this.setDraft(updated.id!, updated.content!);
          this.message.set(`已儲存切塊 #${updated.id} 並更新 embedding。${updated.cleanupPending ? '舊向量待清理，搜尋已排除舊內容。' : ''}`);
          this.changed.emit({ sourceId: this.sourceId() });
        },
        error: error => this.error.set(this.apiError(error, '儲存失敗，請重新載入後重試。')),
      });
  }
  previewDeletion(): void {
    const version = this.view();
    if (!version || version.isBatchActive || this.busy() !== null) return;
    const request = this.request;
    this.busy.set('preview'); this.error.set('');
    this.api.getApiSourceManagementYoutubeTranscriptsDeletionPreview({id:this.sourceId(),transcriptId:version.transcriptId})
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => { if (request === this.request) this.busy.set(null); })).subscribe({
        next: preview => {
          if (request !== this.request) return;
          if (preview.isBatchActive) { this.error.set('此來源仍有進行中的批次，請先停止後再刪除。'); return; }
          this.preview.set(preview as TranscriptDeletionPreview); this.confirmation.set(''); this.deleteError.set('');
          this.deletion.nativeElement.showModal();
        },
        error: error => { if (request === this.request) this.error.set(this.apiError(error, '無法取得刪除影響範圍。')); },
      });
  }
  deleteVersion(): void {
    const target = this.preview();
    if (!target || this.busy() !== null || this.confirmation().trim() !== String(target.transcriptId)) return;
    this.busy.set('deleting'); this.deleteError.set('');
    this.api.deleteApiSourceManagementYoutubeTranscripts({id:this.sourceId(),transcriptId:target.transcriptId,requestBody:{confirmationId:target.transcriptId,expectedRevision:target.revision}})
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.busy.set(null))).subscribe({
        next: result => {
          this.deletion.nativeElement.close(); this.view.set(null); this.drafts.set({});
          this.message.set(`已刪除版本 #${result.transcriptId}：${result.deletedTranscripts} 筆逐字稿、${result.deletedSegments} 個片段、${result.deletedChunks} 個 RAG 切塊。YouTube 來源已保留。`);
          this.changed.emit({ sourceId: this.sourceId(), deletedTranscriptId: result.transcriptId });
        },
        error: error => { this.confirmation.set(''); this.deleteError.set(this.apiError(error, '刪除失敗。請取消並重新確認刪除預覽。')); },
      });
  }
  private apiError(error: unknown, fallback: string): string {
    if (error instanceof ApiError && typeof error.body?.message === 'string') return error.body.message;
    return fallback;
  }
}
