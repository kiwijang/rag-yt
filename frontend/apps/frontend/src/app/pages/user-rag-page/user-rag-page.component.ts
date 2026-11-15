import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { RagService } from '@ragyt/api-client';

import {
  HlmButtonDirective,
  HlmCardContentDirective,
  HlmCardDescriptionDirective,
  HlmCardDirective,
  HlmCardFooterDirective,
  HlmCardTitleDirective,
  HlmInputDirective,
  UiIconComponent,
} from '@ragyt/ui';

type RagItem = {
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
    CommonModule,
    FormsModule,
    HlmButtonDirective,
    HlmInputDirective,
    HlmCardDirective,
    HlmCardTitleDirective,
    HlmCardDescriptionDirective,
    HlmCardContentDirective,
    HlmCardFooterDirective,
    UiIconComponent,
  ],
  template: `
    <div class="h-full overflow-y-auto bg-slate-50 dark:bg-slate-950">
      <main class="mx-auto grid max-w-5xl gap-5 px-4 py-6 sm:px-6 sm:py-8">
        <header class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 class="text-3xl font-semibold tracking-tight">RAG Query</h1>
            <p hlmCardDescription>Search knowledge from YouTube and PDF sources.</p>
          </div>
          <div class="flex flex-wrap items-end gap-2">
            <button hlmBtn variant="outline" size="sm" type="button" (click)="goBack()">Back</button>
          </div>
        </header>

        @if (message()) {
          <p role="status" class="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900 dark:border-indigo-900 dark:bg-indigo-950 dark:text-indigo-100">{{ message() }}</p>
        }

        @if (errorMessage()) {
          <p role="alert" class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-100">{{ errorMessage() }}</p>
        }

        <section hlmCard class="grid gap-4">
          <div hlmCardContent class="grid gap-3 !pt-6 sm:grid-cols-3">
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

          <footer hlmCardFooter>
            <button hlmBtn type="button" (click)="search()" [disabled]="isSubmitting()">
              <ui-icon name="search" />
              {{ isSubmitting() ? 'Searching...' : 'Search RAG' }}
            </button>
          </footer>
        </section>

        <section hlmCard class="grid gap-4 p-5 sm:p-6">
          <h2 hlmCardTitle>Results</h2>

          @if (results().length === 0) {
            <p class="text-sm text-slate-600 dark:text-slate-400">No result yet. Try a keyword search.</p>
          } @else {
            <div class="grid gap-3">
              @for (item of results(); track item.id) {
                <article hlmCard class="grid min-w-0 gap-2 break-words p-4">
                  <p class="text-xs text-slate-600 dark:text-slate-400">
                    {{ item.sourceType === 1 ? 'YouTube' : 'PDF' }} · source #{{ item.sourceId }} · score {{ item.score }}
                  </p>
                  <h3 hlmCardTitle>{{ item.sourceName }}</h3>
                  <p class="whitespace-pre-line">{{ item.snippet }}</p>
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
  private readonly router = inject(Router);
  private readonly ragService = inject(RagService);

  readonly query = signal('');
  readonly sourceType = signal('');
  readonly sourceId = signal('');
  readonly results = signal<RagItem[]>([]);
  readonly isSubmitting = signal(false);
  readonly message = signal('');
  readonly errorMessage = signal('');

  readonly hasQuery = computed(() => !!this.query().trim());

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
        sourceType: typeValue ? (Number(typeValue) as 1 | 2) : undefined,
        sourceId: idValue ? Number(idValue) : undefined,
        take: 20,
      })
      .pipe(finalize(() => this.isSubmitting.set(false)))
      .subscribe({
        next: (response: { items?: RagItem[] }) => {
          this.results.set(response?.items ?? []);
          this.message.set(`Found ${response?.items?.length ?? 0} result(s).`);
        },
        error: () => {
          this.results.set([]);
          this.errorMessage.set('RAG query failed.');
        },
      });
  }
}
