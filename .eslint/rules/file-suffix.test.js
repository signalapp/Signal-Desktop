// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

const rule = require('./file-suffix.js');
const RuleTester = require('eslint').RuleTester;

// avoid triggering mocha's global leak detection
require('@typescript-eslint/parser');

const ruleTester = new RuleTester({
  parser: require.resolve('@typescript-eslint/parser'),
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: 'module',
  },
});

ruleTester.run('file-suffix', rule, {
  valid: [
    // Allowed references
    ...[
      ['std', '', ['std']],
      ['dom', 'window.addEventListener();', ['std', 'dom']],
      ['node', 'require("node:fs");', ['std', 'node']],
      [
        'preload',
        'import { ipcRenderer } from "electron";',
        ['std', 'node', 'preload'],
      ],
      [
        'main',
        'import { autoUpdater } from "electron";',
        ['std', 'node', 'main'],
      ],
    ]
      .map(([fileSuffix, requiredLine, depSuffixes]) => {
        return depSuffixes.map(depSuffix => {
          return {
            name: `importing ${depSuffix} from ${fileSuffix}`,
            filename: `a.${fileSuffix}.ts`,
            code: `
            import { x } from './b.${depSuffix}.js';
            ${requiredLine}
          `,
            globals: {
              window: 'writable',
              require: 'readable',
            },
          };
        });
      })
      .flat(),

    {
      name: 'type import should have no effect',
      filename: 'a.std.ts',
      code: `import type { ReadonlyDeep } from './b.dom.js'`,
    },
  ],
  invalid: [
    // Disallowed references
    ...[
      ['std', ['dom', 'node', 'preload', 'main']],
      ['dom', ['node', 'preload', 'main']],
      ['node', ['preload', 'main']],
      ['preload', ['main']],
      ['main', ['dom', 'preload']],
    ]
      .map(([fileSuffix, depSuffixes]) => {
        return depSuffixes.map(depSuffix => {
          return {
            name: `importing ${depSuffix} from ${fileSuffix}`,
            filename: `a.${fileSuffix}.ts`,
            code: `import { x } from './b.${depSuffix}.js'`,
            errors: [
              {
                message: `Invalid suffix ${fileSuffix}, expected: ${depSuffix}`,
                type: 'Program',
              },
            ],
          };
        });
      })
      .flat(),

    ...['dom', 'node', 'preload', 'main'].map(suffix => {
      return {
        name: `no ${suffix} imports`,
        filename: `a.${suffix}.ts`,
        code: '',
        errors: [
          {
            message: `Invalid suffix ${suffix}, expected: std`,
            type: 'Program',
          },
        ],
      };
    }),

    // Invalid imports
    {
      name: 'preload in main',
      filename: 'a.main.ts',
      code: `
        import { autoUpdater } from 'electron';
        import './b.preload.js';
      `,
      errors: [
        {
          message: 'Invalid import/reference for suffix: main',
          type: 'ImportDeclaration',
        },
      ],
    },
    {
      name: 'main in preload',
      filename: 'a.preload.ts',
      code: `
        import { ipcRenderer } from 'electron';
        import './b.main.js';
      `,
      errors: [
        {
          message: 'Invalid suffix preload, expected: main',
          type: 'Program',
        },
        {
          message: 'Invalid import/reference for suffix: main',
          type: 'ImportSpecifier',
        },
      ],
    },
  ],
});
