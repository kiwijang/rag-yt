import { CommonModule } from '@angular/common';
import { Component, DestroyRef, ElementRef, ViewChild, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Subscription, finalize } from 'rxjs';
import { ApiError, ChatService } from '@ragyt/api-client';
import { HlmButtonDirective, HlmCardDirective, HlmInputDirective } from '@ragyt/ui';
import { WorkspaceNavComponent } from '../../components/workspace-nav.component';
import { AuthSessionService } from '../../services/auth-session.service';

type Message = { role: 'user' | 'assistant'; content: string };

@Component({
  selector: 'app-chat-page', standalone: true,
  imports: [CommonModule, FormsModule, HlmButtonDirective, HlmCardDirective, HlmInputDirective, WorkspaceNavComponent],
  template: `
    <div class="rag-page">
      <main class="rag-page-shell">
        <app-workspace-nav />
        <header class="flex flex-wrap items-center justify-between gap-3">
          <div><p class="text-xs font-semibold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">LOCAL AI WORKSPACE</p><h1 class="mt-1 text-3xl font-semibold">LLM 對話</h1><p class="mt-2 text-sm text-slate-600 dark:text-slate-400">與本機 Ollama 對話。此頁目前使用一般對話，尚未加入 RAG 檢索。</p></div>
          <button hlmBtn variant="outline" size="sm" type="button" (click)="clear()" [disabled]="busy() || !messages().length">清除對話</button>
        </header>
        <section hlmCard class="overflow-hidden">
          <div class="rag-search-panel m-4 flex flex-wrap items-end gap-3">
            <label class="grid gap-1 text-sm font-medium">Ollama 模型
              <select hlmInput aria-label="Ollama 模型" [ngModel]="model()" (ngModelChange)="changeModel($event)" [disabled]="busy() || loadingModels()">
                @if (!models().includes('gemma4:12b')) { <option value="gemma4:12b">gemma4:12b（尚未偵測到）</option> }
                @for (name of models(); track name) { <option [value]="name">{{ name }}</option> }
              </select>
            </label>
            <button hlmBtn variant="outline" size="sm" type="button" (click)="loadModels()" [disabled]="busy() || loadingModels()">{{ loadingModels() ? '讀取中…' : '重新整理模型' }}</button>
            <p class="text-xs text-slate-600 dark:text-slate-400">對話僅保留於目前登入期間，重新整理後清除。</p>
          </div>
          @if (error()) { <p role="alert" class="mx-4 mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">{{ error() }}</p> }
          @if (!loadingModels() && !models().includes(model()) && !error()) { <p role="status" class="mx-4 mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">尚未安裝 {{ model() }}。請執行 <code>ollama pull {{ model() }}</code> 後重新整理模型。</p> }
          <div #thread role="log" aria-label="對話訊息" aria-live="polite" class="grid max-h-[55vh] min-h-72 content-start gap-5 overflow-y-auto border-y border-slate-200 p-5 dark:border-slate-800 sm:p-8">
            @if (!messages().length) {
              <div class="mx-auto grid max-w-xl gap-4 py-8 text-center"><div class="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-100 text-2xl text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300" aria-hidden="true">✦</div><h2 class="text-xl font-semibold">今天想了解什麼？</h2><p class="text-sm text-slate-500">直接提問，或從 3D 人體模型選擇肌肉後帶入問題。</p>
                <button hlmBtn variant="outline" type="button" (click)="draft.set('請用簡單的方式解釋這個主題，並列出關鍵概念。')">幫我理解一個主題</button>
              </div>
            }
            @for (message of messages(); track $index) {
              <article class="max-w-[92%] rounded-2xl px-4 py-3 sm:max-w-[85%]" [class]="message.role === 'user' ? 'justify-self-end bg-indigo-600 text-white' : 'justify-self-start bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100'">
                <p class="mb-1 text-xs font-semibold opacity-70">{{ message.role === 'user' ? '你' : 'Ollama · ' + model() }}</p>
                <p class="whitespace-pre-wrap break-words text-sm leading-7">{{ message.content }}</p>
              </article>
            }
            @if (busy()) { <p role="status" class="flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-300"><span class="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden="true"></span>模型正在產生回答…</p> }
          </div>
          <form class="grid gap-3 p-4 sm:p-5" (ngSubmit)="send()">
            <label for="chat-message" class="text-sm font-medium">你的訊息</label>
            <textarea hlmInput id="chat-message" name="message" rows="3" maxlength="12000" placeholder="輸入問題…" [ngModel]="draft()" (ngModelChange)="draft.set($event)" [disabled]="busy()" (keydown)="onKeydown($event)"></textarea>
            <div class="flex flex-wrap items-center justify-between gap-3"><p class="text-xs text-slate-500">Ctrl / ⌘ + Enter 送出 · {{ draft().length }} / 12000</p>
              @if (busy()) { <button hlmBtn variant="outline" type="button" (click)="stop()">停止產生</button> }
              @else { <button hlmBtn type="submit" [disabled]="!draft().trim() || !models().includes(model()) || loadingModels()">送出訊息</button> }
            </div>
          </form>
        </section>
      </main>
    </div>
  `,
})
export class ChatPageComponent {
  private readonly api = inject(ChatService);
  private readonly session = inject(AuthSessionService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroy = inject(DestroyRef);
  private request?: Subscription;
  private modelRequest?: Subscription;
  @ViewChild('thread') thread?: ElementRef<HTMLElement>;
  readonly models = signal<string[]>([]);
  readonly model = signal('gemma4:12b');
  readonly loadingModels = signal(false);
  readonly busy = signal(false);
  readonly messages = signal<Message[]>([]);
  readonly draft = signal('');
  readonly error = signal('');

  constructor() {
    let owner = this.session.state()?.token;
    effect(() => {
      const token = this.session.state()?.token;
      if (owner !== token) untracked(() => { this.stop(); this.modelRequest?.unsubscribe(); this.messages.set([]); this.draft.set(''); this.models.set([]); this.error.set(''); owner = token; });
    }, { allowSignalWrites: true });
    this.destroy.onDestroy(() => { this.request?.unsubscribe(); this.modelRequest?.unsubscribe(); });
  }

  ionViewWillEnter(): void {
    const muscle = this.route.snapshot.queryParamMap.get('muscle');
    if (muscle) this.draft.set(`我想了解${muscle}，請介紹它的位置與主要功能。`);
    this.loadModels();
  }
  ionViewWillLeave(): void { this.stop(); this.modelRequest?.unsubscribe(); }
  loadModels(): void {
    this.modelRequest?.unsubscribe(); this.loadingModels.set(true); this.error.set('');
    this.modelRequest = this.api.getApiChatModels().pipe(takeUntilDestroyed(this.destroy), finalize(() => this.loadingModels.set(false)))
      .subscribe({ next: response => this.models.set(response.models?.map(m => m.name ?? '').filter(Boolean) ?? []), error: error => this.error.set(this.describe(error)) });
  }
  changeModel(model: string): void { this.model.set(model); this.messages.set([]); this.error.set(''); }
  clear(): void { this.messages.set([]); this.error.set(''); }
  send(): void {
    const content = this.draft().trim();
    if (!content || this.busy() || !this.models().includes(this.model())) return;
    const previous = this.messages();
    const history: Message[] = [...previous, { role: 'user', content }];
    if (history.length > 39 || history.reduce((size, message) => size + message.content.length, 0) > 48000) { this.error.set('此段對話已達長度限制，請清除對話後開始新主題。'); return; }
    this.messages.set(history); this.draft.set(''); this.busy.set(true); this.error.set(''); this.scroll();
    this.request = this.api.postApiChat({ requestBody: { model: this.model(), messages: history } }).pipe(takeUntilDestroyed(this.destroy), finalize(() => this.busy.set(false)))
      .subscribe({ next: response => { this.messages.update(items => [...items, { role: 'assistant', content: response.content ?? '' }]); this.scroll(); }, error: error => { this.messages.set(previous); this.draft.set(content); this.error.set(this.describe(error)); } });
  }
  stop(): void {
    if (this.busy()) {
      this.request?.unsubscribe();
      const last = this.messages().at(-1);
      if (last?.role === 'user') { this.draft.set(last.content); this.messages.update(items => items.slice(0, -1)); }
    }
    this.busy.set(false);
  }
  onKeydown(event: KeyboardEvent): void { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && !event.isComposing) { event.preventDefault(); this.send(); } }
  private scroll(): void { setTimeout(() => this.thread?.nativeElement.scrollTo({ top: this.thread.nativeElement.scrollHeight, behavior: 'smooth' })); }
  private describe(error: unknown): string {
    if (error instanceof ApiError) {
      if (error.status === 404 && !(error.body as { message?: string })?.message) return '目前執行的 API 尚未提供對話功能，請在背景工作完成後重新啟動最新版 API。';
      return (error.body as { message?: string })?.message ?? `無法讀取 Ollama（HTTP ${error.status}）。`;
    }
    return '無法連線至 API，請確認後端服務已啟動。';
  }
}
