/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { EditableTranscriptChunk } from './EditableTranscriptChunk';
export type TranscriptChunkView = {
    transcriptId?: number;
    /**
     * 11 字元 YouTube 影片 ID。單支轉錄省略此值時，從來源網址推導。
     */
    videoId?: string | null;
    /**
     * 可省略或 null，自動偵測；指定時僅接受 zh（中文）、ja（日文）、en（英文）。
     */
    language?: string | null;
    createdAt?: string;
    segmentCount?: number;
    isLatest?: boolean;
    isBatchActive?: boolean;
    chunks?: Array<EditableTranscriptChunk> | null;
};

