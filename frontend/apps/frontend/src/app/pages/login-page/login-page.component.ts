import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '@ragyt/api-client';
import { AuthSessionService } from '../../services/auth-session.service';
import {
  HlmBadgeDirective,
  HlmButtonDirective,
  HlmCardContentDirective,
  HlmCardDescriptionDirective,
  HlmCardDirective,
  HlmCardFooterDirective,
  HlmCardHeaderDirective,
  HlmCardTitleDirective,
  HlmInputDirective,
} from '@ragyt/ui';

type LoginResponse = {
  accessToken?: string;
  email?: string;
  roles?: string[];
  message?: string;
};

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [
    FormsModule,
    HlmBadgeDirective,
    HlmButtonDirective,
    HlmCardDirective,
    HlmCardHeaderDirective,
    HlmCardTitleDirective,
    HlmCardDescriptionDirective,
    HlmCardContentDirective,
    HlmCardFooterDirective,
    HlmInputDirective,
  ],
  template: `
    <main class="grid h-full overflow-y-auto place-items-center bg-slate-50 p-6 dark:bg-slate-950">
      <form hlmCard class="w-full max-w-md" (ngSubmit)="login()">
        <header hlmCardHeader>
          <span hlmBadge variant="secondary" class="mb-2">RAG YT</span>
          <h1 hlmCardTitle>登入</h1>
          <p hlmCardDescription>使用管理員或使用者帳號登入。</p>
        </header>

        <div hlmCardContent class="grid gap-4">
          <div class="grid gap-2">
            <label class="text-sm font-medium" for="login-email">電子郵件</label>
            <input hlmInput id="login-email" name="email" type="email" autocomplete="username"
              [ngModel]="email()" (ngModelChange)="email.set($event)"
              [invalid]="!!errorMessage()" [attr.aria-describedby]="errorMessage() ? 'login-error' : null" />
          </div>
          <div class="grid gap-2">
            <label class="text-sm font-medium" for="login-password">密碼</label>
            <input hlmInput id="login-password" name="password" type="password" autocomplete="current-password"
              [ngModel]="password()" (ngModelChange)="password.set($event)"
              [invalid]="!!errorMessage()" [attr.aria-describedby]="errorMessage() ? 'login-error' : null" />
          </div>
          @if (errorMessage()) {
            <p id="login-error" role="alert" class="m-0 text-sm text-red-700 dark:text-red-300">{{ errorMessage() }}</p>
          }
        </div>

        <footer hlmCardFooter>
          <button hlmBtn type="submit" size="lg" hlmClass="w-full" [disabled]="!canSubmit()">
            {{ isSubmitting() ? '登入中…' : '登入' }}
          </button>
        </footer>
      </form>
    </main>
  `,
})
export class LoginPageComponent {
  private readonly session = inject(AuthSessionService);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);

  readonly email = signal('admin@ragyt.local');
  readonly password = signal('Admin123!');
  readonly isSubmitting = signal(false);
  readonly errorMessage = signal('');
  readonly canSubmit = computed(() => !!this.email().trim() && !!this.password().trim() && !this.isSubmitting());

  login(): void {
    if (this.isSubmitting()) return;

    if (!this.email().trim() || !this.password().trim()) {
      this.errorMessage.set('Please enter email and password.');
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set('');

    this.authService
      .postApiAuthLogin({
        requestBody: {
          email: this.email(),
          password: this.password(),
        },
      })
      .pipe(finalize(() => this.isSubmitting.set(false)))
      .subscribe({
        next: (response: LoginResponse) => {
          const token = response.accessToken;
          if (!token) {
            this.errorMessage.set('Login succeeded but no token was returned.');
            return;
          }

          this.session.login(token, { email: response.email ?? this.email(), roles: response.roles ?? [] });

          const roles = response.roles ?? [];
          if (roles.includes('Admin')) {
            this.router.navigateByUrl('/admin-dashboard');
            return;
          }

          this.router.navigateByUrl('/user-rag');
        },
        error: () => {
          this.errorMessage.set('Login failed. Please check the credentials and backend status.');
        },
      });
  }
}
