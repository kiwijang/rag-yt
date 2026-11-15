import { CommonModule } from '@angular/common';
import { TranscriptChunkManagerComponent } from './transcript-chunk-manager.component';
import { Component, ElementRef, ViewChild, computed, DestroyRef, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { catchError, EMPTY, exhaustMap, finalize, takeWhile, throwError, timer } from 'rxjs';
import { ApiError, RagService, SourceManagementService } from '@ragyt/api-client';
import { SyncedYoutubeVideo, TranscriptBatch, TranscriptDetail, TranscriptTiming, TranscriptVersion, YoutubeTranscriptService } from '@ragyt/api-client/youtube-transcript';

import {
  HlmBadgeDirective,
  HlmButtonDirective,
  HlmCardDescriptionDirective,
  HlmCardDirective,
  HlmCardTitleDirective,
  HlmInputDirective,
  HlmTooltipDirective,
} from '@ragyt/ui';

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
  videoUrl?: string;
  startSeconds?: number;
};

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [
    CommonModule,
    TranscriptChunkManagerComponent,
    FormsModule,
    HlmButtonDirective,
    HlmInputDirective,
  HlmTooltipDirective,
    HlmCardDirective,
    HlmCardTitleDirective,
    HlmCardDescriptionDirective,
    HlmBadgeDirective,
  ],
  template: `
    <div class="h-full overflow-y-auto bg-slate-50 dark:bg-slate-950">
      <main class="mx-auto grid max-w-7xl gap-5 px-4 py-6 sm:px-6 sm:py-8">
        <header class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 class="text-3xl font-semibold tracking-tight">RAG Source Console</h1>
            <p hlmCardDescription>Manage YouTube/PDF data sources and test retrieval filters.</p>
          </div>
          <div class="flex flex-wrap items-end gap-2">
            <span hlmBadge variant="secondary">{{ userRole() }}</span>
            <button hlmBtn variant="secondary" size="sm" type="button" (click)="goToUserRag()">RAG Query</button>
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
          <h2 hlmCardTitle>YouTube Sources</h2>
          @if (isAdmin()) {
            <div class="grid gap-3 sm:grid-cols-2">
              <input hlmInput [ngModel]="ytName()" (ngModelChange)="ytName.set($event)" aria-label="Source Name" placeholder="Source Name" />
              <input hlmInput [ngModel]="ytChannelId()" (ngModelChange)="ytChannelId.set($event)" aria-label="Channel ID" placeholder="Channel ID" />
              <input hlmInput [ngModel]="ytChannelName()" (ngModelChange)="ytChannelName.set($event)" aria-label="Channel Name" placeholder="Channel Name" />
              <input hlmInput [ngModel]="ytUrl()" (ngModelChange)="ytUrl.set($event)" aria-label="YouTube URL or channel URL" placeholder="YouTube URL or channel URL" />
            </div>
            <button hlmBtn class="justify-self-start" type="button" variant="default" size="sm" (click)="createYoutubeSource()" [disabled]="isSubmitting()">Add YouTube Source</button>
          }

          @if (isLoading()) {
            <p>Loading...</p>
          } @else {
            <div class="grid list-none gap-3">
              @for (source of youtubeSources(); track source.id) {
                <article hlmCard class="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <strong>{{ source.name }}</strong>
                    <p>{{ source.channelName || source.channelId || 'YouTube source' }}</p>
                    <p class="break-all text-sm text-slate-600 dark:text-slate-400">{{ source.url }}</p>
                  </div>
                  @if (isAdmin()) {
                    <div class="flex flex-wrap items-end gap-2">
                      <button hlmBtn type="button" variant="destructive" size="sm" [disabled]="isSubmitting()" (click)="deleteYoutubeSource(source.id)">Delete</button>
                      <button hlmBtn type="button" variant="secondary" size="sm" [disabled]="isSubmitting()" hlmTooltip="重新向 YouTube 取得影片資訊；若來源是頻道則更新頻道影片清單。會替換此來源的影片清單與中繼資料，保留已儲存逐字稿，不會啟動轉錄。" aria-describedby="重新向 YouTube 取得影片資訊；若來源是頻道則更新頻道影片清單。會替換此來源的影片清單與中繼資料，保留已儲存逐字稿，不會啟動轉錄。" (click)="syncYoutubeSource(source.id)">Sync Video</button>
                      @if (source.channelId) {
                        <button hlmBtn type="button" variant="secondary" size="sm" [disabled]="isSubmitting()"
                          hlmTooltip="重新向 YouTube 取得頻道影片清單。會替換此來源的影片清單與中繼資料，保留已儲存逐字稿，不會啟動轉錄。" aria-describedby="重新向 YouTube 取得頻道影片清單。會替換此來源的影片清單與中繼資料，保留已儲存逐字稿，不會啟動轉錄。" (click)="syncYoutubeSource(source.id, 'channel')">Sync Channel</button>
                      }
                      <button hlmBtn variant="default" size="sm" type="button" [disabled]="isSubmitting()" hlmTooltip="開啟已儲存影片與逐字稿；背景補查缺少的原始分類與長度並保存，不重建清單或啟動轉錄。" aria-describedby="開啟已儲存影片與逐字稿；背景補查缺少的原始分類與長度並保存，不重建清單或啟動轉錄。" (click)="openVideos(source.id)">View videos</button>
                    </div>
                  }
                </article>
              } @empty {
                <p>No YouTube sources available.</p>
              }
            </div>
          }
        </section>

        @for (sourceId of transcriptSourceId() ? [transcriptSourceId()!] : []; track sourceId) {
          <section hlmCard class="grid gap-4 p-5 sm:p-6">
            <div class="flex items-center justify-between gap-3">
              <h2 hlmCardTitle>Synced videos · {{ transcriptSourceName() }}</h2>
              <button hlmBtn type="button" variant="outline" size="sm" aria-controls="synced-videos-content"
                [attr.aria-expanded]="!videosCollapsed()" (click)="videosCollapsed.set(!videosCollapsed())">
                <svg aria-hidden="true" class="mr-2 h-4 w-4 transition-transform" [class.rotate-180]="videosCollapsed()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 15 6-6 6 6" /></svg>
                {{ videosCollapsed() ? '展開影片清單' : '收合影片清單' }}
              </button>
            </div>
            <div id="synced-videos-content" [hidden]="videosCollapsed()">
            <div class="grid gap-4">
            <div role="tablist" aria-label="影片清單" class="flex flex-wrap gap-2 border-b border-slate-200 pb-3 dark:border-slate-700">
              <button hlmBtn type="button" role="tab" id="videos-tab-all" aria-controls="videos-panel-all"
                [variant]="videoTab() === 'all' ? 'default' : 'outline'" [attr.aria-selected]="videoTab() === 'all'"
                [attr.tabindex]="videoTab() === 'all' ? 0 : -1" (click)="selectVideoTab('all')" (keydown)="onVideoTabKeydown($event)">
                全部影片（{{ syncedVideos().length }}）
              </button>
              <button hlmBtn type="button" role="tab" id="videos-tab-saved" aria-controls="videos-panel-saved"
                [variant]="videoTab() === 'saved' ? 'default' : 'outline'" [attr.aria-selected]="videoTab() === 'saved'"
                [attr.tabindex]="videoTab() === 'saved' ? 0 : -1" (click)="selectVideoTab('saved')" (keydown)="onVideoTabKeydown($event)">
                已有逐字稿（{{ savedVideos().length }}）
              </button>
              <button hlmBtn type="button" role="tab" id="videos-tab-missing" aria-controls="videos-panel-missing"
                [variant]="videoTab() === 'missing' ? 'default' : 'outline'" [attr.aria-selected]="videoTab() === 'missing'"
                [attr.tabindex]="videoTab() === 'missing' ? 0 : -1" (click)="selectVideoTab('missing')" (keydown)="onVideoTabKeydown($event)">
                沒有逐字稿（{{ transcriptVersionsStatus() === 'ready' ? missingVideos().length : '…' }}）
              </button>
            </div>
            <div role="tabpanel" [id]="'videos-panel-' + videoTab()" [attr.aria-labelledby]="'videos-tab-' + videoTab()" tabindex="0" class="grid gap-4">
            <div class="flex flex-wrap items-end gap-2">
              <label class="grid gap-1 text-sm font-medium">
                Spoken language
                <select hlmInput #spokenLanguage [disabled]="isSubmitting() || !syncedVideos().length">
                  <option value="">Detect automatically</option>
                  <option value="ja">Japanese</option>
                  <option value="zh">Chinese</option>
                  <option value="en">English</option>
                </select>
              </label>
              <label class="grid gap-1 text-sm font-medium">
                影片存取
                <select hlmInput [ngModel]="availabilityFilter()" (ngModelChange)="availabilityFilter.set($event)">
                  <option value="all">全部</option>
                  @for (availability of availabilityOptions(); track availability) {
                    <option [value]="availability">{{ availabilityLabel(availability) }}</option>
                  }
                  <option value="__missing__">未提供（availability 缺失）</option>
                </select>
              </label>
              <button hlmBtn variant="default" size="sm" type="button" [disabled]="isSubmitting() || batchProgress()?.active || !transcribableVideos().length"
                (click)="transcribeAll(sourceId, spokenLanguage.value)">Transcripts</button>
              <button hlmBtn variant="outline" size="sm" type="button" [disabled]="isSubmitting() || !syncedVideos().length"
                (click)="loadVersions(sourceId)">View saved transcripts</button>
              <button hlmBtn variant="outline" size="sm" type="button"
                [disabled]="isSubmitting() || batchProgress()?.active"
                (click)="rebuildSearchChunks(sourceId)">重建搜尋片段</button>
              <button hlmBtn variant="destructive" size="sm" type="button"
                [disabled]="isStoppingBatch() || !batchProgress()?.active || batchProgress()?.stopRequested"
                (click)="requestStopTranscription(sourceId)">
                {{ isStoppingBatch() || (batchProgress()?.stopRequested && batchProgress()?.active) ? '停止中…' : '停止語音辨識' }}
              </button>
            </div>
            @if (syncedVideos().length) {
              <p class="text-sm text-slate-600 dark:text-slate-400">【{{ videoTab() === 'all' ? '全部影片' : videoTab() === 'saved' ? '已有逐字稿' : '沒有逐字稿' }}】Transcripts 處理目前清單中的 {{ transcribableVideos().length }} 支影片，略過已知受限的影片。</p>
            }
            @if (metadataPending() > 0) {
              <p role="status" class="text-sm text-indigo-700 dark:text-indigo-300">正在背景補查 {{ metadataPending() }} 支影片的原始分類與長度，完成後會自動更新；不會轉錄影片。</p>
            }
            @if (metadataError()) {
              <p role="status" class="text-sm text-amber-700 dark:text-amber-300">{{ metadataError() }}</p>
            }
            @if (batchConnectionLost()) {
              <p role="status" class="text-sm text-amber-700 dark:text-amber-300">暫時無法讀取批次進度，正在重試。</p>
            }
            @if (batchSummaryVisible() || batchProgress()?.active ? batchProgress() : null; as progress) {
              <div class="grid gap-2 text-sm">
                <p aria-live="polite">已處理 {{ batchCounts().processed }} / {{ progress.total }} 支影片</p>
                <progress class="block h-3 w-full accent-indigo-600 dark:accent-indigo-400" aria-label="逐字稿批次處理進度"
                  [value]="batchCounts().processed" [max]="progress.total"></progress>
                @if (progress.stopRequested || batchCounts().cancelled > 0) {
                  <p role="status" class="text-amber-700 dark:text-amber-300">
                    {{ progress.active ? '正在停止批次' : '批次已停止' }}，{{ batchCounts().cancelled }} 支影片已停止，未計入已處理數量。
                  </p>
                }
                <p>{{ progress.active ? '目前已耗時' : progress.stopRequested ? '停止前耗時' : '整批耗時' }} {{ formatDuration(progress.elapsedSeconds) }}</p>
                @if (progress.active && !progress.stopRequested) {
                  <p class="text-slate-600 dark:text-slate-400">可以離開此頁，API 會在背景繼續處理。</p>
                }
                @for (video of runningVideos(); track video.videoId) {
                  <p class="text-slate-600 dark:text-slate-400">{{ video.title }} · {{ stageLabels[video.stage] ?? '處理中' }}</p>
                  <progress class="block h-2 w-full accent-indigo-600 dark:accent-indigo-400"
                    [attr.aria-label]="video.title + '處理中'"></progress>
                }
              </div>
            }
            <ol class="grid list-none gap-3">
              @for (video of visibleVideos(); track video.videoId) {
                <li hlmCard class="grid min-w-0 gap-2 break-words p-4">
                  <a hlmBtn variant="link" size="sm" hlmClass="h-auto justify-start whitespace-normal p-0 text-left break-all" [href]="video.url" target="_blank" rel="noopener noreferrer">{{ video.title }}</a>
                  <span hlmBadge variant="secondary">{{ availabilityLabel(video.availability) }}</span>
                  @let latest = versionsByVideo()[video.videoId]?.[0];
                  @let timingStatus = transcriptVersionsStatus() === 'loading' ? '讀取中'
                    : transcriptVersionsStatus() === 'error' ? '讀取失敗'
                    : latest ? '無紀錄' : '尚未轉錄';
                  <dl class="grid grid-cols-2 gap-3 text-sm tabular-nums text-slate-700 sm:grid-cols-3 xl:grid-cols-5 dark:text-slate-300">
                    <div><dt>影片長度</dt><dd>{{ formatDuration(video.durationSeconds) }}</dd></div>
                    <div><dt>處理總耗時</dt><dd>{{ formatDuration(latest?.processingSeconds, timingStatus) }}</dd></div>
                    <div><dt>下載音訊</dt><dd>{{ formatDuration(latest?.downloadSeconds, timingStatus) }}</dd></div>
                    <div><dt>載入模型與語音辨識</dt><dd>{{ formatDuration(latest?.transcriptionSeconds, timingStatus) }}</dd></div>
                    <div><dt>繁中翻譯或轉換</dt><dd>{{ formatDuration(latest?.translationSeconds, timingStatus) }}</dd></div>
                  </dl>
                  @if (video.metadataStatus === 'failed' || video.metadataStatus === 'unavailable' || (metadataError() && (!video.availability || video.durationSeconds == null))) {
                    <button hlmBtn class="justify-self-start" variant="outline" size="sm" type="button" [disabled]="isSubmitting()"
                      (click)="checkVideoAccess(sourceId, video.videoId)">重試補查影片資訊</button>
                  }
                  @if (videoProgress()[video.videoId]; as state) {
                    <p class="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                      @if (videoStatusIcons()[video.videoId]; as icon) {
                        <svg aria-hidden="true" class="h-4 w-4 shrink-0" [ngClass]="icon.className" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <path [attr.d]="icon.path" />
                        </svg>
                      }
                      <span>{{ state }}</span>
                    </p>
                  }
                  @for (version of versionsByVideo()[video.videoId]; track version.id) {
                    <div class="flex flex-wrap items-center gap-2">
                      <button hlmBtn variant="default" size="sm" type="button" (click)="showTranscript(sourceId, version.id)">
                        Version #{{ version.id }} · {{ version.language }} · {{ version.segmentCount }} segments
                        @if (version.processingSeconds != null) {
                          · {{ formatDuration(version.processingSeconds) }}
                        }
                      </button>
                      <button hlmBtn variant="outline" size="sm" type="button"
                        [attr.aria-label]="'管理 Version #' + version.id + ' 的 RAG 切塊'"
                        (click)="chunkManager.open(sourceId, version.id)">管理 RAG 切塊</button>
                    </div>
                  }
                </li>
              } @empty {
                <li>{{ videoTab() !== 'all' ? (transcriptVersionsStatus() === 'loading' ? '正在讀取已儲存的逐字稿…' : transcriptVersionsStatus() === 'error' ? '逐字稿讀取失敗，請按 View saved transcripts 重試。' : videoTab() === 'saved' ? '目前沒有符合條件且已有逐字稿的影片' : '目前沒有符合條件且沒有逐字稿的影片') : syncedVideos().length ? '此篩選條件沒有影片' : 'Use Sync Video to load videos from this source.' }}</li>
              }
            </ol>
            </div>
            </div>
            </div>
          </section>
        }

        <section hlmCard class="grid gap-4 p-5 sm:p-6">
          <h2 hlmCardTitle>PDF OCR Sources</h2>
          @if (isAdmin()) {
            <div class="grid gap-3 sm:grid-cols-2">
              <input hlmInput [ngModel]="pdfName()" (ngModelChange)="pdfName.set($event)" aria-label="PDF Source Name" placeholder="PDF Source Name" />
              <input hlmInput [ngModel]="pdfDescription()" (ngModelChange)="pdfDescription.set($event)" aria-label="Description" placeholder="Description" />
              <input hlmInput type="file" aria-label="PDF file" accept="application/pdf" (change)="onPdfFileSelected($event)" />
            </div>
            <button hlmBtn class="justify-self-start" type="button" variant="default" size="sm" (click)="uploadPdf()" [disabled]="isSubmitting()">上傳 PDF 並建立 RAG 切塊</button>
          }

          <div class="grid list-none gap-3">
            @for (source of pdfSources(); track source.id) {
              <article hlmCard class="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <strong>{{ source.name }}</strong>
                  <p class="break-all text-sm text-slate-600 dark:text-slate-400">{{ source.url }}</p>
                </div>
                @if (isAdmin()) {
                  <div class="flex flex-wrap gap-2"><button hlmBtn type="button" variant="outline" size="sm" (click)="openPdfChunks(source.id)">查看 RAG 切塊</button><button hlmBtn type="button" variant="destructive" size="sm" (click)="deletePdfSource(source.id)">Delete</button></div>
                }
              </article>
            } @empty {
              <p>No PDF sources available.</p>
            }
          </div>
        </section>

        <section hlmCard class="grid gap-4 p-5 sm:p-6">
          <h2 hlmCardTitle>RAG Search (with source filter)</h2>
          <div class="grid gap-3 sm:grid-cols-3">
            <input hlmInput [ngModel]="searchQuery()" (ngModelChange)="searchQuery.set($event)" aria-label="Enter query" placeholder="Enter query" />
            <select hlmInput aria-label="Search source type" [ngModel]="searchSourceType()" (ngModelChange)="searchSourceType.set($event)">
              <option value="">All Source Types</option>
              <option value="1">YouTube</option>
              <option value="2">PDF</option>
            </select>
            <input hlmInput [ngModel]="searchSourceId()" (ngModelChange)="searchSourceId.set($event)" aria-label="Source ID (optional)" placeholder="Source ID (optional)" />
          </div>
          <button hlmBtn class="justify-self-start" type="button" variant="default" size="sm" (click)="searchRag()" [disabled]="isSubmitting()">Search</button>

          <div class="grid gap-3">
            @for (item of ragResults(); track item.id) {
              <article hlmCard class="grid min-w-0 gap-2 break-words p-4">
                <p class="text-xs text-slate-600 dark:text-slate-400">{{ item.sourceType === 1 ? 'YouTube' : 'PDF' }} #{{ item.sourceId }} | {{ item.sourceName }} | score {{ item.score }}</p>
                <p class="whitespace-pre-line">{{ item.snippet }}</p>
                  @if (item.videoUrl && item.startSeconds != null) {
                    <a hlmBtn variant="link" size="sm" hlmClass="h-auto justify-start whitespace-normal p-0 text-left break-all" [href]="item.videoUrl"
                      target="_blank" rel="noopener noreferrer">Watch at {{ item.startSeconds | number:'1.0-2' }}s</a>
                  }
              </article>
            } @empty {
              <p class="text-sm text-slate-600 dark:text-slate-400">No result yet. Run a query above.</p>
            }
          </div>
        </section>
        <dialog #pdfChunksDialog aria-labelledby="pdf-chunks-title" class="w-[min(95vw,64rem)] max-h-[85vh] overflow-auto rounded-lg bg-white p-6 text-slate-900 backdrop:bg-black/50 dark:bg-slate-900 dark:text-slate-100">
          <div class="flex items-center justify-between gap-3">
            <h2 id="pdf-chunks-title" class="text-lg font-semibold">PDF RAG 切塊 · 來源 #{{ pdfChunkSourceId() }}</h2>
            <button hlmBtn type="button" variant="outline" size="sm" (click)="pdfChunksDialog.close()">關閉</button>
          </div>
          <p class="my-3 text-sm">PdfPig 擷取頁面文字；本專案逐頁切塊，每塊最多 900 字元、重疊約 120 字元，優先在句尾或空白切開。點選切塊可在下方原文查看標示範圍。僅支援內嵌文字。</p>
          <button hlmBtn type="button" variant="outline" size="sm" [disabled]="pdfChunksBusy()" (click)="rebuildPdfChunks()">從原始 PDF 重建切塊</button>
          @if (pdfChunksError()) { <p role="alert" class="my-3 text-red-600 dark:text-red-400">{{ pdfChunksError() }}</p> }
          @if (pdfChunksBusy()) { <p role="status">處理中…</p> }
          <p class="my-3">共 {{ pdfChunks().length }} 個切塊</p>
          <ol class="grid gap-3">
            @for (chunk of pdfChunks(); track chunk.id) {
              <li class="rounded border border-slate-300 p-3 dark:border-slate-700">
                <button hlmBtn type="button" variant="outline" size="sm" [attr.aria-pressed]="selectedPdfChunk() === chunk.id" (click)="selectedPdfChunk.set(chunk.id)">Chunk #{{ chunk.id }} · 第 {{ pdfChunkPage(chunk.metadataJson) }} 頁 · 原文定位</button><p class="mt-1 break-all text-xs text-slate-500">{{ chunk.metadataJson }}</p>
                <p class="mt-2 whitespace-pre-wrap break-words text-sm">{{ chunk.content }}</p>
              </li>
            } @empty { @if (!pdfChunksBusy()) { <li>尚無文字切塊；請上傳含內嵌文字的 PDF 或重建切塊。</li> } }
          </ol>
          <h3 class="mt-5 font-semibold">頁面原文與切塊範圍對照</h3>
          @for (page of pdfPages(); track page.id) {
            @let highlight = pdfHighlight(page.id, page.text);
            <details class="mt-3 rounded border border-slate-300 p-3 dark:border-slate-700" [open]="!!highlight.selected">
              <summary>第 {{ page.pageNumber }} 頁 · {{ page.text.length }} 字元</summary>
              <pre class="mt-3 whitespace-pre-wrap break-words font-sans text-sm">{{ highlight.before }}<mark class="bg-amber-200 text-slate-900">{{ highlight.selected }}</mark>{{ highlight.after }}</pre>
            </details>
          } @empty { <p class="text-sm">尚無頁面原文；舊 PDF 請重建切塊以建立頁面關聯。</p> }
        </dialog>
        <dialog #stopDialog role="alertdialog" aria-labelledby="stop-dialog-title" aria-describedby="stop-dialog-description"
          (close)="stopTarget.set(null)"
          class="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border border-slate-200 bg-white p-6 text-slate-900 shadow-xl backdrop:bg-black/50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
          <h2 id="stop-dialog-title" class="text-lg font-semibold">確定停止語音辨識？</h2>
          <p id="stop-dialog-description" class="mt-3 text-sm leading-relaxed">
            將停止此來源目前進行中的下載、語音辨識或翻譯，並取消尚在排隊的影片。已儲存的逐字稿會保留；之後可重新建立批次處理未完成的影片。
          </p>
          <div class="mt-6 flex justify-end gap-2">
            <button hlmBtn variant="outline" type="button" autofocus (click)="stopDialog.close()">繼續辨識</button>
            <button hlmBtn variant="destructive" type="button" (click)="confirmStopTranscription()">確定停止</button>
          </div>
        </dialog>
        <dialog #transcriptDialog aria-labelledby="transcript-dialog-title"
          (close)="onTranscriptDialogClosed()"
          class="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-4xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-0 text-slate-900 shadow-xl backdrop:bg-black/50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
          <header class="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-950">
            <h2 id="transcript-dialog-title" class="text-lg font-semibold">逐字稿 · Version #{{ selectedTranscriptId() }}</h2>
            <button hlmBtn variant="outline" size="sm" type="button" autofocus (click)="transcriptDialog.close()">關閉</button>
          </header>
          <div class="grid gap-5 p-4 sm:p-6" [attr.aria-busy]="transcriptDialogStatus() === 'loading'">
            @if (transcriptDialogStatus() === 'loading') {
              <p role="status">正在讀取逐字稿…</p>
            } @else if (transcriptDialogStatus() === 'error') {
              <p role="alert" class="text-red-700 dark:text-red-300">無法讀取逐字稿，請關閉後重試。</p>
            }
            @if (transcriptDetail(); as detail) {
              <dl class="grid grid-cols-1 gap-3 break-words text-sm sm:grid-cols-2">
                <div><dt>影片 ID</dt><dd>{{ detail.videoId }}</dd></div>
                <div><dt>語言</dt><dd>{{ detail.language }}</dd></div>
                <div><dt>辨識引擎</dt><dd>{{ detail.origin }} · {{ detail.engineVersion }}</dd></div>
                <div><dt>模型</dt><dd>{{ detail.model }}</dd></div>
                <div><dt>建立時間</dt><dd>{{ detail.createdAt | date:'yyyy/MM/dd HH:mm:ss' }}</dd></div>
                <div><dt>片段數量</dt><dd>{{ detail.segments.length }}</dd></div>
                <div><dt>處理總耗時</dt><dd>{{ formatDuration(detail.processingSeconds) }}</dd></div>
                <div><dt>下載音訊</dt><dd>{{ formatDuration(detail.downloadSeconds) }}</dd></div>
                <div><dt>載入模型與語音辨識</dt><dd>{{ formatDuration(detail.transcriptionSeconds) }}</dd></div>
                <div><dt>繁中翻譯或轉換</dt><dd>{{ formatDuration(detail.translationSeconds) }}</dd></div>
              </dl>
              <ol class="grid list-none gap-3">
                @for (segment of detail.segments; track segment.sequence) {
                  <li class="grid gap-1 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                    <p class="text-xs tabular-nums text-slate-500">#{{ segment.sequence }} · {{ segment.startSeconds | number:'1.0-2' }}s – {{ segment.endSeconds | number:'1.0-2' }}s</p>
                    <p class="whitespace-pre-wrap break-words">{{ segment.text }}</p>
                    @if (segment.traditionalChineseText && segment.traditionalChineseText !== segment.text) {
                      <p lang="zh-Hant" class="whitespace-pre-wrap break-words text-indigo-700 dark:text-indigo-300">繁中：{{ segment.traditionalChineseText }}</p>
                    }
                  </li>
                } @empty {
                  <li>此版本沒有逐字稿片段。</li>
                }
              </ol>
            }
          </div>
        </dialog>
        <app-transcript-chunk-manager #chunkManager (changed)="onChunkDataChanged($event)" />
      </main>
    </div>
  `,
})
export class DashboardPageComponent {
  private readonly router = inject(Router);
  private readonly sourceManagementService = inject(SourceManagementService);
  private readonly ragService = inject(RagService);
  private readonly transcripts = inject(YoutubeTranscriptService);
  private readonly destroyRef = inject(DestroyRef);

