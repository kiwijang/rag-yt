/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type ChatMessage = {
    /**
     * 僅 user 或 assistant，最後一則須為 user。
     */
    role: string;
    /**
     * 對話文字，不可空白，每則最多 12000 字元。
     */
    content: string;
};

