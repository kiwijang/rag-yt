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
     * @returns any OK
     * @throws ApiError
     */
    public getApiRagSearch({
        query,
        sourceType,
        sourceId,
        take,
    }: {
        query?: string,
        sourceType?: SourceType,
        sourceId?: number,
        take?: number,
    }): Observable<any> {
        return __request(OpenAPI, this.http, {
            method: 'GET',
            url: '/api/Rag/search',
            query: {
                'Query': query,
                'SourceType': sourceType,
                'SourceId': sourceId,
                'Take': take,
            },
        });
    }
}
