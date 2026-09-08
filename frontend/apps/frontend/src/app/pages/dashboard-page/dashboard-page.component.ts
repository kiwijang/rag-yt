import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { RagService, SourceManagementService } from '@ragyt/api-client';

type SourceSummary = {
  id: number;
  name: string;
  url?: string;
  channelId?: string;
  channelName?: string;
  status?: number;
};

type RagItem = {
  id: number;
  sourceType: number;
  sourceId: number;
  sourceName: string;
  snippet: string;
  score: number;
};

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="dashboard-shell">
      <main class="main-panel">
        <header>
          <div>
            <h3>RAG Source Console</h3>
            <p>Manage YouTube/PDF data sources and test retrieval filters.</p>
          </div>
          <div class="header-actions">
            <span class="badge">{{ userRole() }}</span>
            <button type="button" class="secondary-button" (click)="goToUserRag()">RAG Query</button>
            <button type="button" class="logout-button" (click)="logout()">Logout</button>
          </div>
        </header>

        @if (message()) {
          <p class="banner">{{ message() }}</p>
        }

        @if (errorMessage()) {
          <p class="error-banner">{{ errorMessage() }}</p>
        }

        <section class="panel">
          <h4>YouTube Sources</h4>
          @if (isAdmin()) {
            <div class="grid two">
              <input [ngModel]="ytName()" (ngModelChange)="ytName.set($event)" placeholder="Source Name" />
              <input [ngModel]="ytChannelId()" (ngModelChange)="ytChannelId.set($event)" placeholder="Channel ID" />
              <input [ngModel]="ytChannelName()" (ngModelChange)="ytChannelName.set($event)" placeholder="Channel Name" />
              <input [ngModel]="ytUrl()" (ngModelChange)="ytUrl.set($event)" placeholder="YouTube URL or channel URL" />
            </div>
            <button (click)="createYoutubeSource()" [disabled]="isSubmitting()">Add YouTube Source</button>
          }

          @if (isLoading()) {
            <p>Loading...</p>
          } @else {
            <div class="cards">
              @for (source of youtubeSources(); track source.id) {
                <article class="source-card">
                  <div>
                    <strong>{{ source.name }}</strong>
                    <p>{{ source.channelName || source.channelId || 'YouTube source' }}</p>
                    <p class="mini">{{ source.url }}</p>
                  </div>
                  @if (isAdmin()) {
                    <div class="row-actions">
                      <button class="outline" (click)="deleteYoutubeSource(source.id)">Delete</button>
                      <button class="accent" (click)="syncYoutubeSource(source.id, 'channel')">Sync Channel</button>
                      <button class="accent" (click)="syncYoutubeSource(source.id, 'video')">Sync Video</button>
                    </div>
                  }
                </article>
              } @empty {
                <p>No YouTube sources available.</p>
              }
            </div>
          }
        </section>

        <section class="panel">
          <h4>PDF OCR Sources</h4>
          @if (isAdmin()) {
            <div class="grid two">
              <input [ngModel]="pdfName()" (ngModelChange)="pdfName.set($event)" placeholder="PDF Source Name" />
              <input [ngModel]="pdfDescription()" (ngModelChange)="pdfDescription.set($event)" placeholder="Description" />
              <input type="file" accept="application/pdf" (change)="onPdfFileSelected($event)" />
            </div>
            <button (click)="uploadPdf()" [disabled]="isSubmitting()">Upload + OCR</button>
          }

          <div class="cards">
            @for (source of pdfSources(); track source.id) {
              <article class="source-card">
                <div>
                  <strong>{{ source.name }}</strong>
                  <p class="mini">{{ source.url }}</p>
                </div>
                @if (isAdmin()) {
                  <button class="outline" (click)="deletePdfSource(source.id)">Delete</button>
                }
              </article>
            } @empty {
              <p>No PDF sources available.</p>
            }
          </div>
        </section>

        <section class="panel">
          <h4>RAG Search (with source filter)</h4>
          <div class="grid three">
            <input [ngModel]="searchQuery()" (ngModelChange)="searchQuery.set($event)" placeholder="Enter query" />
            <select [ngModel]="searchSourceType()" (ngModelChange)="searchSourceType.set($event)">
              <option value="">All Source Types</option>
              <option value="1">YouTube</option>
              <option value="2">PDF</option>
            </select>
            <input [ngModel]="searchSourceId()" (ngModelChange)="searchSourceId.set($event)" placeholder="Source ID (optional)" />
          </div>
          <button (click)="searchRag()" [disabled]="isSubmitting()">Search</button>

          <div class="results">
            @for (item of ragResults(); track item.id) {
              <article class="result-card">
                <p class="meta">{{ item.sourceType === 1 ? 'YouTube' : 'PDF' }} #{{ item.sourceId }} | {{ item.sourceName }} | score {{ item.score }}</p>
                <p>{{ item.snippet }}</p>
              </article>
            } @empty {
              <p class="mini">No result yet. Run a query above.</p>
            }
          </div>
        </section>
      </main>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .dashboard-shell {
        min-height: 100vh;
        max-height: 100vh;
        overflow-y: auto;
        background: linear-gradient(150deg, #052e2b 0%, #0b3b47 46%, #1c2f59 100%);
        color: #ecfeff;
        padding: 22px;
      }

      .main-panel {
        max-width: 1080px;
        margin: 0 auto;
        display: grid;
        gap: 18px;
      }

      header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 12px;
      }

      .header-actions {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      h3 {
        margin: 0;
        font-size: 1.7rem;
      }

      p {
        margin: 0.4rem 0 0;
        color: #cffafe;
      }

      .badge {
        border-radius: 999px;
        background: #f59e0b;
        color: #422006;
        padding: 6px 10px;
        font-weight: 700;
        font-size: 0.85rem;
      }

      .banner,
      .error-banner {
        margin: 0;
        padding: 10px 12px;
        border-radius: 10px;
      }

      .banner {
        background: rgba(34, 197, 94, 0.18);
        border: 1px solid rgba(34, 197, 94, 0.5);
      }

      .error-banner {
        background: rgba(220, 38, 38, 0.18);
        border: 1px solid rgba(220, 38, 38, 0.52);
      }

      .panel {
        background: rgba(8, 47, 73, 0.74);
        border: 1px solid rgba(186, 230, 253, 0.24);
        border-radius: 16px;
        padding: 16px;
      }

      h4 {
        margin: 0 0 12px;
      }

      .grid {
        display: grid;
        gap: 10px;
      }

      .grid.two {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .grid.three {
        grid-template-columns: 2fr 1fr 1fr;
      }

      .cards,
      .results {
        display: grid;
        gap: 10px;
        margin-top: 12px;
      }

      .source-card,
      .result-card {
        background: rgba(12, 74, 110, 0.55);
        border: 1px solid rgba(186, 230, 253, 0.24);
        border-radius: 12px;
        padding: 12px;
      }

      .source-card {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        align-items: center;
      }

      .row-actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        justify-content: flex-end;
      }

      .mini,
      .meta {
        color: #bae6fd;
        font-size: 0.86rem;
      }

      input,
      select,
      button {
        border-radius: 10px;
        border: 1px solid #67e8f9;
        background: rgba(12, 74, 110, 0.55);
        color: #ecfeff;
        padding: 10px;
      }

      button {
        cursor: pointer;
        margin-top: 10px;
        font-weight: 700;
      }

      .secondary-button,
      .logout-button {
        margin-top: 0;
      }

      .secondary-button {
        background: rgba(96, 165, 250, 0.14);
        border-color: rgba(96, 165, 250, 0.8);
        color: #dbeafe;
      }

      .logout-button {
        background: rgba(248, 113, 113, 0.14);
        border-color: rgba(248, 113, 113, 0.8);
        color: #fecaca;
      }

      button.accent {
        background: linear-gradient(120deg, #f59e0b, #f97316);
        border-color: #f59e0b;
        color: #1f2937;
      }

      button.outline {
        border-color: #fca5a5;
      }

      button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      @media (max-width: 760px) {
        .grid.two,
        .grid.three {
          grid-template-columns: 1fr;
        }

        .source-card {
          align-items: flex-start;
          flex-direction: column;
        }
      }
    `,
  ],
})
export class DashboardPageComponent {
  private readonly router = inject(Router);
  private readonly sourceManagementService = inject(SourceManagementService);
  private readonly ragService = inject(RagService);

  readonly youtubeSources = signal<SourceSummary[]>([]);
  readonly pdfSources = signal<SourceSummary[]>([]);
  readonly ragResults = signal<RagItem[]>([]);
  readonly userRole = signal('User');
  readonly isLoading = signal(true);
  readonly isSubmitting = signal(false);
  readonly message = signal('');
  readonly errorMessage = signal('');

  readonly ytName = signal('');
  readonly ytChannelId = signal('');
  readonly ytChannelName = signal('');
  readonly ytUrl = signal('');

  readonly pdfName = signal('');
  readonly pdfDescription = signal('');
  readonly selectedPdfFile = signal<File | null>(null);

  readonly searchQuery = signal('');
  readonly searchSourceType = signal('');
  readonly searchSourceId = signal('');

  readonly isAdmin = computed(() => this.userRole() === 'Admin');

  constructor() {
    this.loadSources();
  }

  goToUserRag(): void {
    this.router.navigateByUrl('/user-rag');
  }

  private goToAdminDashboard(): void {
    this.router.navigateByUrl('/admin-dashboard');
  }

  logout(): void {
    localStorage.removeItem('ragyt_token');
    localStorage.removeItem('ragyt_user');
    this.router.navigateByUrl('/login');
  }

  private setBusy(on: boolean): void {
    this.isSubmitting.set(on);
    if (on) {
      this.message.set('');
      this.errorMessage.set('');
    }
  }

  private loadSources(): void {
    const userInfo = localStorage.getItem('ragyt_user');
    if (userInfo) {
      const parsed = JSON.parse(userInfo) as { roles?: string[] };
      this.userRole.set(parsed.roles?.includes('Admin') ? 'Admin' : 'User');
    }

    this.sourceManagementService.getApiSourceManagementYoutube().subscribe({
      next: (sources: SourceSummary[]) => {
        this.youtubeSources.set(sources ?? []);
        this.isLoading.set(false);
      },
      error: () => {
        this.youtubeSources.set([]);
        this.isLoading.set(false);
      },
    });

    this.sourceManagementService.getApiSourceManagementPdf().subscribe({
      next: (sources: SourceSummary[]) => this.pdfSources.set(sources ?? []),
      error: () => this.pdfSources.set([]),
    });
  }

  createYoutubeSource(): void {
    if (!this.ytName().trim() || !this.ytUrl().trim()) {
      this.errorMessage.set('YouTube source name and URL are required.');
      return;
    }

    this.setBusy(true);
    this.sourceManagementService
      .postApiSourceManagementYoutube({
        requestBody: {
          name: this.ytName().trim(),
          channelId: this.ytChannelId().trim(),
          channelName: this.ytChannelName().trim() || undefined,
          url: this.ytUrl().trim(),
          isActive: true,
        },
      })
      .pipe(finalize(() => this.setBusy(false)))
      .subscribe({
        next: () => {
          this.message.set('YouTube source created.');
          this.ytName.set('');
          this.ytChannelId.set('');
          this.ytChannelName.set('');
          this.ytUrl.set('');
          this.loadSources();
        },
        error: () => this.errorMessage.set('Failed to create YouTube source.'),
      });
  }

  syncYoutubeSource(id: number, mode: 'channel' | 'video'): void {
    this.setBusy(true);
    this.sourceManagementService
      .postApiSourceManagementYoutubeSync({
        id,
        requestBody: {
          mode,
          take: 12,
        },
      })
      .pipe(finalize(() => this.setBusy(false)))
      .subscribe({
        next: (result: { syncedChunks?: number }) => {
          this.message.set(`YouTube sync done. chunks=${result?.syncedChunks ?? 0}`);
        },
        error: () => this.errorMessage.set('YouTube sync failed.'),
      });
  }

  deleteYoutubeSource(id: number): void {
    this.setBusy(true);
    this.sourceManagementService
      .deleteApiSourceManagementYoutube({ id })
      .pipe(finalize(() => this.setBusy(false)))
      .subscribe({
        next: () => {
          this.message.set('YouTube source deleted.');
          this.loadSources();
        },
        error: () => this.errorMessage.set('Failed to delete YouTube source.'),
      });
  }

  onPdfFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.selectedPdfFile.set(file);
  }

  uploadPdf(): void {
    if (!this.pdfName().trim()) {
      this.errorMessage.set('PDF source name is required.');
      return;
    }

    if (!this.selectedPdfFile()) {
      this.errorMessage.set('Please choose a PDF file first.');
      return;
    }

    this.setBusy(true);
    this.sourceManagementService
      .postApiSourceManagementPdfUpload({
        formData: {
          Name: this.pdfName().trim(),
          Description: this.pdfDescription().trim(),
          File: this.selectedPdfFile() as unknown as Blob,
        },
      })
      .pipe(finalize(() => this.setBusy(false)))
      .subscribe({
        next: (result: { chunkCount?: number }) => {
          this.message.set(`PDF uploaded and OCR ingested. chunks=${result?.chunkCount ?? 0}`);
          this.pdfName.set('');
          this.pdfDescription.set('');
          this.selectedPdfFile.set(null);
          this.loadSources();
        },
        error: () => this.errorMessage.set('PDF upload/OCR failed.'),
      });
  }

  deletePdfSource(id: number): void {
    this.setBusy(true);
    this.sourceManagementService
      .deleteApiSourceManagementPdf({ id })
      .pipe(finalize(() => this.setBusy(false)))
      .subscribe({
        next: () => {
          this.message.set('PDF source deleted.');
          this.loadSources();
        },
        error: () => this.errorMessage.set('Failed to delete PDF source.'),
      });
  }

  searchRag(): void {
    if (!this.searchQuery().trim()) {
      this.errorMessage.set('Search query is required.');
      return;
    }

    const sourceTypeRaw = this.searchSourceType().trim();
    const sourceIdRaw = this.searchSourceId().trim();

    this.setBusy(true);
    this.ragService
      .getApiRagSearch({
        query: this.searchQuery().trim(),
        sourceType: sourceTypeRaw ? (Number(sourceTypeRaw) as 1 | 2) : undefined,
        sourceId: sourceIdRaw ? Number(sourceIdRaw) : undefined,
        take: 20,
      })
      .pipe(finalize(() => this.setBusy(false)))
      .subscribe({
        next: (res: { items?: RagItem[] }) => {
          this.ragResults.set(res?.items ?? []);
          this.message.set(`RAG retrieved ${res?.items?.length ?? 0} item(s).`);
        },
        error: () => {
          this.ragResults.set([]);
          this.errorMessage.set('RAG search failed.');
        },
      });
  }
}
