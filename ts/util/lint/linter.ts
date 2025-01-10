// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable no-console */
import * as fs from 'fs';
import { join, relative } from 'path';
import normalizePath from 'normalize-path';
import pMap from 'p-map';
import FastGlob from 'fast-glob';

import type { ExceptionType, RuleType } from './types';
import { REASONS } from './types';
import { ENCODING, loadJSON, sortExceptions, writeExceptions } from './util';

const ALL_REASONS = REASONS.join('|');

const rulesPath = join(__dirname, 'rules.json');
const exceptionsPath = join(__dirname, 'exceptions.json');
const basePath = join(__dirname, '../../..');

const searchPattern = normalizePath(join(basePath, '**/*.{js,ts,tsx}'));

const excludedFilesRegexp = RegExp(
  [
    '^release/',
    '^preload.bundle.js(LICENSE.txt|map)?',
    '^bundles/',
    '^storybook-static/',

    // Non-distributed files
    '\\.d\\.ts$',
    '.+\\.stories\\.js',
    '.+\\.stories\\.tsx',

    // Compiled files
    '^ts/.+\\.js',

    // High-traffic files in our project
    '^app/.+(ts|js)',
    '^ts/models/messages.js',
    '^ts/models/messages.ts',
    '^ts/models/conversations.js',
    '^ts/models/conversations.ts',
    '^ts/views/conversation_view.js',
    '^ts/views/conversation_view.ts',
    '^ts/background.js',
    '^ts/background.ts',
    '^ts/Crypto.js',
    '^ts/Crypto.ts',
    '^ts/textsecure/MessageReceiver.js',
    '^ts/textsecure/MessageReceiver.ts',
    '^ts/ConversationController.js',
    '^ts/ConversationController.ts',
    '^ts/SignalProtocolStore.ts',
    '^ts/SignalProtocolStore.js',
    '^ts/textsecure/[^./]+.ts',
    '^ts/textsecure/[^./]+.js',

    // Generated files
    '^js/components.js',
    '^js/curve/',
    '^js/util_worker.js',
    '^libtextsecure/test/test.js',
    '^test/test.js',
    '^ts/workers/heicConverter.bundle.js',
    '^ts/sql/mainWorker.bundle.js',

    // Copied from dependency
    '^js/Mp3LameEncoder.min.js',

    // Test files
    '^libtextsecure/test/.+',
    '^test/.+',
    '^ts/test[^/]*/.+',

    // Github workflows
    '^.github/.+',

    // Modules we trust
    '^node_modules/@react-aria/.+',
    '^node_modules/@react-stately/.+',
    '^node_modules/@signalapp/libsignal-client/.+',
    '^node_modules/core-js-pure/.+',
    '^node_modules/core-js/.+',
    '^node_modules/fbjs/.+',
    '^node_modules/lodash/.+',
    '^node_modules/react/.+',
    '^node_modules/react-aria-components/.+',
    '^node_modules/react-contextmenu/.+',
    '^node_modules/react-dom/.+',
    '^node_modules/react-hot-loader/.+',
    '^node_modules/react-icon-base/.+',
    '^node_modules/react-input-autosize/.+',
    '^node_modules/react-popper/.+',
    '^node_modules/react-redux/.+',
    '^node_modules/react-router/.+',
    '^node_modules/react-router-dom/.+',
    '^node_modules/react-select/.+',
    '^node_modules/react-transition-group/.+',
    '^node_modules/react-virtualized/.+',
    '^node_modules/reactcss/.+',
    '^node_modules/snyk/.+',
    '^node_modules/snyk-resolve-deps/.+',
    '^node_modules/snyk-try-require/.+',
    '^node_modules/@snyk/.+',
    '^node_modules/use-sync-external-store/.+',

    // Submodules we trust
    '^node_modules/react-color/.+/(?:core-js|fbjs|lodash)/.+',

    // Modules used only in test/development scenarios
    '^node_modules/@babel/.+',
    '^node_modules/@chanzuckerberg/axe-storybook-testing/.+',
    '^node_modules/@humanwhocodes/config-array/.+',
    '^node_modules/@mixer/parallel-prettier/.+',
    '^node_modules/@eslint/.+',
    '^node_modules/@signalapp/mock-server/.+',
    '^node_modules/@svgr/.+',
    '^node_modules/@types/.+',
    '^node_modules/@webassemblyjs/.+',
    '^node_modules/@electron/.+',
    '^node_modules/ajv/.+',
    '^node_modules/ajv-keywords/.+',
    '^node_modules/amdefine/.+',
    '^node_modules/ansi-styles/.+',
    '^node_modules/ansi-colors/.+',
    '^node_modules/anymatch/.+',
    '^node_modules/app-builder-lib/.+',
    '^node_modules/asn1\\.js/.+',
    '^node_modules/autoprefixer/.+',
    '^node_modules/babel.+',
    '^node_modules/bluebird/.+',
    '^node_modules/body-parser/.+',
    '^node_modules/bower/.+',
    '^node_modules/braces/.+',
    '^node_modules/buble/.+',
    '^node_modules/builder-util-runtime/.+',
    '^node_modules/builder-util/.+',
    '^node_modules/catharsis/.+',
    '^node_modules/chai/.+',
    '^node_modules/chokidar/.+',
    '^node_modules/clean-css/.+',
    '^node_modules/cli-table2/.+',
    '^node_modules/cliui/.+',
    '^node_modules/codemirror/.+',
    '^node_modules/coffee-script/.+',
    '^node_modules/compression/.+',
    '^node_modules/cross-env/.+',
    '^node_modules/css-loader/.+',
    '^node_modules/css-modules-loader-core/.+',
    '^node_modules/css-selector-tokenizer/.+',
    '^node_modules/css-tree/.+',
    '^node_modules/csso/.+',
    '^node_modules/danger/.+',
    '^node_modules/default-gateway/.+',
    '^node_modules/degenerator/.+',
    '^node_modules/detect-port-alt/.+',
    '^node_modules/dmg-builder/.+',
    '^node_modules/electron-builder/.+',
    '^node_modules/electron-chromedriver/.+',
    '^node_modules/electron-icon-maker/.+',
    '^node_modules/electron-mocha/',
    '^node_modules/electron-osx-sign/.+',
    '^node_modules/electron-publish/.+',
    '^node_modules/emotion/.+', // Currently only used in storybook
    '^node_modules/es-abstract/.+',
    '^node_modules/es5-shim/.+', // Currently only used in storybook
    '^node_modules/es6-shim/.+', // Currently only used in storybook
    '^node_modules/esbuild/.+',
    '^node_modules/escodegen/.+',
    '^node_modules/eslint.+',
    '^node_modules/espree.+',
    '^node_modules/@typescript-eslint.+',
    '^node_modules/esprima/.+',
    '^node_modules/express/.+',
    '^node_modules/fast-glob/.+',
    '^node_modules/file-entry-cache/.+',
    '^node_modules/file-system-cache/.+', // Currently only used in storybook
    '^node_modules/finalhandler/.+',
    '^node_modules/flat-cache/.+',
    '^node_modules/foreground-chat/.+',
    '^node_modules/fsevents/.+',
    '^node_modules/gauge/.+',
    '^node_modules/global-agent/.+',
    '^node_modules/globby/.+',
    '^node_modules/globule/.+',
    '^node_modules/handle-thing/.+',
    '^node_modules/handlebars/.+', // Used by nyc#istanbul-reports
    '^node_modules/har-validator/.+',
    '^node_modules/highlight\\.js/.+',
    '^node_modules/hpack\\.js/.+',
    '^node_modules/http-proxy-middlewar/.+',
    '^node_modules/icss-utils/.+',
    '^node_modules/intl-tel-input/examples/.+',
    '^node_modules/istanbul.+',
    '^node_modules/jimp/.+',
    '^node_modules/jquery/.+',
    '^node_modules/jake/.+',
    '^node_modules/js-sdsl/.+',
    '^node_modules/jss-global/.+',
    '^node_modules/jss/.+',
    '^node_modules/liftup/.+',
    '^node_modules/livereload-js/.+',
    '^node_modules/lolex/.+',
    '^node_modules/log-symbols/.+',
    '^node_modules/magic-string/.+',
    '^node_modules/markdown-it/.+',
    '^node_modules/meow/.+',
    '^node_modules/minimatch/.+',
    '^node_modules/mocha/.+',
    '^node_modules/needle/.+',
    '^node_modules/nise/.+',
    '^node_modules/node-gyp/.+',
    '^node_modules/normalize-package-data/.+',
    '^node_modules/npm-run-all/.+',
    '^node_modules/nsp/.+',
    '^node_modules/nyc/.+',
    '^node_modules/optionator/.+',
    '^node_modules/plist/.+',
    '^node_modules/phantomjs-prebuilt/.+',
    '^node_modules/playwright/.+',
    '^node_modules/playwright-core/.+',
    '^node_modules/postcss.+',
    '^node_modules/preserve/.+',
    '^node_modules/prettier/.+',
    '^node_modules/prop-types/.+',
    '^node_modules/protobufjs/cli/.+',
    '^node_modules/ramda/.+',
    '^node_modules/rambda/.+',
    '^node_modules/react-devtools/.+',
    '^node_modules/react-devtools-core/.+',
    '^node_modules/react-dev-utils/.+',
    '^node_modules/react-docgen/.+',
    '^node_modules/react-error-overlay/.+',
    '^node_modules/read-config-file/.+', // Used by electron-builder
    '^node_modules/read-pkg/.+', // Used by npm-run-all
    '^node_modules/recast/.+',
    '^node_modules/rechoir/.+',
    '^node_modules/reduce-css-calc/.+',
    '^node_modules/requizzle/.+',
    '^node_modules/resolve/.+',
    '^node_modules/sass-graph/.+',
    '^node_modules/sass-loader/.+',
    '^node_modules/sass/.+',
    '^node_modules/schema-utils/.+',
    '^node_modules/scss-tokenizer/.+',
    '^node_modules/send/.+',
    '^node_modules/serve-index/.+',
    '^node_modules/sinon/.+',
    '^node_modules/snapdragon-util/.+',
    '^node_modules/snapdragon/.+',
    '^node_modules/sockjs-client/.+',
    '^node_modules/style-loader/.+',
    '^node_modules/svgo/.+',
    '^node_modules/terser/.+',
    '^node_modules/testcheck/.+',
    '^node_modules/text-encoding/.+',
    '^node_modules/tiny-lr/.+', // Used by grunt-contrib-watch
    '^node_modules/tinycolor2/.+',
    '^node_modules/to-ast/.+',
    '^node_modules/trough/.+',
    '^node_modules/ts-loader/.+',
    '^node_modules/ts-node/.+',
    '^node_modules/tweetnacl/.+',
    '^node_modules/typed-scss-modules/.+',
    '^node_modules/typescript/.+',
    '^node_modules/uglify-es/.+',
    '^node_modules/uglify-js/.+',
    '^node_modules/url-loader/.+',
    '^node_modules/use/.+',
    '^node_modules/vary/.+',
    '^node_modules/vm-browserify/.+',
    '^node_modules/webdriverio/.+',
    '^node_modules/webpack/.+',
    '^node_modules/xml-parse-from-string/.+',
    '^node_modules/xmlbuilder/.+',
    '^node_modules/xmldom/.+',
    '^node_modules/yargs-unparser/',
    '^node_modules/yargs/.+',
    '^node_modules/find-yarn-workspace-root/.+',
    '^node_modules/unzipper/node_modules/bluebird/.+',
    '^node_modules/update-notifier/.+',
    '^node_modules/windows-release/.+',

    // used by danger
    '^danger/node_modules/.+',
    '^node_modules/@octokit/.+',
    '^node_modules/test-exclude/.+',
    '^node_modules/micromark/.+',
    '^node_modules/micromark-extension-gfm-task-list-item/.+',
    '^node_modules/micromark-extension-gfm-autolink-literal/.+',
    '^node_modules/memfs-or-file-map-to-github-branch/.+',
    '^node_modules/mdast-util-to-markdown/.+',
    '^node_modules/mdast-util-from-markdown/.+',
    '^node_modules/lodash.once/.+',
    '^node_modules/gitlab/.+',
    '^node_modules/es6-promisify/.+',
    '^node_modules/endanger/.+',
    '^node_modules/cpy/.+',
    '^node_modules/buffer-equal-constant-time/.+',
    '^node_modules/universal-url/.+',
    '^node_modules/extglob/.+',

    // Used by Storybook
    '^node_modules/@emotion/.+',
    '^node_modules/@pmmmwh/react-refresh-webpack-plugin/.+',
    '^node_modules/@storybook/.+',
    '^node_modules/cosmiconfig/.+',
    '^node_modules/create-emotion/.+',
    '^node_modules/fork-ts-checker-webpack-plugin/.+',
    '^node_modules/gzip-size/.+',
    '^node_modules/markdown-to-jsx/.+',
    '^node_modules/mini-css-extract-plugin/.+',
    '^node_modules/polished.+',
    '^node_modules/prismjs/.+',
    '^node_modules/react-draggable/.+',
    '^node_modules/refractor/.+',
    '^node_modules/regexpu-core/.+',
    '^node_modules/shelljs/.+',
    '^node_modules/simplebar/.+',
    '^node_modules/store2/.+',
    '^node_modules/telejson/.+',
    '^node_modules/watchpack-chokidar2/.+',

    // Used by Webpack
    '^node_modules/css-select/.+', // Used by html-webpack-plugin
    '^node_modules/dotenv-webpack/.+',
    '^node_modules/follow-redirects/.+', // Used by webpack-dev-server
    '^node_modules/html-webpack-plugin/.+',
    '^node_modules/selfsigned/.+', // Used by webpack-dev-server
    '^node_modules/portfinder/.+',
    '^node_modules/renderkid/.+', // Used by html-webpack-plugin
    '^node_modules/spdy-transport/.+', // Used by webpack-dev-server
    '^node_modules/spdy/.+', // Used by webpack-dev-server
    '^node_modules/uglifyjs-webpack-plugin/.+',
    '^node_modules/v8-compile-cache/.+', // Used by webpack-cli
    '^node_modules/watchpack/.+', // Used by webpack
    '^node_modules/webpack-cli/.+',
    '^node_modules/webpack-dev-middleware/.+',
    '^node_modules/webpack-dev-server/.+',
    '^node_modules/webpack-hot-middleware/.+',
    '^node_modules/webpack-merge/.+',
    '^node_modules/webpack/.+',

    // Sticker Creator
    '^sticker-creator/.+',
  ].join('|')
);

