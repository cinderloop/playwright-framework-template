import { localStorageState, saveStorageState } from '@core/auth';
import { AUTH_TOKEN_STORAGE_KEY, loginViaApi } from '@app/api/auth.api';
import { authFile } from '@app/auth';
import { roles } from '@app/config';
import { test as setup } from '@app/fixtures';

// Logs in once per role through the API (no browser) and stores the JWT where
// the Angular app expects it. The login UI itself is covered by tests/ui/auth.
for (const role of roles) {
  setup(`authenticate as ${role}`, async ({ request, config }) => {
    const { access_token } = await loginViaApi(request, config.apiUrl, config.users[role]);
    await saveStorageState(
      authFile(role),
      localStorageState(config.baseUrl, { [AUTH_TOKEN_STORAGE_KEY]: access_token }),
    );
  });
}
