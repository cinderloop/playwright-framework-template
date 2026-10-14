import type { KnownViolation } from '@core/a11y';

// Known WCAG 2.1 AA failures in Toolshop (axe-core 4.13), recorded when the
// scans were introduced. A scan fails on any rule not listed for its page, and
// annotates rules that stopped failing so this list can be trimmed. Fixing the
// app, not growing this list, is the way to get a violation off it.

const passwordToggleWithoutName: KnownViolation = {
  rule: 'button-name',
  reason:
    'The show/hide password toggle is an icon-only button with no accessible name (.btn-outline-secondary).',
};

export const a11yBaseline = {
  home: [
    {
      rule: 'list',
      reason:
        'The category filter nests a <div role="group"> directly inside <ul>, which is not a valid list child.',
    },
  ],
  productDetail: [],
  cart: [],
  login: [passwordToggleWithoutName],
  register: [
    passwordToggleWithoutName,
    {
      rule: 'list',
      reason: 'The password requirements list (#passwordHelp > ul) contains non-<li> children.',
    },
  ],
  contact: [],
} as const satisfies Record<string, readonly KnownViolation[]>;

export type A11yPage = keyof typeof a11yBaseline;
