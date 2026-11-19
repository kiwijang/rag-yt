import { CommonModule } from '@angular/common';
import { WorkspaceNavComponent } from '../../components/workspace-nav.component';
import { RagImageResultComponent } from './rag-image-result.component';
import { VectorIndexPanelComponent } from './vector-index-panel.component';
import { AuthSessionService } from '../../services/auth-session.service';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs';
import { RagService } from '@ragyt/api-client';

import {
  HlmButtonDirective,
  HlmCardDescriptionDirective,
  HlmCardDirective,
  HlmCardTitleDirective,
  HlmInputDirective,
  UiIconComponent,
} from '@ragyt/ui';

type RagItem = {
  matchType?: string;
  model?: string;
  page?: number;
  id: number;
  sourceType: number;
  sourceId: number;
  sourceName: string;
  snippet: string;
  score: number;
  videoUrl?: string;
  startSeconds?: number;
};

@Component({
  selector: 'app-user-rag-page',
  standalone: true,
  imports: [
    WorkspaceNavComponent,
    CommonModule,
    RagImageResultComponent,
    VectorIndexPanelComponent,
    FormsModule,
    HlmButtonDirective,
    HlmInputDirective,
    HlmCardDirective,
    HlmCardTitleDirective,
    HlmCardDescriptionDirective,
    UiIconComponent,
  ],
  template: `
    <div class="rag-page">
      <main class="rag-page-shell">
        <app-workspace-nav [showLogout]="false" />
        <header class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 class="text-3xl font-semibold tracking-tight">RAG Query</h1>
            <p hlmCardDescription>Search knowledge from YouTube and PDF sources.</p>
          </div>
          <div class="flex flex-wrap items-end gap-2">
            @if (isAdmin()) { <button hlmBtn variant="outline" size="sm" type="button" (click)="goBack()">Back</button> }
            <button hlmBtn variant="ghost" size="sm" type="button" (click)="logout()">Logout</button>
          </div>
        </header>

        @if (message()) {
          <p role="status" class="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900 dark:border-indigo-900 dark:bg-indigo-950 dark:text-indigo-100">{{ message() }}</p>
        }

        @if (errorMessage()) {
          <p role="alert" class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-100">{{ errorMessage() }}</p>
        }

        <section hlmCard class="grid gap-4 p-5 sm:p-6">
          <h2 hlmCardTitle>RAG Search (with source filter)</h2>
          @if (isAdmin()) { <app-vector-index-panel /> }
          <div role="search" aria-label="RAG 搜尋條件" class="rag-search-panel grid gap-4">
          <h2 class="text-sm font-semibold text-indigo-950 dark:text-indigo-100">搜尋條件</h2>
          <div class="flex flex-wrap items-end gap-4">
            <label class="grid gap-1 text-sm font-medium">搜尋方式
              <select hlmInput aria-label="搜尋方式" [ngModel]="searchMode()" (ngModelChange)="searchMode.set($event)">
                <option value="hybrid">混合搜尋（BGE-M3 + BM25）</option>
                <option value="vector">語意搜尋（BGE-M3）</option>
                <option value="keyword">關鍵字</option>
              </select>
            </label>
            <label><input type="checkbox" [ngModel]="includeImages()" (ngModelChange)="includeImages.set($event)" /> 包含 Jina CLIP v2 圖像搜尋</label>
          </div>
          <div class="grid gap-3 sm:grid-cols-3">
            <input hlmInput
              [ngModel]="query()"
              (ngModelChange)="query.set($event)"
              aria-label="Enter your question or keyword" placeholder="Enter your question or keyword"
            />

            <select hlmInput aria-label="Search source type" [ngModel]="sourceType()" (ngModelChange)="sourceType.set($event)">
              <option value="">All source types</option>
              <option value="1">YouTube</option>
              <option value="2">PDF</option>
            </select>

            <input hlmInput
              [ngModel]="sourceId()"
              (ngModelChange)="sourceId.set($event)"
              aria-label="Source ID (optional)" placeholder="Source ID (optional)"
            />
          </div>

          <div class="flex flex-wrap items-center gap-3">
            <button hlmBtn type="button" (click)="search()" [disabled]="isSubmitting()">
              <ui-icon name="search" />
              {{ isSubmitting() ? 'Searching...' : 'Search RAG' }}
            </button>
          </div>
          </div>
        </section>

        <section hlmCard class="grid gap-4 p-5 sm:p-6">
          <h2 hlmCardTitle>Results</h2>

          @if (results().length === 0) {
            <p class="text-sm text-slate-600 dark:text-slate-400">No result yet. Try a keyword search.</p>
          } @else {
            <div class="grid gap-3">
              @for (item of results(); track ragResultKey(item)) {
                <article hlmCard class="grid min-w-0 gap-2 break-words p-4">
                  <p class="text-xs text-slate-600 dark:text-slate-400">
                    {{ item.sourceType === 1 ? 'YouTube' : 'PDF' }} · source #{{ item.sourceId }} · score {{ item.score }}
                  </p>
                  <h3 hlmCardTitle>{{ item.sourceName }}</h3>
                  <p class="whitespace-pre-line">{{ item.snippet }}</p>
                  @if (item.model) { <p class="text-xs">{{ item.model }} · {{ item.matchType === 'image' ? '圖像命中' : '文字命中' }}</p> }
                  @if (item.sourceType === 2 && item.page) { <app-rag-image-result [sourceId]="item.sourceId" [page]="item.page" /> }
                  @if (item.videoUrl && item.startSeconds != null) {
                    <a hlmBtn variant="link" size="sm" hlmClass="h-auto justify-start whitespace-normal p-0 text-left break-all" [href]="item.videoUrl"
                      target="_blank" rel="noopener noreferrer">Watch at {{ item.startSeconds | number:'1.0-2' }}s</a>
                  }
                </article>
              }
            </div>
          }
        </section>
      </main>
    </div>
  `,
})
export class UserRagPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly session = inject(AuthSessionService);
  private readonly router = inject(Router);
  private readonly ragService = inject(RagService);

  readonly query = signal('');
  readonly searchMode = signal('hybrid');
  readonly includeImages = signal(true);
  readonly sourceType = signal('');
  readonly sourceId = signal('');
  readonly results = signal<RagItem[]>([]);
  ragResultKey(item: RagItem): string { return `${item.matchType ?? 'text'}:${item.id}`; }
  readonly isSubmitting = signal(false);
  readonly message = signal('');
  readonly errorMessage = signal('');

  readonly hasQuery = computed(() => !!this.query().trim());
  readonly isAdmin = computed(() => this.session.state()?.roles.includes('Admin') === true);
  ionViewWillEnter(): void {
    this.session.syncFromStorage();
    const query = this.route.snapshot.queryParamMap.get('q');
    if (query) this.query.set(query);
  }

  logout(): void {
    this.session.clear();
    void this.router.navigateByUrl('/login', { replaceUrl: true });
  }

  goBack(): void {
    this.router.navigateByUrl('/dashboard');
  }

  search(): void {
    const q = this.query().trim();
    if (!q) {
      this.errorMessage.set('Please enter a search term.');
      return;
    }

    const typeValue = this.sourceType().trim();
    const idValue = this.sourceId().trim();

    this.isSubmitting.set(true);
    this.errorMessage.set('');
    this.message.set('');

    this.ragService
      .getApiRagSearch({
        query: q,
        mode: this.searchMode(),
        includeImages: this.includeImages(),
        sourceType: typeValue ? (Number(typeValue) as 1 | 2) : undefined,
        sourceId: idValue ? Number(idValue) : undefined,
        take: 20,
      })
      .pipe(finalize(() => this.isSubmitting.set(false)))
      .subscribe({
        next: (response: { items?: RagItem[]; searchMode?: string; warning?: string }) => {
          this.results.set(response?.items ?? []);
          this.message.set(`${response.warning ?? ''} [${response.searchMode ?? 'keyword'}] Found ${response?.items?.length ?? 0} result(s).`);
        },
        error: () => {
          this.results.set([]);
          this.errorMessage.set('RAG query failed.');
        },
      });
  }
}
