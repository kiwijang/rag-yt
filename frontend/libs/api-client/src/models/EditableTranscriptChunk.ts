/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type EditableTranscriptChunk = {
    id?: number;
    /**
     * 修改後的 RAG 切塊文字，不可空白，最多 20000 字元。只更新搜尋內容，不改原始逐字稿。
     */
    content?: string | null;
    firstSequence?: number;
    startSeconds?: number;
    endSeconds?: number;
    metadataJson?: string | null;
    embeddingText?: string | null;
};

