/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { Observable } from 'rxjs';
import type { CreatePdfSourceRequest } from '../models/CreatePdfSourceRequest';
import type { CreateYoutubeSourceRequest } from '../models/CreateYoutubeSourceRequest';
import type { SyncYoutubeSourceRequest } from '../models/SyncYoutubeSourceRequest';
import type { UpdatePdfSourceRequest } from '../models/UpdatePdfSourceRequest';
import type { UpdateYoutubeSourceRequest } from '../models/UpdateYoutubeSourceRequest';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
@Injectable({
    providedIn: 'root',
})
export class SourceManagementService {
    constructor(public readonly http: HttpClient) {}
    /**
     * @returns any OK
     * @throws ApiError
     */
    public getApiSourceManagementYoutube(): Observable<any> {
        return __request(OpenAPI, this.http, {
            method: 'GET',
            url: '/api/SourceManagement/youtube',
        });
    }
    /**
     * @returns any OK
     * @throws ApiError
     */
    public postApiSourceManagementYoutube({
        requestBody,
    }: {
        requestBody?: CreateYoutubeSourceRequest,
    }): Observable<any> {
        return __request(OpenAPI, this.http, {
            method: 'POST',
            url: '/api/SourceManagement/youtube',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * @returns any OK
     * @throws ApiError
     */
    public getApiSourceManagementYoutube1({
        id,
    }: {
        id: number,
    }): Observable<any> {
        return __request(OpenAPI, this.http, {
            method: 'GET',
            url: '/api/SourceManagement/youtube/{id}',
            path: {
                'id': id,
            },
        });
    }
    /**
     * @returns any OK
     * @throws ApiError
     */
    public putApiSourceManagementYoutube({
        id,
        requestBody,
    }: {
        id: number,
        requestBody?: UpdateYoutubeSourceRequest,
    }): Observable<any> {
        return __request(OpenAPI, this.http, {
            method: 'PUT',
            url: '/api/SourceManagement/youtube/{id}',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * @returns any OK
     * @throws ApiError
     */
    public deleteApiSourceManagementYoutube({
        id,
    }: {
        id: number,
    }): Observable<any> {
        return __request(OpenAPI, this.http, {
            method: 'DELETE',
            url: '/api/SourceManagement/youtube/{id}',
            path: {
                'id': id,
            },
        });
    }
    /**
     * @returns any OK
     * @throws ApiError
     */
    public postApiSourceManagementYoutubeSync({
        id,
        requestBody,
    }: {
        id: number,
        requestBody?: SyncYoutubeSourceRequest,
    }): Observable<any> {
        return __request(OpenAPI, this.http, {
            method: 'POST',
            url: '/api/SourceManagement/youtube/{id}/sync',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * @returns any OK
     * @throws ApiError
     */
    public getApiSourceManagementPdf(): Observable<any> {
        return __request(OpenAPI, this.http, {
            method: 'GET',
            url: '/api/SourceManagement/pdf',
        });
    }
    /**
     * @returns any OK
     * @throws ApiError
     */
    public postApiSourceManagementPdf({
        requestBody,
    }: {
        requestBody?: CreatePdfSourceRequest,
    }): Observable<any> {
        return __request(OpenAPI, this.http, {
            method: 'POST',
            url: '/api/SourceManagement/pdf',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * @returns any OK
     * @throws ApiError
     */
    public getApiSourceManagementPdf1({
        id,
    }: {
        id: number,
    }): Observable<any> {
        return __request(OpenAPI, this.http, {
            method: 'GET',
            url: '/api/SourceManagement/pdf/{id}',
            path: {
                'id': id,
            },
        });
    }
    /**
     * @returns any OK
     * @throws ApiError
     */
    public putApiSourceManagementPdf({
        id,
        requestBody,
    }: {
        id: number,
        requestBody?: UpdatePdfSourceRequest,
    }): Observable<any> {
        return __request(OpenAPI, this.http, {
            method: 'PUT',
            url: '/api/SourceManagement/pdf/{id}',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * @returns any OK
     * @throws ApiError
     */
    public deleteApiSourceManagementPdf({
        id,
    }: {
        id: number,
    }): Observable<any> {
        return __request(OpenAPI, this.http, {
            method: 'DELETE',
            url: '/api/SourceManagement/pdf/{id}',
            path: {
                'id': id,
            },
        });
    }
    /**
     * @returns any OK
     * @throws ApiError
     */
    public postApiSourceManagementPdfUpload({
        formData,
    }: {
        formData?: {
            Name?: string;
            Description?: string;
            File?: Blob;
        },
    }): Observable<any> {
        return __request(OpenAPI, this.http, {
            method: 'POST',
            url: '/api/SourceManagement/pdf/upload',
            formData: formData,
            mediaType: 'multipart/form-data',
        });
    }
}
