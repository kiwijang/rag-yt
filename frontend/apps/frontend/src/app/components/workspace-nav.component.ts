import { Component, computed, inject, input } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthSessionService } from '../services/auth-session.service';
import { HlmButtonDirective } from '@ragyt/ui';

@Component({
  selector: 'app-workspace-nav', standalone: true,
  imports: [RouterLink, RouterLinkActive, HlmButtonDirective],
  template: `
    <nav aria-label="工作區導覽" class="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900">
      <a hlmBtn variant="ghost" size="sm" routerLink="/chat" routerLinkActive="!bg-indigo-100 !text-indigo-900 dark:!bg-indigo-950 dark:!text-indigo-100" ariaCurrentWhenActive="page">LLM 對話</a>
      <a hlmBtn variant="ghost" size="sm" routerLink="/muscles" routerLinkActive="!bg-indigo-100 !text-indigo-900 dark:!bg-indigo-950 dark:!text-indigo-100" ariaCurrentWhenActive="page">3D 肌肉選擇</a>
      <a hlmBtn variant="ghost" size="sm" routerLink="/symptom-map" routerLinkActive="!bg-indigo-100 !text-indigo-900 dark:!bg-indigo-950 dark:!text-indigo-100" ariaCurrentWhenActive="page">平面肌肉地圖</a>
      <a hlmBtn variant="ghost" size="sm" routerLink="/user-rag" routerLinkActive="!bg-indigo-100 !text-indigo-900 dark:!bg-indigo-950 dark:!text-indigo-100" ariaCurrentWhenActive="page">RAG 檢索</a>
      @if (isAdmin()) { <a hlmBtn variant="ghost" size="sm" routerLink="/dashboard" routerLinkActive="!bg-indigo-100 !text-indigo-900" ariaCurrentWhenActive="page">來源管理</a> }
      @if (showLogout()) { <button hlmBtn type="button" variant="ghost" size="sm" class="ml-auto" (click)="logout()">登出</button> }
    </nav>
  `,
})
export class WorkspaceNavComponent {
  readonly showLogout = input(true);
  private readonly session = inject(AuthSessionService);
  private readonly router = inject(Router);
  readonly isAdmin = computed(() => this.session.state()?.roles.includes('Admin'));
  logout(): void { this.session.clear(); void this.router.navigateByUrl('/login', { replaceUrl: true }); }
}
