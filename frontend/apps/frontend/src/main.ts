import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';
import { OpenAPI } from '@ragyt/api-client';

OpenAPI.BASE = 'http://localhost:5085';
OpenAPI.TOKEN = async () => localStorage.getItem('ragyt_token') ?? '';

bootstrapApplication(AppComponent, appConfig).catch((err) => console.error(err));
