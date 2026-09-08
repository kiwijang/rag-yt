import { Routes } from '@angular/router';
import { adminGuard } from './guards/admin.guard';
import { LoginPageComponent } from './pages/login-page/login-page.component';
import { DashboardPageComponent } from './pages/dashboard-page/dashboard-page.component';
import { UserRagPageComponent } from './pages/user-rag-page/user-rag-page.component';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginPageComponent },
  { path: 'dashboard', component: DashboardPageComponent },
  { path: 'user-rag', component: UserRagPageComponent },
  { path: 'admin-dashboard', component: DashboardPageComponent, canActivate: [adminGuard] },
];
