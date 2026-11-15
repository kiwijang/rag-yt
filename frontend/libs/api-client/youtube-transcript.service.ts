import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { OpenAPI } from './src/core/OpenAPI';
import { request } from './src/core/request';

export interface SyncedYoutubeVideo {
  videoId: string;
  title: string;
  url: string;
  availability?: string | null;
  metadataStatus?: 'queued' | 'running' | 'complete' | 'unavailable' | 'failed' | null;
  durationSeconds?: number | null;
}

export interface TranscriptBatch {
  id: string;
  finished: number;
  total: number;
  active: boolean;
  stopRequested?: boolean;
  elapsedSeconds: number;
  videos: {
    videoId: string;
    state: 'queued' | 'running' | 'saved' | 'reused' | 'failed' | 'cancelled';
    stage: string;
    transcriptId: number | null;
    message: string | null;
  }[];
}

export interface TranscriptTiming {
  processingSeconds?: number | null;
  downloadSeconds?: number | null;
  transcriptionSeconds?: number | null;
  translationSeconds?: number | null;
}

export interface TranscriptVersion extends TranscriptTiming {
  id: number;
  videoId: string;
  language: string;
  model: string;
  createdAt: string;
  segmentCount: number;
}

export interface TranscriptDetail extends TranscriptTiming {
  id: number;
  videoId: string;
  language: string;
  origin: string;
  model: string;
  engineVersion: string;
  createdAt: string;
  segments: { sequence: number; startSeconds: number; endSeconds: number; text: string; traditionalChineseText?: string }[];
}

export interface EditableTranscriptChunk {
  id: number;
  content: string;
  firstSequence: number;
  startSeconds: number;
  endSeconds: number;
  metadataJson?: string | null;
}
export interface TranscriptChunkView {
  transcriptId: number;
  videoId: string;
  language: string;
  createdAt: string;
  segmentCount: number;
  isLatest: boolean;
  isBatchActive: boolean;
  chunks: EditableTranscriptChunk[];
}
export interface TranscriptDeletionPreview {
  transcriptId: number;
  videoId: string;
  transcriptCount: number;
  segmentCount: number;
  chunkCount: number;
  remainingVersionCount: number;
  isBatchActive: boolean;
  revision: string;
}

@Injectable({ providedIn: 'root' })
export class YoutubeTranscriptService {
  private readonly http = inject(HttpClient);
  private readonly url = '/api/SourceManagement/youtube/{id}/transcripts';

  pdfPages(id: number) {
    return request<{ id: number; pageNumber: number; text: string }[]>(OpenAPI, this.http, {
      method: 'GET', url: '/api/SourceManagement/pdf/{id}/pages', path: { id },
    });
  }
  pdfChunks(id: number) {
    return request<{ id: number; content: string; metadataJson: string | null; pdfPageId: number | null }[]>(OpenAPI, this.http, {
      method: 'GET', url: '/api/SourceManagement/pdf/{id}/chunks', path: { id },
    });
  }

  rebuildPdfChunks(id: number) {
    return request<{ chunkCount: number }>(OpenAPI, this.http, {
      method: 'POST', url: '/api/SourceManagement/pdf/{id}/chunks/rebuild', path: { id },
    });
  }
  videos(id: number) {
    return request<SyncedYoutubeVideo[]>(OpenAPI, this.http, {
      method: 'GET', url: '/api/SourceManagement/youtube/{id}/videos', path: { id },
    });
  }

  enrichMetadata(id: number) {
    return request<SyncedYoutubeVideo[]>(OpenAPI, this.http, {
      method: 'POST', url: '/api/SourceManagement/youtube/{id}/videos/enrich-metadata', path: { id },
    });
  }

  checkAccess(id: number, videoId: string) {
    return request<SyncedYoutubeVideo>(OpenAPI, this.http, {
      method: 'POST', url: '/api/SourceManagement/youtube/{id}/videos/{videoId}/check-access',
      path: { id, videoId },
    });
  }

  transcribe(id: number, videoId: string, language: string) {
    return request<TranscriptTiming & { transcriptId: number; segmentCount: number; language: string; reused?: boolean }>(OpenAPI, this.http, {
      method: 'POST',
      url: this.url,
      path: { id },
      body: { videoId, language: language || undefined },
      mediaType: 'application/json',
    });
  }

  enqueue(id: number, videoIds: string[], language: string) {
    return request<TranscriptBatch>(OpenAPI, this.http, {
      method: 'POST', url: this.url + '/batches', path: { id },
      body: { videoIds, language: language || undefined }, mediaType: 'application/json',
    });
  }

  cancelBatch(id: number, batchId: string) {
    return request<TranscriptBatch>(OpenAPI, this.http, {
      method: 'POST', url: this.url + '/batches/{batchId}/cancel', path: { id, batchId },
    });
  }

  batch(id: number) {
    return request<TranscriptBatch | null>(OpenAPI, this.http, {
      method: 'GET', url: this.url + '/batches/latest', path: { id },
    });
  }

  rebuildSearchChunks(id: number) {
    return request<{ rebuilt: number; chunks: number }>(OpenAPI, this.http, {
      method: 'POST', url: this.url + '/rebuild-search-chunks', path: { id },
    });
  }

  chunks(id: number, transcriptId: number) {
    return request<TranscriptChunkView>(OpenAPI, this.http, {
      method: 'GET', url: this.url + '/{transcriptId}/chunks', path: { id, transcriptId },
    });
  }

  updateChunk(id: number, transcriptId: number, chunkId: number, content: string, originalContent: string) {
    return request<{ id: number; content: string }>(OpenAPI, this.http, {
      method: 'PUT', url: this.url + '/{transcriptId}/chunks/{chunkId}', path: { id, transcriptId, chunkId },
      body: { content, originalContent }, mediaType: 'application/json',
    });
  }

  deletionPreview(id: number, transcriptId: number) {
    return request<TranscriptDeletionPreview>(OpenAPI, this.http, {
      method: 'GET', url: this.url + '/{transcriptId}/deletion-preview', path: { id, transcriptId },
    });
  }

  deleteVersion(id: number, transcriptId: number, expectedRevision: string) {
    return request<{ transcriptId: number; deletedTranscripts: number; deletedSegments: number; deletedChunks: number }>(OpenAPI, this.http, {
      method: 'DELETE', url: this.url + '/{transcriptId}', path: { id, transcriptId },
      body: { confirmationId: transcriptId, expectedRevision }, mediaType: 'application/json',
    });
  }

  list(id: number) {
    return request<TranscriptVersion[]>(OpenAPI, this.http, { method: 'GET', url: this.url, path: { id } });
  }

  get(id: number, transcriptId: number) {
    return request<TranscriptDetail>(
      OpenAPI, this.http, { method: 'GET', url: this.url + '/{transcriptId}', path: { id, transcriptId } });
  }
}