  readonly transcriptSourceId = signal<number | null>(null);
  readonly transcriptSourceName = computed(() =>
    this.youtubeSources().find(source => source.id === this.transcriptSourceId())?.name);
  readonly syncedVideos = signal<SyncedYoutubeVideo[]>([]);
  readonly metadataError = signal('');
  private readonly metadataRefresh = signal(0);
  readonly metadataPending = computed(() => this.syncedVideos().filter(video => video.metadataStatus === 'queued' || video.metadataStatus === 'running').length);
  readonly videosCollapsed = signal(false);
  readonly videoTab = signal<'all' | 'saved' | 'missing'>('all');
  readonly savedVideos = computed(() => this.syncedVideos().filter(video => !!this.versionsByVideo()[video.videoId]?.length));
  readonly missingVideos = computed(() => this.transcriptVersionsStatus() === 'ready'
    ? this.syncedVideos().filter(video => !this.versionsByVideo()[video.videoId]?.length) : []);
  readonly availabilityFilter = signal('all');
  readonly availabilityLabels: Partial<Record<string, string>> = {
    public: '公開',
    unlisted: '不公開連結',
    subscriber_only: '訂閱者／會員限定',
    private: '私人',
    premium_only: 'Premium 限定',
    needs_auth: '需要登入',
  };
  readonly availabilityOptions = computed(() => [...new Set([
    ...Object.keys(this.availabilityLabels),
    ...this.syncedVideos().map(video => video.availability).filter((value): value is string => !!value),
  ])]);
  availabilityLabel(value?: string | null): string {
    if (!value) return '未提供（availability 缺失）';
    const label = this.availabilityLabels[value];
    return label ? `${label}（${value}）` : value;
  }
  readonly visibleVideos = computed(() => {
    const filter = this.availabilityFilter();
    const videos = this.videoTab() === 'saved' ? this.savedVideos()
      : this.videoTab() === 'missing' ? this.missingVideos() : this.syncedVideos();
    return videos.filter(video => filter === 'all' ||
      (filter === '__missing__' ? !video.availability : video.availability === filter));
  });
  readonly transcribableVideos = computed(() =>
    this.visibleVideos().filter(video => !['subscriber_only', 'private', 'premium_only', 'needs_auth'].includes(video.availability ?? '')));
  readonly stageLabels: Partial<Record<string, string>> = {
    checking: '檢查既有逐字稿', download: '下載音訊', model: '載入 Whisper',
    transcription: '語音辨識', translation: '繁中翻譯或轉換', saving: '寫入資料庫', stopping: '正在停止',
  };
  readonly batchProgress = signal<TranscriptBatch | null>(null);
  readonly batchSummaryVisible = signal(true);
  readonly batchCounts = computed(() => {
    const videos = this.batchProgress()?.videos ?? [];
    return {
      processed: videos.filter(video => ['saved', 'reused', 'failed'].includes(video.state)).length,
      cancelled: videos.filter(video => video.state === 'cancelled').length,
    };
  });
  readonly batchConnectionLost = signal(false);
  private readonly batchRefresh = signal(0);
  readonly runningVideos = computed(() => {
    const titles = new Map(this.syncedVideos().map(video => [video.videoId, video.title]));
    return (this.batchProgress()?.videos ?? []).filter(video => video.state === 'running')
      .map(video => ({ ...video, title: titles.get(video.videoId) ?? video.videoId }));
  });
  readonly videoStatusIcons = computed(() => {
    const icons = {
      queued: { path: 'M12 8v4l3 2 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0', className: 'text-slate-500 dark:text-slate-400' },
      running: { path: 'M12 2a10 10 0 1 1-10 10', className: 'animate-spin text-indigo-600 dark:text-indigo-400' },
      saved: { path: 'm8 12 3 3 5-6 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0', className: 'text-emerald-600 dark:text-emerald-400' },
      reused: { path: 'M20 7v5h-5 M4 17v-5h5 M6 7a7 7 0 0 1 12-1l2 6 M4 12l2 6a7 7 0 0 0 12-1', className: 'text-sky-600 dark:text-sky-400' },
      failed: { path: 'm9 9 6 6 m0-6-6 6 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0', className: 'text-red-600 dark:text-red-400' },
      cancelled: { path: 'M9 9h6v6H9z M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0', className: 'text-amber-600 dark:text-amber-400' },
    };
    return Object.fromEntries((this.batchProgress()?.videos ?? []).map(video => [video.videoId, icons[video.state]]));
  });
  readonly videoProgress = computed(() => Object.fromEntries((this.batchProgress()?.videos ?? []).map(video => {
    const status = {
      queued: '排隊中',
      cancelled: '已停止',
      running: this.stageLabels[video.stage] ?? '處理中',
      saved: `已儲存逐字稿 #${video.transcriptId}`,
      reused: `沿用逐字稿 #${video.transcriptId}`,
      failed: video.message ?? '處理失敗',
    };
    return [video.videoId, status[video.state]];
  })));
  readonly selectedTranscriptTiming = signal<TranscriptTiming | null>(null);

