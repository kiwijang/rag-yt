/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { Observable } from 'rxjs';
import type { ChatModelsResponse } from '../models/ChatModelsResponse';
import type { ChatRequest } from '../models/ChatRequest';
import type { ChatResponse } from '../models/ChatResponse';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
@Injectable({
    providedIn: 'root',
})
export class ChatService {
    constructor(public readonly http: HttpClient) {}
    /**
     * 列出本機 Ollama 模型
     * ## 用途
     * 供對話頁選擇已安裝的本機模型。
     *
     * ## 用法
     * 登入後 GET /api/Chat/models；回應 models[].name。預設介面選擇 gemma4:12b，缺少時先執行 ollama pull gemma4:12b。
     *
     * ## 資料影響與注意事項
     * 只讀取 Ollama /api/tags；不下載模型、不執行推論、不寫入資料庫。位址由後端 Ollama:BaseUrl 設定，預設 http://localhost:11434。
     *
     * ## 權限
     * 需 JWT 登入。
     * @returns ChatModelsResponse 已安裝的模型
     * @throws ApiError
     */
    public getApiChatModels(): Observable<ChatModelsResponse> {
        return __request(OpenAPI, this.http, {
            method: 'GET',
            url: '/api/Chat/models',
            errors: {
                401: `缺少、無效或過期的 JWT；先登入再 Authorize。`,
                503: `Ollama 無法連線`,
                504: `Ollama 回應逾時`,
            },
        });
    }
    /**
     * 與本機 Ollama 對話
     * ## 用途
     * 傳送歷史訊息並取得一則完整回答；此端點不自動檢索 RAG。
     *
     * ## 用法
     * 先 GET models，選取已安裝模型。body 指定 model 及 messages（role 僅 user/assistant，最後一則須為 user）；最多 40 則，每則最多 12000 字元、合計最多 48000。前端取消請求會將取消訊號傳遞給 Ollama。
     *
     * ## 資料影響與注意事項
     * 使用 Ollama /api/chat、stream=false；等待完整回覆，最長 5 分鐘。keep_alive=0，完成後釋放模型。不寫入資料庫；歷史由前端每次傳送。
     *
     * ## 權限
     * 需 JWT 登入。
     *
     * ## 請求範例（請替換範例中的帳密、網址與 ID）
     * ```json
     * {"model":"gemma4:12b","messages":[{"role":"user","content":"你好，請用繁體中文回答。"}]}
     * ```
     * @returns ChatResponse model 與 content
     * @throws ApiError
     */
    public postApiChat({
        requestBody,
    }: {
        requestBody?: ChatRequest,
    }): Observable<ChatResponse> {
        return __request(OpenAPI, this.http, {
            method: 'POST',
            url: '/api/Chat',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `訊息格式或長度不符`,
                401: `缺少、無效或過期的 JWT；先登入再 Authorize。`,
                404: `模型尚未安裝`,
                503: `Ollama 無法連線或回覆無效`,
                504: `推論逾時`,
            },
        });
    }
}
