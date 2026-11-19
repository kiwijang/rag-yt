/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { Observable } from 'rxjs';
import type { SourceType } from '../models/SourceType';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
@Injectable({
    providedIn: 'root',
})
export class RagService {
    constructor(public readonly http: HttpClient) {}
    /**
     * 查看向量索引進度
     * ## 用途
     * 查看目前 API 的索引工作狀態。
     *
     * ## 用法
     * GET /api/Rag/index/status。以管理員 token 每數秒輪詢。
     *
     * ## 資料影響與注意事項
     * 唯讀；回傳 state、processed、total、updated、error；API 重啟後狀態回到 idle，已寫入的向量仍保留。
     *
     * ## 權限
     * 需 JWT 登入；角色：Admin。
     * @returns any 進度
     * @throws ApiError
     */
    public getApiRagIndexStatus(): Observable<any> {
        return __request(OpenAPI, this.http, {
            method: 'GET',
            url: '/api/Rag/index/status',
            errors: {
                401: `缺少、無效或過期的 JWT；先登入再 Authorize。`,
                403: `已登入但缺少必要角色：Admin。`,
            },
        });
    }
    /**
     * 建立／更新來源或版本的 embedding
     * ## 用途
     * 將最新逐字稿與 PDF 文字以 BGE-M3 向量化，PDF 頁面 PNG 以 Jina CLIP v2 向量化。
     *
     * ## 用法
     * POST /api/Rag/index，不需 body。可用 query sourceType=1&sourceId=3 指定 YouTube 來源，sourceType=2&sourceId=3 指定 PDF，或另加 transcriptId 指定最新逐字稿版本；全省略則處理全部。輪詢 index/status 查看進度。
     *
     * ## 資料影響與注意事項
     * 來源篩選也限制舊向量清理範圍，不影響其他來源。略過未變更資料，不更動 PostgreSQL 原文，不轉錄或重新 OCR。
     *
     * ## 權限
     * 需 JWT 登入；角色：Admin。
     * @returns any OK
     * @throws ApiError
     */
    public postApiRagIndex({
        sourceType,
        sourceId,
        transcriptId,
    }: {
        /**
         * 可省略，1=YouTube、2=PDF。
         */
        sourceType?: number,
        /**
         * 可省略，建議和 sourceType 一起指定。
         */
        sourceId?: number,
        /**
         * 逐字稿版本 ID，必須屬於指定來源。
         */
        transcriptId?: number,
    }): Observable<any> {
        return __request(OpenAPI, this.http, {
            method: 'POST',
            url: '/api/Rag/index',
            query: {
                'sourceType': sourceType,
                'sourceId': sourceId,
                'transcriptId': transcriptId,
            },
            errors: {
                400: `篩選條件無效`,
                401: `缺少、無效或過期的 JWT；先登入再 Authorize。`,
                403: `已登入但缺少必要角色：Admin。`,
                404: `來源或版本不存在`,
                409: `已有工作或指定歷史版本`,
            },
        });
    }
    /**
     * 停止向量索引
     * ## 用途
     * 在推論批次邊界停止目前工作。
     *
     * ## 用法
     * POST /api/Rag/index/cancel，不需 body；輪詢狀態直到 cancelled。
     *
     * ## 資料影響與注意事項
     * 等待目前推論釋放 GPU；保留已成功寫入的向量，下次更新可接續。
     *
     * ## 權限
     * 需 JWT 登入；角色：Admin。
     * @returns any OK
     * @throws ApiError
     */
    public postApiRagIndexCancel(): Observable<any> {
        return __request(OpenAPI, this.http, {
            method: 'POST',
            url: '/api/Rag/index/cancel',
            errors: {
                401: `缺少、無效或過期的 JWT；先登入再 Authorize。`,
                403: `已登入但缺少必要角色：Admin。`,
            },
        });
    }
    /**
     * 讀取搜尋結果的 PDF 頁面圖片
     * ## 用途
     * 為有權登入的搜尋使用者提供目前啟用 PDF 的頁面預覽。
     *
     * ## 用法
     * GET /api/Rag/pdf/{id}/pages/{page}/image；id 是 PdfSources.Id，page 是頁碼。使用回應 imageBase64 建立 PNG data URL。
     *
     * ## 資料影響與注意事項
     * 唯讀；檢查來源、頁面與 MinerU 資產 ID，不接受任意檔案路徑。
     *
     * ## 權限
     * 需 JWT 登入。
     * @returns any 頁碼與 imageBase64
     * @throws ApiError
     */
    public getApiRagPdfPagesImage({
        id,
        page,
    }: {
        /**
         * 來源資料庫整數 ID，例如 3，不是 YouTube videoId。
         */
        id: number,
        page: number,
    }): Observable<any> {
        return __request(OpenAPI, this.http, {
            method: 'GET',
            url: '/api/Rag/pdf/{id}/pages/{page}/image',
            path: {
                'id': id,
                'page': page,
            },
            errors: {
                401: `缺少、無效或過期的 JWT；先登入再 Authorize。`,
                404: `頁面不存在或來源未啟用`,
                409: `尚無預覽或資產缺失`,
            },
        });
    }
    /**
     * BGE-M3 文字與 Jina CLIP v2 圖像搜尋
     * ## 用途
     * 從 Weaviate 檢索文字與 PDF 頁面圖片。BGE-M3 處理多語言文字；Jina CLIP v2 將查詢文字與頁面圖片對應。保留原文，不產生 LLM 回答。
     *
     * ## 用法
     * Query 必填、最多 2000 字；Mode=hybrid（BGE dense＋BM25，預設）、vector（dense）或 keyword（PostgreSQL 子字串）；IncludeImages=true 加入 Jina 圖像搜尋。可搭配 SourceType=1/2、SourceId、Take=1–50。例如 /api/Rag/search?Query=骨盤&Mode=hybrid&IncludeImages=true。
     *
     * ## 資料影響與注意事項
     * 唯讀；只回傳啟用來源、最新逐字稿且內容雜湊仍相符的索引。回應 searchMode、warning、count、items；結果包含 model、matchType、頁碼或影片時間。服務失敗時明示 keyword-fallback。
     *
     * ## 權限
     * 需 JWT 登入。
     * @returns any 搜尋結果；向量服務故障可含 warning
     * @throws ApiError
     */
    public getApiRagSearch({
        mode,
        includeImages,
        query,
        sourceType,
        sourceId,
        take,
    }: {
        /**
         * hybrid（預設）：BGE-M3 dense＋BM25；vector：dense；keyword：PostgreSQL 子字串。
         */
        mode?: string,
        /**
         * 預設 true：加入 Jina CLIP v2 PDF 頁面圖像搜尋。
         */
        includeImages?: boolean,
        /**
         * 必填原文查詢，支援中英日文；Mode 選擇混合、語意或關鍵字搜尋。
         */
        query?: string,
        /**
         * 可省略，1=YouTube、2=PDF。
         */
        sourceType?: SourceType,
        /**
         * 可省略，建議和 sourceType 一起指定。
         */
        sourceId?: number,
        /**
         * 預設 20，實際限制在 1–50。
         */
        take?: number,
    }): Observable<any> {
        return __request(OpenAPI, this.http, {
            method: 'GET',
            url: '/api/Rag/search',
            query: {
                'Mode': mode,
                'IncludeImages': includeImages,
                'Query': query,
                'SourceType': sourceType,
                'SourceId': sourceId,
                'Take': take,
            },
            errors: {
                400: `查詢空白、過長或 mode 無效`,
                401: `缺少、無效或過期的 JWT；先登入再 Authorize。`,
            },
        });
    }
}
