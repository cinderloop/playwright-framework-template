import { test } from '@app/fixtures';
import { authorizationMatrix } from '@app/authorization';
import { config } from '@app/config';
import { runAuthorizationMatrix } from '@core/authorization';
import { localOnly } from '@core/utils';

// One test per row of the matrix. Rows with a `known-issue` annotation assert the
// correct behaviour and are expected to fail until Toolshop changes.
test.describe('Authorization matrix', { tag: ['@api', '@api-advanced'] }, () => {
  localOnly(config.environment);

  runAuthorizationMatrix(test, authorizationMatrix);
});