  formatDuration(seconds?: number | null, missing = '無紀錄'): string {
    if (seconds == null) return missing;
    const minutes = Math.floor(seconds / 60);
    const remainder = (seconds - minutes * 60).toFixed(1);
    return minutes ? `${minutes} 分 ${remainder} 秒` : `${remainder} 秒`;
  }
  readonly transcriptVersionsStatus = signal<'loading' | 'ready' | 'error'>('loading');
  readonly versionsByVideo = signal<Partial<Record<string, TranscriptVersion[]>>>({});
  readonly selectedTranscriptId = signal<number | null>(null);
  readonly transcriptSegments = signal<{ sequence: number; startSeconds: number; endSeconds: number; text: string; traditionalChineseText?: string }[]>([]);

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
    effect(onCleanup => {
      const sourceId = this.transcriptSourceId();
      this.metadataRefresh();
      if (sourceId === null) return;
      const polling = timer(1000, 5000).pipe(
        exhaustMap(() => this.transcripts.videos(sourceId).pipe(
          catchError(() => { this.metadataError.set('暫時無法刷新影片資訊，正在重試。'); return EMPTY; }),
        )),
        takeWhile(videos => videos.some(video => video.metadataStatus === 'queued' || video.metadataStatus === 'running'), true),
      ).subscribe(videos => {
        if (this.transcriptSourceId() !== sourceId) return;
        this.metadataError.set('');
        this.syncedVideos.set(videos);
      });
      onCleanup(() => polling.unsubscribe());
    });

