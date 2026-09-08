/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { Observable } from 'rxjs';
import type { LoginRequest } from '../models/LoginRequest';
import type { RegisterRequest } from '../models/RegisterRequest';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
@Injectable({
    providedIn: 'root',
})
export class AuthService {
    constructor(public readonly http: HttpClient) {}
    /**
     * @returns any OK
     * @throws ApiError
     */
    public postApiAuthRegister({
        requestBody,
    }: {
        requestBody?: RegisterRequest,
    }): Observable<any> {
        return __request(OpenAPI, this.http, {
            method: 'POST',
            url: '/api/Auth/register',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * @returns any OK
     * @throws ApiError
     */
    public postApiAuthLogin({
        requestBody,
    }: {
        requestBody?: LoginRequest,
    }): Observable<any> {
        return __request(OpenAPI, this.http, {
            method: 'POST',
            url: '/api/Auth/login',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * @returns any OK
     * @throws ApiError
     */
    public getApiAuthMe(): Observable<any> {
        return __request(OpenAPI, this.http, {
            method: 'GET',
            url: '/api/Auth/me',
        });
    }
    /**
     * @returns any OK
     * @throws ApiError
     */
    public getApiAuthAdminDashboard(): Observable<any> {
        return __request(OpenAPI, this.http, {
            method: 'GET',
            url: '/api/Auth/admin-dashboard',
        });
    }
    /**
     * @returns any OK
     * @throws ApiError
     */
    public getApiAuthUserDashboard(): Observable<any> {
        return __request(OpenAPI, this.http, {
            method: 'GET',
            url: '/api/Auth/user-dashboard',
        });
    }
}
