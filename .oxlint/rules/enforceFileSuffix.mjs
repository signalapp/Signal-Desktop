// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check
import { ESLintUtils } from '@typescript-eslint/utils';
import { getReferenceType } from './utils/getReferenceType.mjs';
import { isStringLiteral } from './utils/astUtils.mjs';
import { assert } from './utils/assert.mjs';

/**
 * @typedef {import("@typescript-eslint/utils").TSESTree.Node} Node
 * @typedef {import("@typescript-eslint/utils").TSESTree.ImportDeclaration} ImportDeclaration
 * @typedef {import("@typescript-eslint/utils").TSESTree.ExportAllDeclaration} ExportAllDeclaration
 * @typedef {import("@typescript-eslint/utils").TSESTree.ExportNamedDeclaration} ExportNamedDeclaration
 * @typedef {import("@typescript-eslint/utils").TSESTree.ImportClause} ImportClause
 * @typedef {import("@typescript-eslint/utils").TSESTree.ExportSpecifier} ExportSpecifier
 */

/**
 * @typedef {'std' | 'node' | 'dom' | 'preload' | 'main'} Suffix
 */

const ELECTRON_MAIN_MODULES = new Set([
  'app',
  'autoUpdater',
  'BaseWindow',
  'BrowserView',
  'BrowserWindow',
  'contentTracing',
  'desktopCapturer',
  'dialog',
  'globalShortcut',
  'inAppPurchase',
  'ipcMain',
  'Menu',
  'MenuItem',
  'MessageChannelMain',
  'MessagePortMain',
  'nativeTheme',
  'net',
  'netLog',
  'Notification',
  'powerMonitor',
  'powerSaveBlocker',
  'process',
  'protocol',
  'pushNotifications',
  'safeStorage',
  'screen',
  'session',
  'ShareMenu',
  'shell',
  'systemPreferences',
  'TouchBar',
  'Tray',
  'utilityProcess',
  'webContents',
  'WebContentsView',
  'webFrameMain',
  'View',
]);
const ELECTRON_RENDERER_MODULES = new Set([
  'contextBridge',
  'ipcRenderer',
  'webFrame',
  'webUtils',
]);
const ELECTRON_SHARED_MODULES = new Set([
  'clipboard',
  'crashReporter',
  'nativeImage',
]);

// Packages that use Node.js APIs (file system, etc)
const NODE_PACKAGES = new Set([
  '@electron/asar',
  '@indutny/dicer',
  '@indutny/mac-screen-share',
  '@indutny/range-finder',
  '@indutny/simple-windows-notifications',
  '@signalapp/libsignal-client',
  '@signalapp/mute-state-change',
  '@signalapp/ringrtc',
  '@signalapp/sqlcipher',
  '@signalapp/windows-ucv',
  'cirbuf',
  'config',
  'dashdash',
  'encoding',
  'fast-glob',
  'fs-extra',
  'fs-xattr',
  'got',
  'growing-file',
  'http-proxy-agent',
  'https-proxy-agent',
  'node-fetch',
  'read-last-lines',
  'socks-proxy-agent',
  'split2',
  'write-file-atomic',

  // Dev dependencies
  '@electron/fuses',
  '@electron/notarize',
  '@electron/symbolicate-mac',
  '@indutny/parallel-prettier',
  '@indutny/rezip-electron',
  '@napi-rs/canvas',
  '@signalapp/mock-server',
  '@tailwindcss/cli',
  '@tailwindcss/postcss',
  'better-blockmap',
  'chokidar-cli',
  'cross-env',
  'electron-builder',
  'electron-mocha',
  'endanger',
  'enhanced-resolve',
  'enquirer',
  'execa',
  'http-server',
  'json-to-ast',
  'log-symbols',
  'node-gyp',
  'node-gyp-build',
  'npm-run-all',
  'p-limit',
  'pe-library',
  'pixelmatch',
  'playwright',
  'postcss-loader',
  'prettier',
  'prettier-plugin-tailwindcss',
  'react-devtools',
  'react-devtools-core',
  'resolve-url-loader',
  'rolldown',
  'sass',
  'sass-loader',
  'style-loader',
  'stylelint',
  'stylelint-config-css-modules',
  'stylelint-config-recommended-scss',
  'stylelint-use-logical-spec',
  'svgo',
  'synckit',
  'tailwindcss',
  'tsx',
  'typescript',
  'wait-on',
  'webpack',
  'webpack-cli',
  'webpack-dev-server',
]);

