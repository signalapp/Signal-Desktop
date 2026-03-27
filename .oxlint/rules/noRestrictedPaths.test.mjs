// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check
import { noRestrictedPaths } from './noRestrictedPaths.mjs';
import { RuleTester } from '@typescript-eslint/rule-tester';
import * as path from 'node:path';

const basePath = path.join(import.meta.dirname, 'fixtures/noRestrictedPaths');
const filename = path.join(basePath, 'client/entry.ts');

/**
 * @param {boolean=} withMessage
 * @returns {[import("./noRestrictedPaths.mjs").Options]}
 */
function opts(withMessage) {
  const message = withMessage ? 'just stop it' : undefined;
  return [
    { basePath, zones: [{ target: './client', from: './server', message }] },
  ];
}

const ruleTester = new RuleTester();

ruleTester.run('no-restricted-paths', noRestrictedPaths, {
  valid: [
    { filename, options: opts(), code: `import b from './client.ts';` },
    { filename, options: opts(), code: `import b from './client.js';` },
    { filename, options: opts(), code: `import b from '../client/client.ts';` },
    { filename, options: opts(), code: `import b from './nonexistant';` },
    { filename, options: opts(), code: `import b from 'node:path';` },
    { filename, options: opts(), code: `import b from 'react';` },
    { filename, options: opts(), code: `import b from 'fake-module';` },
  ],
  invalid: [
    {
      filename,
      options: opts(),
      code: `import b from '../server/server.ts';`,
      errors: [{ messageId: 'pathRestrictedNoMessage' }],
    },
    {
      filename,
      options: opts(),
      code: `import b from '../server/server.js';`,
      errors: [{ messageId: 'pathRestrictedNoMessage' }],
    },
    {
      filename,
      options: opts(true),
      code: `import b from '../server/server.ts';`,
      errors: [{ messageId: 'pathRestrictedWithMessage' }],
    },
  ],
});
