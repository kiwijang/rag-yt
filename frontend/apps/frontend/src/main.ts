import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { provideRouter } from '@angular/router';
import { routes } from './app/app.routes';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideIonicAngular } from '@ionic/angular/standalone';
import { provideHttpClient } from '@angular/common/http';
import { OpenAPI } from '@ragyt/api-client';

OpenAPI.BASE = 'http://localhost:5085';
OpenAPI.TOKEN = async () => localStorage.getItem('ragyt_token') ?? '';

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(routes),
    provideAnimations(),
    provideIonicAngular(),
    provideHttpClient(),
  ],
}).catch((err) => console.error(err));
