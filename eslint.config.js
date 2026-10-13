// @ts-check
import eslint from '@eslint/js';
import prettier from 'eslint-config-prettier';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import { importX } from 'eslint-plugin-import-x';
import playwright from 'eslint-plugin-playwright';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

const XPATH_MESSAGE =
  'XPath locators are not allowed; use getByRole/getByLabel/getByText/getByTestId.';

export default defineConfig(
  {
    ignores: ['node_modules/', 'playwright-report/', 'test-results/', 'blob-report/', '.auth/'],
  },

  eslint.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
  },

  // Import hygiene, and the core/app boundary.
  {
    plugins: { 'import-x': importX },
    settings: {
      'import-x/resolver-next': [createTypeScriptImportResolver({ alwaysTryTypes: true })],
    },
    rules: {
      'import-x/no-cycle': 'error',
      'import-x/no-duplicates': 'error',
      'import-x/no-restricted-paths': [
        'error',
        {
          zones: [
            {
              target: './src/core',
              from: ['./src/app', './tests'],
              message:
                'src/core is the reusable layer and must not depend on app-specific code or tests.',
            },
          ],
        },
      ],
    },
  },
  {
    // Same boundary for path aliases, enforced without relying on module resolution.
    files: ['src/core/**/*.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@app/*', '**/app/*', '**/tests/*'],
              message: 'src/core must not import from src/app or tests.',
            },
          ],
        },
      ],
    },
  },

  // Playwright rules for specs, setup files and page objects.
  {
    files: ['tests/**/*.ts', 'src/**/*.ts'],
    ...playwright.configs['flat/recommended'],
  },
  {
    files: ['tests/**/*.ts', 'src/**/*.ts'],
    rules: {
      'playwright/no-wait-for-timeout': 'error',
      'playwright/no-force-option': 'error',
      'playwright/no-page-pause': 'error',
      'playwright/no-focused-test': 'error',
      'playwright/no-skipped-test': ['error', { allowConditional: true }],
      'playwright/prefer-web-first-assertions': 'error',
      'playwright/no-raw-locators': ['error', { allowed: [] }],
      'no-restricted-syntax': [
        'error',
        { selector: 'Literal[value=/^(xpath=|\\/\\/)/]', message: XPATH_MESSAGE },
        { selector: 'TemplateElement[value.raw=/^(xpath=|\\/\\/)/]', message: XPATH_MESSAGE },
      ],
    },
  },
  {
    // Setup files and page objects contain no assertions of their own by design.
    files: ['tests/setup/**/*.ts', 'src/**/*.ts'],
    rules: {
      'playwright/expect-expect': 'off',
      'playwright/no-standalone-expect': 'off',
    },
  },

  prettier,
);