    effect(onCleanup => {
      const sourceId = this.transcriptSourceId();
      this.batchRefresh();
      if (sourceId === null) return;

      const progress = timer(0, 2000).pipe(
        exhaustMap(() => this.transcripts.batch(sourceId).pipe(
          catchError((error: unknown) => {
            if (error instanceof ApiError && [401, 403, 404].includes(error.status)) {
              return throwError(() => error);
            }
            this.batchConnectionLost.set(true);
            return EMPTY;
          }),
        )),
        takeWhile(batch => !!batch?.active, true),
      ).subscribe({
        next: batch => {
          this.batchConnectionLost.set(false);
          if (!batch && this.batchProgress()?.active) {
            this.errorMessage.set('找不到原本的背景批次。已儲存的逐字稿可繼續使用。');
          }
          this.batchProgress.set(batch);
          const hasNewVersion = batch?.videos.some(video =>
            (video.state === 'saved' || video.state === 'reused') && video.transcriptId != null &&
            !this.versionsByVideo()[video.videoId]?.some(version => version.id === video.transcriptId));
          // Refresh completed videos while the remaining batch continues running.
          if (batch && (hasNewVersion || !batch.active)) this.loadVersions(sourceId);
          if (hasNewVersion) this.reloadVideoMetadata(sourceId);
          if (!batch || batch.active) return;

          const saved = batch.videos.filter(video => video.state === 'saved').length;
          const reused = batch.videos.filter(video => video.state === 'reused').length;
          const cancelled = batch.videos.filter(video => video.state === 'cancelled').length;
          const failed = batch.videos.filter(video => video.state === 'failed').length;
          this.message.set(`新增 ${saved} 支，沿用 ${reused} 支，失敗 ${failed} 支，已停止 ${cancelled} 支。`);
        },
        error: (error: ApiError) => {
          this.batchConnectionLost.set(false);
          this.errorMessage.set(error.status === 404
            ? '目前的 API 找不到背景批次端點。請停止舊後端，再重新建置並啟動 Rag.Api。'
            : '無法讀取背景批次進度。請重新登入管理員帳號。');
        },
      });
      onCleanup(() => progress.unsubscribe());
    });
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