function setupRules(allRules: Array<RuleType>) {
  allRules.forEach((rule: RuleType, index: number) => {
    if (!rule.name) {
      throw new Error(`Rule at index ${index} is missing a name`);
    }

    if (!rule.expression) {
      throw new Error(`Rule '${rule.name}' is missing an expression`);
    }

    // eslint-disable-next-line no-param-reassign
    rule.regex = new RegExp(rule.expression, 'g');
  });
}

async function main(argv: ReadonlyArray<string>): Promise<void> {
  const shouldRemoveUnusedExceptions = argv.includes(
    '--remove-unused-exceptions'
  );

  const now = new Date();

  const rules: Array<RuleType> = loadJSON(rulesPath);
  setupRules(rules);

  const exceptions: Array<ExceptionType> = loadJSON(exceptionsPath);
  let unusedExceptions = exceptions;

  const results: Array<ExceptionType> = [];
  let scannedCount = 0;

  await pMap(
    await FastGlob(searchPattern, { onlyFiles: true }),
    async (file: string) => {
      const relativePath = relative(basePath, file).replace(/\\/g, '/');

      const isFileExcluded = excludedFilesRegexp.test(relativePath);
      if (isFileExcluded) {
        return;
      }

      scannedCount += 1;

      const lines = (await fs.promises.readFile(file, ENCODING)).split(/\r?\n/);

      rules.forEach((rule: RuleType) => {
        const excludedModules = rule.excludedModules || [];
        if (excludedModules.some(module => relativePath.startsWith(module))) {
          return;
        }

        lines.forEach((line: string) => {
          if (!rule.regex.test(line)) {
            return;
          }
          // recreate this rule since it has g flag, and carries local state
          if (rule.expression) {
            // eslint-disable-next-line no-param-reassign
            rule.regex = new RegExp(rule.expression, 'g');
          }

          const matchedException = unusedExceptions.find(
            exception =>
              exception.rule === rule.name &&
              exception.path === relativePath &&
              (line.length < 300
                ? exception.line?.trim() === line.trim()
                : exception.line === undefined)
          );

          if (matchedException) {
            unusedExceptions = unusedExceptions.filter(
              exception => exception !== matchedException
            );
          } else {
            results.push({
              rule: rule.name,
              path: relativePath,
              line: line.length < 300 ? line : undefined,
              reasonCategory: ALL_REASONS,
              updated: now.toJSON(),
              reasonDetail: '<optional>',
            });
          }
        });
      });
    },
    // Without this, we may run into "too many open files" errors.
    { concurrency: 100 }
  );

  let unusedExceptionsLogMessage: string;

  if (shouldRemoveUnusedExceptions && unusedExceptions.length) {
    unusedExceptionsLogMessage = `${unusedExceptions.length} unused exceptions (automatically removed),`;

    const unusedExceptionsSet = new Set(unusedExceptions);
    const newExceptions = exceptions.filter(
      exception => !unusedExceptionsSet.has(exception)
    );
    writeExceptions(exceptionsPath, newExceptions);

    unusedExceptions = [];
  } else {
    unusedExceptionsLogMessage = `${unusedExceptions.length} unused exceptions,`;
  }

  console.log(
    `${scannedCount} files scanned.`,
    `${results.length} questionable lines,`,
    unusedExceptionsLogMessage,
    `${exceptions.length} total exceptions.`
  );

  if (results.length === 0 && unusedExceptions.length === 0) {
    process.exit();
  }

  console.log();
  console.log('Questionable lines:');
  console.log(JSON.stringify(sortExceptions(results), null, '  '));

  if (unusedExceptions.length) {
    console.log();
    console.log(
      'Unused exceptions! Run with --remove-unused-exceptions to automatically remove them.'
    );
    console.log(JSON.stringify(sortExceptions(unusedExceptions), null, '  '));
  }

  process.exit(1);
}

main(process.argv).catch(err => {
  console.error(err);
  process.exit(1);
});
