import { Routes } from '@angular/router';
import { adminGuard } from './guards/admin.guard';
import { authGuard } from './guards/auth.guard';
import { LoginPageComponent } from './pages/login-page/login-page.component';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginPageComponent },
  { path: 'dashboard', loadComponent: () => import('./pages/dashboard-page/dashboard-page.component').then(m => m.DashboardPageComponent), canActivate: [adminGuard] },
  { path: 'user-rag', loadComponent: () => import('./pages/user-rag-page/user-rag-page.component').then(m => m.UserRagPageComponent), canActivate: [authGuard] },
  { path: 'chat', loadComponent: () => import('./pages/chat-page/chat-page.component').then(m => m.ChatPageComponent), canActivate: [authGuard] },
  { path: 'muscles', loadComponent: () => import('./pages/muscles-page/muscles-page.component').then(m => m.MusclesPageComponent), canActivate: [authGuard] },
  { path: 'symptom-map', loadComponent: () => import('./pages/symptom-map-page/symptom-map-page.component').then(m => m.SymptomMapPageComponent), canActivate: [authGuard] },
  { path: 'admin-dashboard', loadComponent: () => import('./pages/dashboard-page/dashboard-page.component').then(m => m.DashboardPageComponent), canActivate: [adminGuard] },
];