  syncYoutubeSource(id: number, mode: 'video' | 'channel' = 'video'): void {
    this.setBusy(true);
    this.sourceManagementService.postApiSourceManagementYoutubeSync({
      id, requestBody: { mode },
    })
      .pipe(finalize(() => this.setBusy(false)))
      .subscribe({
        next: (result: { videos: SyncedYoutubeVideo[] }) => {
          const videos = result.videos ?? [];
          this.showVideos(id, videos);
          if (videos.length) {
            this.message.set(`Synced ${videos.length} video(s).`);
          } else {
            this.errorMessage.set('No videos were returned. Restart the updated API and check the channel URL.');
          }
        },
        error: (error: unknown) => this.errorMessage.set(this.getApiMessage(error, 'YouTube sync failed.')),
      });
  }

  openVideos(id: number): void {
    this.setBusy(true);
    this.transcripts.videos(id)
      .pipe(finalize(() => this.setBusy(false)))
      .subscribe({
        next: videos => this.showVideos(id, videos),
        error: (error: unknown) => this.errorMessage.set(this.getApiMessage(error, 'Could not load synced videos.')),
      });
  }

  selectVideoTab(tab: 'all' | 'saved' | 'missing'): void {
    if (this.videoTab() === tab) return;
    this.videoTab.set(tab);
    // Clear finished summaries on tab changes; active batches remain visible until they finish.
    this.batchSummaryVisible.set(false);
  }
  onVideoTabKeydown(event: KeyboardEvent): void {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const tabs = ['all', 'saved', 'missing'] as const;
    const index = tabs.indexOf(this.videoTab());
    const next = event.key === 'Home' ? tabs[0] : event.key === 'End' ? tabs[tabs.length - 1]
      : tabs[(index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
    this.selectVideoTab(next);
    const tablist = (event.currentTarget as HTMLElement).parentElement;
    tablist?.querySelector<HTMLButtonElement>(`#videos-tab-${next}`)?.focus();
  }
  private showVideos(id: number, videos: SyncedYoutubeVideo[]): void {
    this.transcriptSourceId.set(id);
    this.videosCollapsed.set(false);
    this.syncedVideos.set(videos);
    this.availabilityFilter.set('all');
    this.videoTab.set('all');
    this.batchProgress.set(null);
    this.batchSummaryVisible.set(true);
    this.batchConnectionLost.set(false);
    this.batchRefresh.update(value => value + 1);
    this.versionsByVideo.set({});
    this.transcriptSegments.set([]);
    this.selectedTranscriptId.set(null);
    this.loadVersions(id);
    this.metadataError.set('');
    this.transcripts.enrichMetadata(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: videos => {
        if (this.transcriptSourceId() !== id) return;
        this.syncedVideos.set(videos);
        this.metadataRefresh.update(value => value + 1);
      },
      error: error => {
        if (this.transcriptSourceId() === id) this.metadataError.set(this.getApiMessage(error, '無法啟動背景影片資訊補查，請確認 API 已更新。'));
      },
    });
  }

  private reloadVideoMetadata(sourceId: number): void {
    this.transcripts.videos(sourceId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: videos => { if (this.transcriptSourceId() === sourceId) this.syncedVideos.set(videos); },
      error: () => {},
    });
  }

