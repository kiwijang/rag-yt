/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type DeleteTranscriptVersionRequest = {
    /**
     * 使用者確認的 YoutubeTranscripts.Id，必須與路徑 transcriptId 一致。
     */
    confirmationId?: number;
    /**
     * GET deletion-preview 回應的 revision；資料已變更時需重新預覽及確認。
     */
    expectedRevision?: string | null;
};

