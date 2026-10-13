import { localStorageState, saveStorageState } from '@core/auth';
import { AUTH_TOKEN_STORAGE_KEY } from '@app/api';
import { AuthApi } from '@app/api/auth.api';
import { authFile } from '@app/auth';
import { roles } from '@app/config';
import { test as setup } from '@app/fixtures';

// Logs in once per role through the API (no browser) and stores the JWT where
// the Angular app expects it. The login UI itself is covered by tests/ui/auth.
for (const role of roles) {
  setup(`authenticate as ${role}`, async ({ request, config }) => {
    const auth = new AuthApi(request, { baseUrl: config.apiUrl });
    const { access_token } = await auth.login(config.users[role]);
    await saveStorageState(
      authFile(role),
      localStorageState(config.baseUrl, { [AUTH_TOKEN_STORAGE_KEY]: access_token }),
    );
  });
}
