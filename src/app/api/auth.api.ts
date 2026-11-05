import type { APIResponse } from '@playwright/test';
import { BaseApiClient } from '@core/api';
import type { Credentials } from '@app/config';
import {
  loginResponseSchema,
  userSchema,
  type LoginResponse,
  type RegistrationInput,
  type User,
  type WithExtraFields,
} from '@app/schemas';

/** Key the Toolshop Angular app reads its JWT from in localStorage. */
export const AUTH_TOKEN_STORAGE_KEY = 'auth-token';

/** Toolshop resets every forgotten password to this one value (F-02). */
export const RESET_PASSWORD = 'welcome02';

export class AuthApi extends BaseApiClient {
  loginResponse(credentials: Credentials): Promise<APIResponse> {
    return this.send('POST', '/users/login', { data: credentials });
  }

  async login(credentials: Credentials): Promise<LoginResponse> {
    return this.parse(await this.loginResponse(credentials), loginResponseSchema);
  }

  registerResponse(input: WithExtraFields<Partial<RegistrationInput>>): Promise<APIResponse> {
    return this.send('POST', '/users/register', { data: input });
  }

  async register(input: RegistrationInput): Promise<User> {
    return this.parse(await this.registerResponse(input), userSchema, 201);
  }

  meResponse(): Promise<APIResponse> {
    return this.send('GET', '/users/me');
  }

  async me(): Promise<User> {
    return this.parse(await this.meResponse(), userSchema);
  }

  logoutResponse(): Promise<APIResponse> {
    return this.send('GET', '/users/logout');
  }

  refreshResponse(): Promise<APIResponse> {
    return this.send('GET', '/users/refresh');
  }

  async refresh(): Promise<LoginResponse> {
    return this.parse(await this.refreshResponse(), loginResponseSchema);
  }

  changePasswordResponse(currentPassword: string, newPassword: string): Promise<APIResponse> {
    return this.send('POST', '/users/change-password', {
      data: {
        current_password: currentPassword,
        new_password: newPassword,
        new_password_confirmation: newPassword,
      },
    });
  }

  forgotPasswordResponse(email: string): Promise<APIResponse> {
    return this.send('POST', '/users/forgot-password', { data: { email } });
  }
}
