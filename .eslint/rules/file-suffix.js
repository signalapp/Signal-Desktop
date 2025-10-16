// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

const MAIN_MODULES = new Set([
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
const RENDERER_MODULES = new Set([
  'contextBridge',
  'ipcRenderer',
  'webFrame',
  'webUtils',
]);
const NODE_MODULES = new Set([
  '@electron/asar',
  '@indutny/dicer',
  '@indutny/mac-screen-share',
  '@indutny/range-finder',
  '@indutny/simple-windows-notifications',
  '@signalapp/libsignal-client',
  '@signalapp/ringrtc',
  '@signalapp/sqlcipher',
  '@signalapp/windows-ucv',
  'cirbuf',
  'config',
  'dashdash',
  'encoding',
  'fast-glob',
  'fs-extra',
  'got',
  'growing-file',
  'node-fetch',
  'proxy-agent',
  'read-last-lines',
  'websocket',
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
  'chokidar-cli',
  'cross-env',
  'electron-builder',
  'electron-mocha',
  'endanger',
  'enhanced-resolve',
  'enquirer',
  'esbuild',
  'execa',
  'html-webpack-plugin',
  'http-server',
  'json-to-ast',
  'log-symbols',
  'mini-css-extract-plugin',
  'node-gyp',
  'node-gyp-build',
  'npm-run-all',
  'p-limit',
  'pixelmatch',
  'playwright',
  'postcss',
  'postcss-loader',
  'prettier',
  'prettier-plugin-tailwindcss',
  'protobufjs-cli',
  'react-devtools',
  'react-devtools-core',
  'resedit',
  'resolve-url-loader',
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
  'terser-webpack-plugin',
  'ts-node',
  'typescript',
  'wait-on',
  'webpack',
  'webpack-cli',
  'webpack-dev-server',
]);
const DOM_MODULES = new Set([
  '@popperjs/core',
  '@radix-ui/react-tooltip',
  '@react-aria/focus',
  '@react-aria/interactions',
  '@react-aria/utils',
  '@react-spring/web',
  '@tanstack/react-virtual',
  'blob-util',
  'blueimp-load-image',
  'copy-text-to-clipboard',
  'fabric',
  'focus-trap-react',
  'radix-ui',
  'react-aria',
  'react-aria-components',
  'react-blurhash',
  'react-contextmenu',
  'react-popper',
  'react-virtualized',

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
  '@storybook/preview-api',
  '@storybook/react',
  '@storybook/react-webpack5',
  '@storybook/test',
  '@storybook/test-runner',
  '@storybook/types',
  'storybook',
]);

/** @type {import("eslint").Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    hasSuggestions: false,
    fixable: false,
    schema: [],
  },
  create(context) {
    const { filename, sourceCode } = context;

    let fileSuffix;

    const nodeUses = [];
    const domUses = [];
    const preloadUses = [];
    const mainUses = [];

    const invalidUsesBySuffix = {
      std: [nodeUses, domUses, preloadUses, mainUses],
      node: [domUses, preloadUses, mainUses],
      dom: [nodeUses, preloadUses, mainUses],
      preload: [mainUses],
      main: [domUses, preloadUses],
    };

    function trackLocalDep(node, source) {
      if (!source.endsWith('.js')) {
        return;
      }

      const match = source.match(/\.([^.\/]+)(?:\.stories)?\.js$/);
      if (match == null) {
        context.report({
          node,
          message: `Missing file suffix in ${source} import`,
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
          message:
            `Unrecognized file suffix in ${source}, ` +
            `expected: node/preload/main/std, found: ${depSuffix}`,
        });
      }
    }

    function transformESMReference(node) {
      if (
        node.importKind === 'type' ||
        (node.specifiers?.length &&
          node.specifiers.every(x => x.importKind === 'type'))
      ) {
        return;
      }
      if (!node.source) {
        return;
      }
      if (node.source.type !== 'Literal') {
        return;
      }
      const {
        specifiers,
        source: { value: source },
      } = node;

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
      if (source === 'electron') {
        for (const s of specifiers) {
          // We implicitly skip:
          // they are used in scripts
          if (s.type === 'ImportSpecifier') {
            if (MAIN_MODULES.has(s.imported.name)) {
              mainUses.push(s);
            } else if (RENDERER_MODULES.has(s.imported.name)) {
              preloadUses.push(s);
            }
          } else if (s.type === 'ImportNamespaceSpecifier') {
            // import * as electron from 'electron';
            context.report({
              node: s,
              message: 'Unsupported namespace import specifier for electron',
            });
            nodeUses.push(s);
          } else if (s.type === 'ImportDefaultSpecifier') {
            // import ELECTRON_CLI from 'electron';
            nodeUses.push(s);
          } else {
            context.report({
              node: s,
              message: 'Unsupported import specifier for electron',
            });
          }
        }

        return;
      }

      const [, moduleName] = source.match(/^([^@\/]+|@[^\/]+\/[^\/]+)/);
      if (NODE_MODULES.has(moduleName)) {
        nodeUses.push(node);
      } else if (DOM_MODULES.has(moduleName) || source === 'react-dom/client') {
        domUses.push(node);
      }
    }

    return {
      Program: node => {
        if (filename.endsWith('.d.ts')) {
          // Skip types
          return;
        }

        const match = filename.match(/\.([^.\/]+)(?:\.stories)?\.(?:ts|tsx)$/);
        if (match == null) {
          context.report({
            node: node,
            message:
              'Missing file suffix. Has to be one of: node/preload/main/std',
          });
          return;
        }

        fileSuffix = match[1];
      },
      'Program:exit': node => {
        if (fileSuffix == null) {
          return;
        }

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

        // All .std.tsx components should be .dom.tsx for now
        if (expectedSuffix === 'std' && filename.endsWith('.tsx')) {
          expectedSuffix = 'dom';
        }

        if (fileSuffix !== expectedSuffix) {
          context.report({
            node,
            message: `Invalid suffix ${fileSuffix}, expected: ${expectedSuffix}`,
          });
        }

        const invalid = invalidUsesBySuffix[expectedSuffix].flat();
        for (const use of invalid) {
          context.report({
            node: use,
            message: `Invalid import/reference for suffix: ${expectedSuffix}`,
          });
        }
      },
      ImportDeclaration(node) {
        transformESMReference(node);
      },
      ExportAllDeclaration(node) {
        transformESMReference(node);
      },
      ExportNamedDeclaration(node) {
        transformESMReference(node);
      },
      CallExpression(node) {
        if (
          node.callee.type !== 'Identifier' ||
          node.callee.name !== 'require'
        ) {
          return;
        }

        const scope = sourceCode.getScope(node);
        const ref = scope.references.find(r => r.identifier === node.callee);
        if (ref.resolved.scope.type !== 'global') {
          return;
        }
        const { arguments: args } = node;
        if (args.length !== 1) {
          context.report({
            node,
            message: 'Invalid require() argument count',
          });
          return;
        }
        const [arg] = args;

        let source;
        if (arg.type === 'Literal') {
          source = arg.value;
        } else if (
          arg.type === 'TSAsExpression' &&
          arg.expression.type === 'Literal'
        ) {
          source = arg.expression.value;
        } else {
          // Ignore other expressions
          return;
        }

        // Keep local imports
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
        if (source === 'electron') {
          context.report({
            node,
            message: 'CJS import of electron is not allowed',
          });
        }

        const [, moduleName] = source.match(/^([^@\/]+|@[^\/]+\/[^\/]+)/);
        if (NODE_MODULES.has(moduleName)) {
          nodeUses.push(node);
        } else if (
          DOM_MODULES.has(moduleName) ||
          source === 'react-dom/client'
        ) {
          domUses.push(moduleName);
        }
      },
      Identifier(node) {
        if (node.name !== 'window' && node.name !== 'document') {
          return;
        }
        const scope = sourceCode.getScope(node);
        const ref = scope.references.find(r => r.identifier === node);
        if (ref == null) {
          // Not part of expression
          return;
        }
        if (ref.resolved.scope.type !== 'global') {
          return;
        }
        domUses.push(node);
      },
    };
  },
};
