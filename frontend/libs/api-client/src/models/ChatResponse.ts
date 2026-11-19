/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type ChatResponse = {
    /**
     * Ollama 已安裝模型名稱，例如 gemma4:12b；可先 GET /api/Chat/models。
     */
    model?: string | null;
    /**
     * Ollama 產生的完整回答，作為純文字顯示。
     */
    content?: string | null;
};

