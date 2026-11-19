/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type UpdateTranscriptChunkRequest = {
    /**
     * 修改後的 RAG 切塊文字，不可空白，最多 20000 字元。只更新搜尋內容，不改原始逐字稿。
     */
    content?: string | null;
    /**
     * 載入切塊時的原始 content；若資料已被修改，後端回傳 409，避免覆蓋。
     */
    originalContent?: string | null;
};

