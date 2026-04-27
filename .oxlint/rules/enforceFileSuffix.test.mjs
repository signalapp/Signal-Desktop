// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check
import { enforceFileSuffix } from './enforceFileSuffix.mjs';
import { RuleTester } from '@typescript-eslint/rule-tester';

const ruleTester = new RuleTester();

const ALLOWED_REFERENCES = /* @type {const} */ [
  {
    fileSuffix: 'std',
    requiredLine: '',
    depSuffixes: ['std'],
  },
  {
    fileSuffix: 'dom',
    requiredLine: 'window.addEventListener();',
    depSuffixes: ['std', 'dom'],
  },
  {
    fileSuffix: 'node',
    requiredLine: 'require("node:fs");',
    depSuffixes: ['std', 'node'],
  },
  {
    fileSuffix: 'preload',
    requiredLine: 'import { ipcRenderer } from "electron";',
    depSuffixes: ['std', 'node', 'preload'],
  },
  {
    fileSuffix: 'main',
    requiredLine: 'import { autoUpdater } from "electron";',
    depSuffixes: ['std', 'node', 'main'],
  },
];

const DISALLOWED_REFERENCES = /* @type {const} */ [
  { fileSuffix: 'std', depSuffixes: ['dom', 'node', 'preload', 'main'] },
  { fileSuffix: 'dom', depSuffixes: ['node', 'preload', 'main'] },
  { fileSuffix: 'node', depSuffixes: ['preload', 'main'] },
  { fileSuffix: 'preload', depSuffixes: ['main'] },
  { fileSuffix: 'main', depSuffixes: ['dom', 'preload'] },
];

ruleTester.run('file-suffix', enforceFileSuffix, {
  valid: [
    ...ALLOWED_REFERENCES.map(({ fileSuffix, requiredLine, depSuffixes }) => {
      return depSuffixes.map(depSuffix => {
        /** @type {const} */
        return {
          name: `importing ${depSuffix} from ${fileSuffix}`,
          filename: `a.${fileSuffix}.ts`,
          code: `
            import { x } from './b.${depSuffix}.ts';
            ${requiredLine}
          `,
          languageOptions: {
            globals: {
              window: 'writable',
              require: 'readable',
            },
          },
        };
      });
    }).flat(),
    {
      name: 'type import should have no effect',
      filename: 'a.std.ts',
      code: `import type { ReadonlyDeep } from './b.dom.ts'`,
    },
  ],
  invalid: [
    ...DISALLOWED_REFERENCES.map(({ fileSuffix, depSuffixes }) => {
      return depSuffixes.map(depSuffix => {
        /** @type {const} */
        return {
          name: `importing ${depSuffix} from ${fileSuffix}`,
          filename: `a.${fileSuffix}.ts`,
          code: `import { x } from './b.${depSuffix}.ts'`,
          errors: [
            {
              messageId: 'wrongFileSuffix',
              data: { fileSuffix, expectedSuffix: depSuffix },
            },
          ],
        };
      });
    }).flat(),

    ...['dom', 'node', 'preload', 'main'].map(fileSuffix => {
      /** @type {const} */
      return {
        name: `no ${fileSuffix} imports`,
        filename: `a.${fileSuffix}.ts`,
        code: '',
        errors: [
          {
            messageId: 'wrongFileSuffix',
            data: { fileSuffix, expectedSuffix: 'std' },
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
        import './b.preload.ts';
      `,
      errors: [
        {
          messageId: 'invalidImportForSuffix',
          data: { expectedSuffix: 'main' },
        },
      ],
    },
    {
      name: 'main in preload',
      filename: 'a.preload.ts',
      code: `
        import { ipcRenderer } from 'electron';
        import './b.main.ts';
      `,
      errors: [
        {
          messageId: 'wrongFileSuffix',
          data: { fileSuffix: 'preload', expectedSuffix: 'main' },
        },
        {
          messageId: 'invalidImportForSuffix',
          data: { expectedSuffix: 'main' },
        },
      ],
    },
  ],
});
