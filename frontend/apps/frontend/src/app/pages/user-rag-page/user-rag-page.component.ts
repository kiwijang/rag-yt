import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { RagService } from '@ragyt/api-client';

type RagItem = {
  id: number;
  sourceType: number;
  sourceId: number;
  sourceName: string;
  snippet: string;
  score: number;
};

@Component({
  selector: 'app-user-rag-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="rag-shell">
      <main class="rag-panel">
        <header class="topbar">
          <div>
            <h2>RAG Query</h2>
            <p>Search knowledge from YouTube and PDF sources.</p>
          </div>
          <div class="top-actions">
            <button type="button" class="secondary" (click)="goBack()">Back</button>
          </div>
        </header>

        @if (message()) {
          <p class="notice">{{ message() }}</p>
        }

        @if (errorMessage()) {
          <p class="error">{{ errorMessage() }}</p>
        }

        <section class="query-card">
          <div class="form-grid">
            <input
              [ngModel]="query()"
              (ngModelChange)="query.set($event)"
              placeholder="Enter your question or keyword"
            />

            <select [ngModel]="sourceType()" (ngModelChange)="sourceType.set($event)">
              <option value="">All source types</option>
              <option value="1">YouTube</option>
              <option value="2">PDF</option>
            </select>

            <input
              [ngModel]="sourceId()"
              (ngModelChange)="sourceId.set($event)"
              placeholder="Source ID (optional)"
            />
          </div>

          <button type="button" class="primary" (click)="search()" [disabled]="isSubmitting()">
            {{ isSubmitting() ? 'Searching...' : 'Search RAG' }}
          </button>
        </section>

        <section class="results-card">
          <h3>Results</h3>

          @if (results().length === 0) {
            <p class="empty">No result yet. Try a keyword search.</p>
          } @else {
            <div class="result-list">
              @for (item of results(); track item.id) {
                <article class="result-item">
                  <p class="meta">
                    {{ item.sourceType === 1 ? 'YouTube' : 'PDF' }} · source #{{ item.sourceId }} · score {{ item.score }}
                  </p>
                  <h4>{{ item.sourceName }}</h4>
                  <p>{{ item.snippet }}</p>
                </article>
              }
            </div>
          }
        </section>
      </main>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .rag-shell {
        min-height: 100vh;
        max-height: 100vh;
        overflow-y: auto;
        background: linear-gradient(135deg, #071126 0%, #0f172a 45%, #172554 100%);
        color: #e2e8f0;
        padding: 24px;
      }

      .rag-panel {
        max-width: 980px;
        margin: 0 auto;
        display: grid;
        gap: 20px;
      }

      .topbar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
      }

      h2, h3, h4 {
        margin: 0;
      }

      p {
        margin: 0.35rem 0 0;
        color: #cbd5e1;
      }

      .top-actions {
        display: flex;
        gap: 10px;
      }

      .query-card,
      .results-card {
        background: rgba(15, 23, 42, 0.8);
        border: 1px solid rgba(148, 163, 184, 0.25);
        border-radius: 16px;
        padding: 18px;
      }

      .form-grid {
        display: grid;
        grid-template-columns: 2fr 1fr 1fr;
        gap: 12px;
      }

      input,
      select,
      button {
        width: 100%;
        border-radius: 10px;
        padding: 12px 14px;
        border: 1px solid rgba(148, 163, 184, 0.35);
        background: rgba(15, 23, 42, 0.9);
        color: #f8fafc;
      }

      button {
        cursor: pointer;
        font-weight: 700;
        margin-top: 14px;
      }

      .primary {
        background: linear-gradient(135deg, #2563eb, #14b8a6);
        border-color: transparent;
      }

      .secondary {
        background: rgba(59, 130, 246, 0.1);
        color: #dbeafe;
      }

      .notice,
      .error,
      .empty {
        padding: 10px 12px;
        border-radius: 12px;
      }

      .notice {
        background: rgba(22, 163, 74, 0.14);
        border: 1px solid rgba(22, 163, 74, 0.4);
      }

      .error {
        background: rgba(239, 68, 68, 0.12);
        border: 1px solid rgba(239, 68, 68, 0.45);
      }

      .result-list {
        display: grid;
        gap: 12px;
        margin-top: 12px;
      }

      .result-item {
        border: 1px solid rgba(148, 163, 184, 0.2);
        background: rgba(30, 41, 59, 0.8);
        border-radius: 12px;
        padding: 14px;
      }

      .meta {
        color: #7dd3fc;
        font-size: 0.82rem;
        letter-spacing: 0.02em;
      }

      @media (max-width: 760px) {
        .form-grid {
          grid-template-columns: 1fr;
        }

        .topbar {
          flex-direction: column;
          align-items: flex-start;
        }
      }
    `,
  ],
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