  rebuildSearchChunks(id: number): void {
    this.setBusy(true);
    this.transcripts.rebuildSearchChunks(id)
      .pipe(finalize(() => this.setBusy(false)))
      .subscribe({
        next: result => this.message.set(`已重切 ${result.rebuilt} 支影片，建立 ${result.chunks} 個搜尋片段。`),
        error: (error: unknown) => this.errorMessage.set(this.getApiMessage(error, '無法重建搜尋片段。')),
      });
  }

  private versionsRequest = 0;

  loadVersions(id: number): void {
    const request = ++this.versionsRequest;
    this.transcriptVersionsStatus.set('loading');
    this.transcripts.list(id).subscribe({
      next: versions => {
        if (this.transcriptSourceId() !== id || request !== this.versionsRequest) return;
        const grouped: Record<string, TranscriptVersion[]> = {};
        for (const version of versions) {
          (grouped[version.videoId] ??= []).push(version);
        }
        this.versionsByVideo.set(grouped);
        this.transcriptVersionsStatus.set('ready');
      },
      error: (error: unknown) => {
        if (this.transcriptSourceId() !== id || request !== this.versionsRequest) return;
        this.transcriptVersionsStatus.set('error');
        this.errorMessage.set(this.getApiMessage(error, '無法讀取逐字稿耗時。請確認 API 已連到正確的資料庫並完成遷移。'));
      },
    });
  }

