/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ChatMessage } from './ChatMessage';
export type ChatRequest = {
    /**
     * Ollama 已安裝模型名稱，例如 gemma4:12b；可先 GET /api/Chat/models。
     */
    model: string;
    /**
     * 完整對話歷史，1–40 則，文字合計最多 48000 字元。
     */
    messages: Array<ChatMessage>;
};

