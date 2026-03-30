// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check
import { noForIn } from './noForIn.mjs';
import { RuleTester } from '@typescript-eslint/rule-tester';

const ruleTester = new RuleTester();

ruleTester.run('no-for-in', noForIn, {
  valid: [
    { code: 'for (let a of b) {}' },
    { code: 'for (;;) {}' },
    { code: 'if (a in b) {}' },
  ],
  invalid: [
    {
      code: `for (let a in b) {}`,
      errors: [{ messageId: 'preferForOf' }],
    },
    {
      code: `for (a in b) {}`,
      errors: [{ messageId: 'preferForOf' }],
    },
  ],
});