  private getApiMessage(error: unknown, fallback: string): string {
    if (!(error instanceof ApiError)) return fallback;

    const body = error.body;
    const detail = body?.error;
    if (typeof detail === 'string' && detail.includes('404 (Not Found)')) {
      return 'The YouTube lookup returned 404. Check the saved URL and restart the API to load the updated sync code.';
    }

    if (body?.message) return body.message;
    if (error.status === 404) {
      return 'The API could not find this YouTube source or endpoint. Refresh the source list and check that the updated API is running.';
    }

    return detail ?? body?.title ?? fallback;
  }

  @ViewChild('transcriptDialog') private transcriptDialog!: ElementRef<HTMLDialogElement>;
  readonly transcriptDetail = signal<TranscriptDetail | null>(null);
  readonly transcriptDialogStatus = signal<'loading' | 'ready' | 'error'>('loading');
  private transcriptRequest = 0;

  onTranscriptDialogClosed(): void {
    this.transcriptRequest++;
    this.selectedTranscriptId.set(null);
    this.transcriptDetail.set(null);
  }

  showTranscript(sourceId: number, transcriptId: number): void {
    const request = ++this.transcriptRequest;
    this.transcriptDetail.set(null);
    this.transcriptDialogStatus.set('loading');
    const dialog = this.transcriptDialog.nativeElement;
    if (!dialog.open) dialog.showModal();
    dialog.scrollTop = 0;
    this.selectedTranscriptId.set(transcriptId);
    this.selectedTranscriptTiming.set(null);
    this.transcriptSegments.set([]);
    this.transcripts.get(sourceId, transcriptId).subscribe({
      next: result => {
        if (request !== this.transcriptRequest) return;
        this.transcriptDetail.set(result);
        this.transcriptDialogStatus.set('ready');
        this.selectedTranscriptTiming.set(result);
        this.transcriptSegments.set(result.segments);
      },
      error: () => {
        if (request === this.transcriptRequest) this.transcriptDialogStatus.set('error');
      },
    });
  }

  checkVideoAccess(sourceId: number, videoId: string): void {
    this.setBusy(true);
    this.transcripts.checkAccess(sourceId, videoId)
      .pipe(finalize(() => this.setBusy(false)))
      .subscribe({
        next: checked => {
          this.syncedVideos.update(videos => videos.map(video => video.videoId === videoId ? checked : video));
          if (!checked.availability) this.message.set('YouTube 未提供足夠資訊確認這支影片的存取狀態。');
        },
        error: (error: unknown) => this.errorMessage.set(this.getApiMessage(error, '無法確認影片存取狀態。')),
      });
  }

