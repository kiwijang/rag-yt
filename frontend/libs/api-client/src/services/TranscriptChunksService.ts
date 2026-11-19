/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { Observable } from 'rxjs';
import type { DeleteTranscriptVersionRequest } from '../models/DeleteTranscriptVersionRequest';
import type { TranscriptChunkView } from '../models/TranscriptChunkView';
import type { TranscriptDeletionPreview } from '../models/TranscriptDeletionPreview';
import type { TranscriptDeletionResult } from '../models/TranscriptDeletionResult';
import type { UpdatedTranscriptChunk } from '../models/UpdatedTranscriptChunk';
import type { UpdateTranscriptChunkRequest } from '../models/UpdateTranscriptChunkRequest';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
@Injectable({
    providedIn: 'root',
})
export class TranscriptChunksService {
    constructor(public readonly http: HttpClient) {}
    /**
     * 依版本 ID 管理 RAG 切塊
     * ## 用途
     * 讀取指定逐字稿版本的搜尋切塊，供編輯彈窗使用。
     *
     * ## 用法
     * id 填 YouTube 來源 ID，transcriptId 填 YoutubeTranscripts.Id。回應 chunks 包含 RagDocumentChunks.Id、content、時間範圍及唯讀 metadataJson。
     *
     * ## 資料影響與注意事項
     * 唯讀，不重新切塊或轉錄。歷史版本可以查看，但預設搜尋使用最新版本。isBatchActive=true 時應先停止此來源批次，再編輯或刪除。
     *
     * ## 權限
     * 需 JWT 登入；角色：Admin。
     * @returns TranscriptChunkView 版本資料與切塊陣列
     * @throws ApiError
     */
    public getApiSourceManagementYoutubeTranscriptsChunks({
        id,
        transcriptId,
    }: {
        /**
         * 來源資料庫整數 ID，例如 3，不是 YouTube videoId。
         */
        id: number,
        /**
         * 逐字稿版本 ID，必須屬於指定來源。
         */
        transcriptId: number,
    }): Observable<TranscriptChunkView> {
        return __request(OpenAPI, this.http, {
            method: 'GET',
            url: '/api/SourceManagement/youtube/{id}/transcripts/{transcriptId}/chunks',
            path: {
                'id': id,
                'transcriptId': transcriptId,
            },
            errors: {
                401: `缺少、無效或過期的 JWT；先登入再 Authorize。`,
                403: `已登入但缺少必要角色：Admin。`,
                404: `版本不屬於指定來源或不存在`,
            },
        });
    }
    /**
     * 儲存 RAG 切塊並更新 BGE-M3 embedding
     * ## 用途
     * 在單一後端操作準備新向量、儲存切塊，成功後清理舊向量。
     *
     * ## 用法
     * 路徑指定來源、版本與 chunkId；body.content 是新文字，originalContent 用於衝突偵測。最多 20000 字元。前端只呼叫這個 PUT，不另發 embedding 請求。
     *
     * ## 資料影響與注意事項
     * 先寫入不可變的新向量版本，PostgreSQL 提交後新版本才通過搜尋雜湊驗證。模型或向量寫入失敗不修改切塊。SQL 失敗留下的暫存向量不參與搜尋，後端定期清理。不修改原始逐字稿。回應 embeddingUpdated、cleanupPending；清理失敗不會冒稱已回滾成功提交的資料。
     *
     * ## 權限
     * 需 JWT 登入；角色：Admin。
     *
     * ## 請求範例（請替換範例中的帳密、網址與 ID）
     * ```json
     * {"content":"修正後的搜尋文字","originalContent":"查詢時取得的原始文字"}
     * ```
     * @returns UpdatedTranscriptChunk 切塊與 embedding 已更新
     * @throws ApiError
     */
    public putApiSourceManagementYoutubeTranscriptsChunks({
        id,
        transcriptId,
        chunkId,
        requestBody,
    }: {
        /**
         * 來源資料庫整數 ID，例如 3，不是 YouTube videoId。
         */
        id: number,
        /**
         * 逐字稿版本 ID，必須屬於指定來源。
         */
        transcriptId: number,
        /**
         * RagDocumentChunks.Id，必須屬於路徑指定的逐字稿版本。
         */
        chunkId: number,
        requestBody?: UpdateTranscriptChunkRequest,
    }): Observable<UpdatedTranscriptChunk> {
        return __request(OpenAPI, this.http, {
            method: 'PUT',
            url: '/api/SourceManagement/youtube/{id}/transcripts/{transcriptId}/chunks/{chunkId}',
            path: {
                'id': id,
                'transcriptId': transcriptId,
                'chunkId': chunkId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `內容或原始文字無效`,
                401: `缺少、無效或過期的 JWT；先登入再 Authorize。`,
                403: `已登入但缺少必要角色：Admin。`,
                404: `來源、版本或切塊關聯不符`,
                409: `內容衝突、轉錄或索引工作進行中`,
                503: `Embedding 或 Weaviate 失敗，切塊未修改`,
            },
        });
    }
    /**
     * 預覽刪除版本的影響範圍
     * ## 用途
     * 確認刪除指定版本會影響哪些資料。
     *
     * ## 用法
     * 指定來源與版本，先 GET deletion-preview，再向使用者列出 transcriptCount、segmentCount、chunkCount 與三張表，要求確認版本 ID。保留回應 revision 供 DELETE 使用。
     *
     * ## 資料影響與注意事項
     * 唯讀，尚未刪除任何資料；revision 是目前版本與切塊快照的指紋，資料變更後需重新取得。remainingVersionCount 是同來源同影片其他版本數量。
     *
     * ## 權限
     * 需 JWT 登入；角色：Admin。
     * @returns TranscriptDeletionPreview 影響筆數與 revision
     * @throws ApiError
     */
    public getApiSourceManagementYoutubeTranscriptsDeletionPreview({
        id,
        transcriptId,
    }: {
        /**
         * 來源資料庫整數 ID，例如 3，不是 YouTube videoId。
         */
        id: number,
        /**
         * 逐字稿版本 ID，必須屬於指定來源。
         */
        transcriptId: number,
    }): Observable<TranscriptDeletionPreview> {
        return __request(OpenAPI, this.http, {
            method: 'GET',
            url: '/api/SourceManagement/youtube/{id}/transcripts/{transcriptId}/deletion-preview',
            path: {
                'id': id,
                'transcriptId': transcriptId,
            },
            errors: {
                401: `缺少、無效或過期的 JWT；先登入再 Authorize。`,
                403: `已登入但缺少必要角色：Admin。`,
                404: `版本不存在或不屬於此來源`,
            },
        });
    }
    /**
     * 刪除已確認的逐字稿版本與 RAG 切塊
     * ## 用途
     * 刪除指定版本及其關聯資料。
     *
     * ## 用法
     * 必須先取得 deletion-preview、向使用者列出影響並確認。DELETE body.confirmationId 必須等於路徑 transcriptId；expectedRevision 必須是剛確認的 revision。
     *
     * ## 資料影響與注意事項
     * 在同一交易刪除 RagDocumentChunks、YoutubeTranscriptSegments、YoutubeTranscripts。保留 YoutubeSources、非逐字稿影片清單及其他版本。資料已改變或批次仍在進行則拒絕。刪除最新版本後搜尋可能改用上一版本；後續轉錄可能重新建立已刪除版本的內容。
     *
     * ## 權限
     * 需 JWT 登入；角色：Admin。
     *
     * ## 請求範例（請替換範例中的帳密、網址與 ID）
     * ```json
     * {"confirmationId":26,"expectedRevision":"<revision from deletion-preview>"}
     * ```
     * @returns TranscriptDeletionResult 實際刪除筆數
     * @throws ApiError
     */
    public deleteApiSourceManagementYoutubeTranscripts({
        id,
        transcriptId,
        requestBody,
    }: {
        /**
         * 來源資料庫整數 ID，例如 3，不是 YouTube videoId。
         */
        id: number,
        /**
         * 逐字稿版本 ID，必須屬於指定來源。
         */
        transcriptId: number,
        requestBody?: DeleteTranscriptVersionRequest,
    }): Observable<TranscriptDeletionResult> {
        return __request(OpenAPI, this.http, {
            method: 'DELETE',
            url: '/api/SourceManagement/youtube/{id}/transcripts/{transcriptId}',
            path: {
                'id': id,
                'transcriptId': transcriptId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `版本 ID 未確認或缺少 revision`,
                401: `缺少、無效或過期的 JWT；先登入再 Authorize。`,
                403: `已登入但缺少必要角色：Admin。`,
                404: `版本不存在或來源不符`,
                409: `資料已變更、筆數不符或批次進行中，需停止或重新確認`,
            },
        });
    }
}
