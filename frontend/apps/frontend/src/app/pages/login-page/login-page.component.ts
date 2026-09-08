import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '@ragyt/api-client';

type LoginResponse = {
  accessToken?: string;
  email?: string;
  roles?: string[];
  message?: string;
};

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="login-shell">
      <div class="login-card">
        <h1>RAG YT</h1>
        <p>Login with Admin or User credentials</p>

        <div class="field">
          <label>Email</label>
          <input
            type="email"
            [ngModel]="email()"
            (ngModelChange)="email.set($event)"
            placeholder="admin&#64;ragyt.local"
          />
        </div>

        <div class="field">
          <label>Password</label>
          <input
            type="password"
            [ngModel]="password()"
            (ngModelChange)="password.set($event)"
            placeholder="Password"
          />
        </div>

        <button [disabled]="!canSubmit()" (click)="login()">
          {{ isSubmitting() ? 'Signing in...' : 'Login' }}
        </button>

        @if (errorMessage()) {
          <p class="error">{{ errorMessage() }}</p>
        }
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .login-shell {
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 24px;
        background: radial-gradient(circle at top right, #1e3a8a 0%, #0f172a 45%, #020617 100%);
      }

      .login-card {
        width: min(420px, 94vw);
        padding: 24px;
        border-radius: 16px;
        background: rgba(15, 23, 42, 0.88);
        border: 1px solid rgba(148, 163, 184, 0.25);
        box-shadow: 0 24px 50px rgba(2, 6, 23, 0.55);
      }

      h1 {
        margin: 0;
        font-size: 1.8rem;
        color: #f8fafc;
      }

      p {
        margin: 10px 0 20px;
        color: #cbd5e1;
      }

      .field {
        display: grid;
        gap: 8px;
        margin-bottom: 14px;
      }

      label {
        font-size: 0.9rem;
        color: #cbd5e1;
      }

      input {
        width: 100%;
        border: 1px solid #334155;
        background: #0f172a;
        color: #f8fafc;
        border-radius: 10px;
        padding: 12px;
        outline: none;
      }

      input:focus {
        border-color: #60a5fa;
        box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.2);
      }

      button {
        width: 100%;
        margin-top: 4px;
        border: 0;
        border-radius: 10px;
        padding: 12px;
        color: #f8fafc;
        font-weight: 700;
        background: linear-gradient(135deg, #2563eb, #0284c7);
        cursor: pointer;
      }

      button:disabled {
        opacity: 0.65;
        cursor: not-allowed;
      }

      .error {
        margin: 12px 0 0;
        color: #fca5a5;
        font-size: 0.92rem;
      }
    `,
  ],
})
export class LoginPageComponent {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);

  readonly email = signal('admin@ragyt.local');
  readonly password = signal('Admin123!');
  readonly isSubmitting = signal(false);
  readonly errorMessage = signal('');
  readonly canSubmit = computed(() => !!this.email().trim() && !!this.password().trim() && !this.isSubmitting());

  login(): void {
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

          localStorage.setItem('ragyt_token', token);
          localStorage.setItem('ragyt_user', JSON.stringify({ email: response.email ?? this.email(), roles: response.roles ?? [] }));

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