  onChunkDataChanged(event: { sourceId: number; deletedTranscriptId?: number }): void {
    this.ragResults.set([]);
    this.message.set('RAG 資料已更新，請重新搜尋以查看結果。');
    if (this.transcriptSourceId() === event.sourceId) this.loadVersions(event.sourceId);
    if (event.deletedTranscriptId === this.selectedTranscriptId()) this.transcriptDialog.nativeElement.close();
  }

  @ViewChild('stopDialog') private stopDialog!: ElementRef<HTMLDialogElement>;
  readonly isStoppingBatch = signal(false);
  readonly stopTarget = signal<{ sourceId: number; batchId: string } | null>(null);

  requestStopTranscription(sourceId: number): void {
    const batch = this.batchProgress();
    if (!batch?.active || batch.stopRequested || this.isStoppingBatch()) return;
    this.stopTarget.set({ sourceId, batchId: batch.id });
    this.stopDialog.nativeElement.showModal();
  }

  confirmStopTranscription(): void {
    const target = this.stopTarget();
    if (!target || this.isStoppingBatch()) return;
    this.isStoppingBatch.set(true);
    this.stopDialog.nativeElement.close();
    this.transcripts.cancelBatch(target.sourceId, target.batchId)
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.isStoppingBatch.set(false)))
      .subscribe({
        next: batch => {
          if (this.transcriptSourceId() !== target.sourceId || this.batchProgress()?.id !== target.batchId) return;
          this.batchProgress.set(batch);
          this.batchRefresh.update(value => value + 1);
          this.loadVersions(target.sourceId);
          this.message.set('批次已停止，已儲存的逐字稿已保留。');
        },
        error: (error: unknown) => {
          this.errorMessage.set(this.getApiMessage(error, '停止失敗，請確認批次進度後重試。'));
          this.batchRefresh.update(value => value + 1);
        },
      });
  }

  transcribeAll(sourceId: number, language: string): void {
    const ids = this.transcribableVideos().map(video => video.videoId);
    if (!ids.length || this.isSubmitting() || this.batchProgress()?.active) return;

    this.setBusy(true);
    this.transcripts.enqueue(sourceId, ids, language)
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.setBusy(false)))
      .subscribe({
        next: batch => {
          this.batchSummaryVisible.set(true);
          this.batchProgress.set(batch);
          this.batchRefresh.update(value => value + 1);
        },
        error: (error: unknown) => this.errorMessage.set(this.getApiMessage(error, '無法建立轉錄批次。')),
      });
  }

  deleteYoutubeSource(id: number): void {
    this.setBusy(true);
    this.sourceManagementService
      .deleteApiSourceManagementYoutube({ id })
      .pipe(finalize(() => this.setBusy(false)))
      .subscribe({
        next: () => {
          if (this.transcriptSourceId() === id) this.transcriptSourceId.set(null);
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

  @ViewChild('pdfChunksDialog') private pdfChunksDialog!: ElementRef<HTMLDialogElement>;
  readonly pdfChunkSourceId = signal<number | null>(null);
  readonly pdfChunks = signal<{ id: number; content: string; metadataJson: string | null; pdfPageId: number | null }[]>([]);
  readonly pdfPages = signal<{ id: number; pageNumber: number; text: string }[]>([]);
  readonly selectedPdfChunk = signal<number | null>(null);
  readonly pdfChunksBusy = signal(false);
  readonly pdfChunksError = signal('');

  pdfHighlight(pageId: number, text: string): { before: string; selected: string; after: string } {
    const chunk = this.pdfChunks().find(item => item.id === this.selectedPdfChunk() && item.pdfPageId === pageId);
    if (!chunk) return { before: text, selected: '', after: '' };
    try {
      const metadata = JSON.parse(chunk.metadataJson ?? '{}');
      const start = Number(metadata.startOffset), end = Number(metadata.endOffset);
      if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end > text.length || end < start) throw new Error();
      return { before: text.slice(0, start), selected: text.slice(start, end), after: text.slice(end) };
    } catch { return { before: text, selected: '', after: '' }; }
  }
  pdfChunkPage(metadata: string | null): string {
    try { return String(JSON.parse(metadata ?? '{}').page ?? '未知'); } catch { return '未知'; }
  }

  openPdfChunks(id: number): void {
    this.pdfChunkSourceId.set(id);
    this.pdfChunks.set([]);
    this.pdfPages.set([]);
    this.selectedPdfChunk.set(null);
    this.pdfChunksError.set('');
    if (!this.pdfChunksDialog.nativeElement.open) this.pdfChunksDialog.nativeElement.showModal();
    this.fetchPdfChunks(id);
  }

  private fetchPdfChunks(id: number): void {
    this.pdfChunksBusy.set(true);
    this.transcripts.pdfChunks(id).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.pdfChunksBusy.set(false))).subscribe({
            next: chunks => {
        if (this.pdfChunkSourceId() !== id) return;
        this.pdfChunks.set(chunks);
        this.transcripts.pdfPages(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
          next: pages => { if (this.pdfChunkSourceId() === id) this.pdfPages.set(pages); },
          error: error => this.pdfChunksError.set(this.getApiMessage(error, '無法讀取頁面原文。')),
        });
      },
      error: error => this.pdfChunksError.set(this.getApiMessage(error, '無法讀取 PDF 切塊。')),
    });
  }

  rebuildPdfChunks(): void {
    const id = this.pdfChunkSourceId();
    if (id === null || this.pdfChunksBusy() || !window.confirm('將從原始 PDF 重新切塊，取代此 PDF 的所有既有 RAG 切塊。原始 PDF 不變。確定繼續？')) return;
    this.pdfChunksBusy.set(true);
    this.pdfChunksError.set('');
    this.transcripts.rebuildPdfChunks(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => { this.ragResults.set([]); this.fetchPdfChunks(id); },
      error: error => { this.pdfChunksBusy.set(false); this.pdfChunksError.set(this.getApiMessage(error, '無法重建 PDF 切塊。')); },
    });
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
          this.message.set(result?.chunkCount ? `PDF 已上傳並建立 ${result.chunkCount} 個 RAG 切塊。` : 'PDF 已保存，但找不到內嵌文字，未建立切塊；掃描圖片需要 OCR 引擎。');
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
