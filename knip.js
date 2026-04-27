// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check

const PROD_ONLY =
  process.argv.includes('--production') || process.argv.includes('--strict');

/** @type {import('knip').KnipConfig} */
const config = {
  tags: ['-@knipignore', ...(PROD_ONLY ? ['-@testexport'] : [])],
  treatConfigHintsAsErrors: true,
  ignoreExportsUsedInFile: PROD_ONLY
    ? true
    : {
        type: true,
        interface: true,
        enum: true,
        member: true,
      },
  exclude: ['types'],
  ignoreIssues: {
    'ts/axo/**/*.{ts,tsx}': ['namespaceMembers'],
  },
  workspaces: {
    '.': {
      entry: [
        // Main
        'app/config.main.ts!',
        // Preload
        'ts/windows/about/preload.preload.ts!',
        'ts/windows/calldiagnostic/preload.preload.ts!',
        'ts/windows/debuglog/preload.preload.ts!',
        'ts/windows/loading/preload.preload.ts!',
        'ts/windows/permissions/preload.preload.ts!',
        'ts/windows/screenShare/preload.preload.ts!',
        'ts/windows/sticker-creator/preload.preload.ts!',
        // DOM
        'ts/windows/about/app.dom.tsx!',
        'ts/windows/calldiagnostic/app.dom.tsx!',
        'ts/windows/debuglog/app.dom.tsx!',
        'ts/windows/loading/start.dom.ts!',
        'ts/windows/permissions/app.dom.tsx!',
        'ts/windows/screenShare/app.dom.tsx!',
        // Others
        'codemods/**/*.mjs',
        'scripts/**/*.mjs',
      ],
      project: [
        // Production
        'ts/**/*.{ts,tsx}!',
        '!ts/**/*.stories.{ts,tsx}!',
        '!ts/storybook/**/*.{ts,tsx}!',
        '!ts/test-electron/**/*.{ts,tsx}!',
        '!ts/test-helpers/**/*.{ts,tsx}!',
        '!ts/test-mock/**/*.{ts,tsx}!',
        '!ts/test-node/**/*.{ts,tsx}!',
        '!ts/util/lint/**/*.{ts,tsx}!',
        'app/**/*.{ts,tsx}!',

        // Development
        'ts/**/*.d.ts',
        'ts/util/lint/**/*.{ts,tsx}',
        'test/**/*.mjs',
        'scripts/**/*.mjs',
        'codemods/**/*.mjs',

        // exclude workspaces
        '!danger/**/*.mjs',
      ],
      ignoreDependencies: [
        'buffer', // same name as builtin
        'url', // same name as builtin
        'danger', // turn into real workspace
      ],
      ignoreFiles: [
        'ts/components/Profiler.dom.tsx',
        ...(PROD_ONLY ? ['ts/axo/AxoAvatar.dom.tsx'] : []),
      ],
      ignoreBinaries: PROD_ONLY ? ['electron'] : [],
      storybook: {
        entry: [
          '.storybook/main.ts',
          '.storybook/preview.tsx',
          '.storybook/test-runner.ts',
          'ts/**/*.stories.{ts,tsx}',
        ],
      },
      mocha: {
        entry: [
          '.mocharc.json',
          'ts/test-electron/**/*.{ts,tsx}',
          'ts/test-helpers/**/*.{ts,tsx}',
          'ts/test-mock/**/*.{ts,tsx}',
          'ts/test-node/**/*.{ts,tsx}',
        ],
      },
      oxlint: {
        entry: ['.oxlintrc.json', '.oxlint/plugins.mjs'],
        project: ['.oxlint/rules/**/*.mjs'],
      },
      danger: {
        entry: ['dangerfile.mjs'],
        project: ['danger/**/*.mjs'],
      },
    },
    danger: {
      project: ['danger-exports.mjs', 'rules/**/*.mjs'],
    },
    'packages/mute-state-change': {
      ignoreBinaries: ['xcrun'],
      ignoreDependencies: ['node-addon-api'],
    },
    'sticker-creator': {
      project: [
        'src/**/*.{ts,tsx}!',
        'src/util/protos.js!',
        '!src/**/*.test.{ts,tsx}!',
      ],
    },
  },
};

export default config;
