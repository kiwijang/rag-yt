/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type TranscriptDeletionPreview = {
    transcriptId?: number;
    /**
     * 11 字元 YouTube 影片 ID。單支轉錄省略此值時，從來源網址推導。
     */
    videoId?: string | null;
    transcriptCount?: number;
    segmentCount?: number;
    chunkCount?: number;
    remainingVersionCount?: number;
    isBatchActive?: boolean;
    revision?: string | null;
};