// Packages that use DOM APIs
const DOM_PACKAGES = new Set([
  '@popperjs/core',
  '@react-aria/focus',
  '@react-aria/interactions',
  '@react-aria/utils',
  '@react-spring/web',
  '@tanstack/react-virtual',
  'blob-util',
  'blueimp-load-image',
  'dom-accessibility-api',
  'fabric',
  'radix-ui',
  'react-aria',
  'react-aria-components',
  'react-blurhash',
  'react-popper',
  'react-virtualized',
  // Note that: react-dom/server is categorized separately
  'react-dom',

  // Dev dependencies
  '@storybook/addon-a11y',
  '@storybook/addon-actions',
  '@storybook/addon-controls',
  '@storybook/addon-interactions',
  '@storybook/addon-jest',
  '@storybook/addon-measure',
  '@storybook/addon-toolbars',
  '@storybook/addon-viewport',
  '@storybook/addon-webpack5-compiler-swc',
  '@storybook/csf',
  '@storybook/react',
  '@storybook/react-webpack5',
  '@storybook/test',
  '@storybook/test-runner',
  '@storybook/types',
  'storybook',
]);

// Packages that can run in both browser/node
const STD_PACKAGES = new Set([
  '@babel/core',
  '@babel/plugin-transform-runtime',
  '@babel/plugin-transform-typescript',
  '@babel/preset-react',
  '@babel/preset-typescript',
  '@formatjs/fast-memoize',
  '@formatjs/icu-messageformat-parser',
  '@formatjs/intl',
  '@formatjs/intl-localematcher',
  '@indutny/sneequals',
  '@internationalized/date',
  '@react-types/shared',
  '@signalapp/minimask',
  '@signalapp/quill-cjs',
  '@typescript-eslint/eslint-plugin',
  '@typescript-eslint/parser',
  'axe-core',
  'babel-core',
  'babel-loader',
  'babel-plugin-lodash',
  'blurhash',
  'buffer',
  'card-validator',
  'casual',
  'chai',
  'chai-as-promised',
  'changedpi',
  'classnames',
  'country-codes-list',
  'credit-card-type',
  'css-loader',
  'csv-parse',
  'danger',
  'debug',
  'direction',
  'emoji-datasource',
  'emoji-datasource-apple',
  'emoji-regex',
  'eslint',
  'eslint-plugin-better-tailwindcss',
  'filesize',
  'firstline',
  'form-data',
  'motion',
  'motion/react',
  'fuse.js',
  'google-libphonenumber',
  'heic-convert',
  'humanize-duration',
  'intl-tel-input',
  'js-yaml',
  'linkify-it',
  'lodash',
  'lru-cache',
  'memoizee',
  'mocha',
  'moment',
  'mp4box',
  'nop',
  'normalize-path',
  'p-map',
  'p-queue',
  'p-timeout',
  'parsecurrency',
  'pino',
  'pngjs',
  'qrcode-generator',
  'react',
  'react-intl',
  'react-redux',
  'redux',
  'redux-logger',
  'redux-promise-middleware',
  'redux-thunk',
  'reselect',
  'semver',
  'sinon',
  'tinykeys',
  'type-fest',
  'url',
  'uuid',
  'zod',
]);

export const enforceFileSuffix = ESLintUtils.RuleCreator.withoutDocs({
  name: 'enforce-file-suffix',
  meta: {
    type: 'problem',
    messages: {
      missingFileSuffix: 'Missing file suffix in {{source}} import',
      unrecognizedFileSuffix:
        'Unrecognized file suffix in {{source}}, expected: node/preload/main/std, found: {{depSuffix}}',
      commonJsImportOfElectronNoAllowed:
        'CJS import of electron is not allowed',
      uncategorizedElectronApi:
        'Uncategorized electron API: "{{name}}". ' +
        'Please update .oxlint/rules/file-suffix.js and add it to ' +
        'ELECTRON_MAIN_MODULES/ELECTRON_RENDERER_MODULES/' +
        'ELECTRON_SHARED_MODULES',
      unsupportedNamespaceImportForElectron:
        'Unsupported namespace import specifier for electron',
      unsupportedImportSpecifierForElectron:
        'Unsupported import specifier for electron',
      uncategorizedDependency:
        'Uncategorized dependency "{{moduleName}}". ' +
        'Please update .oxlint/rules/file-suffix.js and add it to either ' +
        'of NODE_PACKAGES/DOM_PACKAGES/STD_PACKAGES',
      missingFileSuffixMustBeOneOf:
        'Missing file suffix. Has to be one of: node/preload/main/std',
      wrongFileSuffix:
        'Invalid suffix {{fileSuffix}}, expected: {{expectedSuffix}}',
      invalidImportForSuffix:
        'Invalid import/reference for suffix: {{expectedSuffix}}',
      invalidRequireCount: 'Invalid require() argument count',
    },
    schema: [],
    defaultOptions: [],
  },
  create(context) {
    const { filename, sourceCode } = context;

    /** @type {string} */
    let fileSuffix;

    /** @type {Node[]} */
    const nodeUses = [];
    /** @type {Node[]} */
    const domUses = [];
    /** @type {Node[]} */
    const preloadUses = [];
    /** @type {Node[]} */
    const mainUses = [];

    /** @type Record<Suffix, Node[][]> */
    const invalidUsesBySuffix = {
      std: [nodeUses, domUses, preloadUses, mainUses],
      node: [domUses, preloadUses, mainUses],
      dom: [nodeUses, preloadUses, mainUses],
      preload: [mainUses],
      main: [domUses, preloadUses],
    };

    /**
     * @param {Node} node
     * @param {string} source
     */
    function trackLocalDep(node, source) {
      if (!/\.tsx?/.test(source)) {
        return;
      }

      const match = source.match(/\.([^.\/]+)(?:\.stories)?\.tsx?$/);
      if (match == null) {
        context.report({
          node,
          messageId: 'missingFileSuffix',
          data: { source },
        });
        return;
      }

      const [, depSuffix] = match;
      if (depSuffix === 'node') {
        nodeUses.push(node);
      } else if (depSuffix === 'dom') {
        domUses.push(node);
      } else if (depSuffix === 'preload') {
        preloadUses.push(node);
      } else if (depSuffix === 'main') {
        mainUses.push(node);
      } else if (depSuffix === 'std') {
        // Ignore
      } else {
        context.report({
          node,
          messageId: 'unrecognizedFileSuffix',
          data: { source, depSuffix },
        });
      }
    }

    /**
     * @param {Node} node
     * @param {string} source
     * @param {Array<ImportClause | ExportSpecifier> | null} specifiers
     */
    function processUse(node, source, specifiers) {
      if (source.startsWith('.')) {
        trackLocalDep(node, source);
        return;
      }

      // Node APIs
      if (source.startsWith('node:')) {
        nodeUses.push(node);
        return;
      }

      // Electron
      if (source === 'electron' && specifiers == null) {
        context.report({
          node,
          messageId: 'commonJsImportOfElectronNoAllowed',
        });
        return;
      } else if (source === 'electron') {
        for (const s of specifiers ?? []) {
          // We implicitly skip:
          // they are used in scripts
          if (s.type === 'ImportSpecifier') {
            if (s.importKind === 'type') {
              continue;
            }
            /** @type {string} */
            let importName;
            if (s.imported.type === 'Identifier') {
              importName = s.imported.name;
            } else {
              importName = s.imported.value;
            }

            if (ELECTRON_MAIN_MODULES.has(importName)) {
              mainUses.push(s);
            } else if (ELECTRON_RENDERER_MODULES.has(importName)) {
              preloadUses.push(s);
            } else if (ELECTRON_SHARED_MODULES.has(importName)) {
              // no-op
            } else {
              context.report({
                node: s,
                messageId: 'uncategorizedElectronApi',
                data: { name: importName },
              });
            }
          } else if (s.type === 'ImportNamespaceSpecifier') {
            // import * as electron from 'electron';
            context.report({
              node: s,
              messageId: 'unsupportedNamespaceImportForElectron',
            });
            nodeUses.push(s);
          } else if (s.type === 'ImportDefaultSpecifier') {
            // import ELECTRON_CLI from 'electron';
            nodeUses.push(s);
          } else {
            context.report({
              node: s,
              messageId: 'unsupportedImportSpecifierForElectron',
            });
          }
        }
        return;
      }

      const match = source.match(/^([^@/]+|@[^/]+\/[^/]+)/);
      if (match == null) {
        return;
      }

      const [, moduleName] = match;
      assert(moduleName, 'Missing moduleName');
      if (NODE_PACKAGES.has(moduleName)) {
        nodeUses.push(node);
      } else if (source === 'react-dom/server') {
        // no-op
      } else if (
        DOM_PACKAGES.has(moduleName) ||
        source === 'react-dom/client'
      ) {
        domUses.push(node);
      } else if (!STD_PACKAGES.has(moduleName)) {
        context.report({
          node,
          messageId: 'uncategorizedDependency',
          data: { moduleName },
        });
      }
    }

    /**
     * @param {ImportDeclaration | ExportAllDeclaration | ExportNamedDeclaration} node
     */
    function processESMReference(node) {
      /** @type {Array<ImportClause | ExportSpecifier> | null} */
      let specifiers;
      if (node.type === 'ImportDeclaration') {
        if (node.importKind === 'type') {
          return;
        }

        if (node.specifiers.length > 0) {
          const allTypes = node.specifiers.every(specifier => {
            return (
              specifier.type === 'ImportSpecifier' &&
              specifier.importKind === 'type'
            );
          });

          if (allTypes) {
            return;
          }
        }

        specifiers = node.specifiers;
      } else if (node.type === 'ExportNamedDeclaration') {
        specifiers = node.specifiers;
      } else {
        specifiers = null;
      }

      if (!node.source) {
        return;
      }
      if (node.source.type !== 'Literal') {
        return;
      }
      const source = node.source.value;
      processUse(node, source, specifiers);
    }

    return {
      Program: node => {
        if (filename.endsWith('.d.ts')) {
          // Skip types
          return;
        }

        const match = filename.match(
          /\.([^.\/]+)(?:\.stories)?\.(?:ts|tsx|js|mjs)$/
        );
        if (match == null) {
          context.report({
            node: node,
            messageId: 'missingFileSuffixMustBeOneOf',
          });
          return;
        }

        const matchedSuffix = match[1];
        assert(matchedSuffix, 'Missing matchedSuffix');
        fileSuffix = matchedSuffix;
      },
      'Program:exit': node => {
        if (fileSuffix == null) {
          return;
        }

        /** @type {Suffix} */
        let expectedSuffix;
        if (mainUses.length > 0) {
          expectedSuffix = 'main';
        } else if (preloadUses.length > 0) {
          expectedSuffix = 'preload';
        } else if (nodeUses.length > 0) {
          if (domUses.length > 0) {
            expectedSuffix = 'preload';
          } else {
            expectedSuffix = 'node';
          }
        } else if (domUses.length > 0) {
          expectedSuffix = 'dom';
        } else {
          expectedSuffix = 'std';
        }

        // All .tsx files should normally be .dom.tsx, but could also be
        // .std.tsx.
        if (
          expectedSuffix === 'std' &&
          filename.endsWith('.tsx') &&
          fileSuffix !== 'std'
        ) {
          expectedSuffix = 'dom';
        }

        if (fileSuffix !== expectedSuffix) {
          context.report({
            node,
            messageId: 'wrongFileSuffix',
            data: { fileSuffix, expectedSuffix },
          });
        }

        const invalid = invalidUsesBySuffix[expectedSuffix].flat();
        for (const use of invalid) {
          context.report({
            node: use,
            messageId: 'invalidImportForSuffix',
            data: { expectedSuffix },
          });
        }
      },
      ImportDeclaration(node) {
        processESMReference(node);
      },
      ExportAllDeclaration(node) {
        processESMReference(node);
      },
      ExportNamedDeclaration(node) {
        processESMReference(node);
      },
      CallExpression(node) {
        if (
          node.callee.type !== 'Identifier' ||
          node.callee.name !== 'require'
        ) {
          return;
        }

        const refType = getReferenceType(sourceCode, node.callee);
        if (refType !== 'global') {
          return;
        }

        const { arguments: args } = node;
        if (args.length !== 1) {
          context.report({
            node,
            messageId: 'invalidRequireCount',
          });
          return;
        }
        const [arg] = args;
        assert(arg, 'Missing arg');

        /** @type {string} */
        let source;
        if (isStringLiteral(arg)) {
          source = arg.value;
        } else if (
          arg.type === 'TSAsExpression' &&
          isStringLiteral(arg.expression)
        ) {
          source = arg.expression.value;
        } else {
          // Ignore other expressions
          return;
        }

        processUse(node, source, null);
      },
      Identifier(node) {
        if (node.name !== 'window' && node.name !== 'document') {
          return;
        }
        const refType = getReferenceType(sourceCode, node);
        if (refType == null) {
          // Not part of expression
          return;
        }
        if (refType !== 'global') {
          return;
        }
        domUses.push(node);
      },
    };
  },
});
