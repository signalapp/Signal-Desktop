// Copyright 2018-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable no-console */
import * as fs from 'fs';
import { join, relative } from 'path';
import normalizePath from 'normalize-path';
import pMap from 'p-map';
import FastGlob from 'fast-glob';

import { ExceptionType, REASONS, RuleType } from './types';
import { ENCODING, loadJSON, sortExceptions } from './util';

const ALL_REASONS = REASONS.join('|');

function getExceptionKey(
  exception: Pick<ExceptionType, 'rule' | 'path' | 'lineNumber'>
): string {
  return `${exception.rule}-${exception.path}-${exception.lineNumber}`;
}

function createLookup(
  list: ReadonlyArray<ExceptionType>
): { [key: string]: ExceptionType } {
  const lookup = Object.create(null);

  list.forEach((exception: ExceptionType) => {
    const key = getExceptionKey(exception);

    if (lookup[key]) {
      throw new Error(`Duplicate exception found for key ${key}`);
    }

    lookup[key] = exception;
  });

  return lookup;
}

const rulesPath = join(__dirname, 'rules.json');
const exceptionsPath = join(__dirname, 'exceptions.json');
const basePath = join(__dirname, '../../..');

const searchPattern = normalizePath(join(basePath, '**/*.{js,ts,tsx}'));

const excludedFilesRegexps = [
  // Non-distributed files
  '\\.d\\.ts$',

  // High-traffic files in our project
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

  // Generated files
  '^js/components.js',
  '^js/curve/',
  '^js/libtextsecure.js',
  '^js/util_worker.js',
  '^libtextsecure/components.js',
  '^libtextsecure/test/test.js',
  '^sticker-creator/dist/bundle.js',
  '^test/test.js',
  '^ts/test[^/]*/.+',

  // From libsignal-protocol-javascript project
  '^libtextsecure/libsignal-protocol.js',

  // Copied from dependency
  '^js/Mp3LameEncoder.min.js',

  // Test files
  '^libtextsecure/test/.+',
  '^test/.+',

  // Modules we trust
  '^node_modules/core-js-pure/.+',
  '^node_modules/core-js/.+',
  '^node_modules/fbjs/.+',
  '^node_modules/lodash/.+',
  '^node_modules/react/.+',
  '^node_modules/react-contextmenu/.+',
  '^node_modules/react-dom/.+',
  '^node_modules/react-dropzone/.+',
  '^node_modules/react-hot-loader/.+',
  '^node_modules/react-icon-base/.+',
  '^node_modules/react-input-autosize/.+',
  '^node_modules/react-measure/.+',
  '^node_modules/react-popper/.+',
  '^node_modules/react-redux/.+',
  '^node_modules/react-router/.+',
  '^node_modules/react-router-dom/.+',
  '^node_modules/react-select/.+',
  '^node_modules/react-sortable-hoc/.+',
  '^node_modules/react-transition-group/.+',
  '^node_modules/react-virtualized/.+',
  '^node_modules/reactcss/.+',
  '^node_modules/snyk/.+',
  '^node_modules/snyk-resolve-deps/.+',
  '^node_modules/snyk-try-require/.+',
  '^node_modules/@snyk/.+',

  // Submodules we trust
  '^node_modules/react-color/.+/(?:core-js|fbjs|lodash)/.+',

  // Modules used only in test/development scenarios
  '^node_modules/@babel/.+',
  '^node_modules/@svgr/.+',
  '^node_modules/@types/.+',
  '^node_modules/@webassemblyjs/.+',
  '^node_modules/ajv/.+',
  '^node_modules/amdefine/.+',
  '^node_modules/ansi-colors/.+',
  '^node_modules/anymatch/.+',
  '^node_modules/app-builder-lib/.+',
  '^node_modules/archiver-utils/.+', // Used by spectron
  '^node_modules/archiver/.+', // Used by spectron
  '^node_modules/asn1\\.js/.+',
  '^node_modules/autoprefixer/.+',
  '^node_modules/babel.+',
  '^node_modules/bluebird/.+',
  '^node_modules/body-parser/.+',
  '^node_modules/bower/.+',
  '^node_modules/buble/.+',
  '^node_modules/builder-util-runtime/.+',
  '^node_modules/builder-util/.+',
  '^node_modules/catharsis/.+',
  '^node_modules/chai/.+',
  '^node_modules/clean-css/.+',
  '^node_modules/cli-table2/.+',
  '^node_modules/codemirror/.+',
  '^node_modules/coffee-script/.+',
  '^node_modules/compression/.+',
  '^node_modules/cross-env/.+',
  '^node_modules/css-loader/.+',
  '^node_modules/css-modules-loader-core/.+',
  '^node_modules/css-selector-tokenizer/.+',
  '^node_modules/css-tree/.+',
  '^node_modules/csso/.+',
  '^node_modules/degenerator/.+',
  '^node_modules/detect-port-alt/.+',
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
  '^node_modules/escodegen/.+',
  '^node_modules/eslint.+',
  '^node_modules/@typescript-eslint.+',
  '^node_modules/esprima/.+',
  '^node_modules/express/.+',
  '^node_modules/file-loader/.+',
  '^node_modules/file-system-cache/.+', // Currently only used in storybook
  '^node_modules/finalhandler/.+',
  '^node_modules/fsevents/.+',
  '^node_modules/globule/.+',
  '^node_modules/grunt-cli/.+',
  '^node_modules/grunt-contrib-concat/.+',
  '^node_modules/grunt-contrib-watch/.+',
  '^node_modules/grunt-gitinfo/.+',
  '^node_modules/grunt-legacy-log-utils/.+',
  '^node_modules/grunt-legacy-log/.+',
  '^node_modules/grunt-legacy-util/.+',
  '^node_modules/grunt/.+',
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
  '^node_modules/jsdoc/.+',
  '^node_modules/jss-global/.+',
  '^node_modules/jss/.+',
  '^node_modules/livereload-js/.+',
  '^node_modules/lolex/.+',
  '^node_modules/magic-string/.+',
  '^node_modules/markdown-it/.+',
  '^node_modules/minimatch/.+',
  '^node_modules/mocha/.+',
  '^node_modules/nise/.+',
  '^node_modules/node-sass-import-once/.+',
  '^node_modules/node-sass/.+',
  '^node_modules/npm-run-all/.+',
  '^node_modules/nsp/.+',
  '^node_modules/nyc/.+',
  '^node_modules/phantomjs-prebuilt/.+',
  '^node_modules/postcss.+',
  '^node_modules/preserve/.+',
  '^node_modules/prettier/.+',
  '^node_modules/prop-types/.+',
  '^node_modules/protobufjs/cli/.+',
  '^node_modules/ramda/.+',
  '^node_modules/react-dev-utils/.+',
  '^node_modules/react-docgen/.+',
  '^node_modules/react-error-overlay/.+',
  '^node_modules/read-pkg/.+', // Used by npm-run-all
  '^node_modules/recast/.+',
  '^node_modules/reduce-css-calc/.+',
  '^node_modules/requizzle/.+',
  '^node_modules/resolve/.+',
  '^node_modules/sass-graph/.+',
  '^node_modules/sass-loader/.+',
  '^node_modules/scss-tokenizer/.+',
  '^node_modules/send/.+',
  '^node_modules/serve-index/.+',
  '^node_modules/sinon/.+',
  '^node_modules/snapdragon-util/.+',
  '^node_modules/snapdragon/.+',
  '^node_modules/sockjs-client/.+',
  '^node_modules/spectron/.+',
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

  // Used by Storybook
  '^node_modules/@emotion/.+',
  '^node_modules/@storybook/.+',
  '^node_modules/cosmiconfig/.+',
  '^node_modules/create-emotion/.+',
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
].map(str => new RegExp(str));

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

async function main(): Promise<void> {
  const now = new Date();

  const rules: Array<RuleType> = loadJSON(rulesPath);
  setupRules(rules);

  const exceptions: Array<ExceptionType> = loadJSON(exceptionsPath);
  const exceptionsLookup = createLookup(exceptions);

  const results: Array<ExceptionType> = [];
  let scannedCount = 0;

  await pMap(
    await FastGlob(searchPattern, { onlyFiles: true }),
    async (file: string) => {
      const relativePath = relative(basePath, file).replace(/\\/g, '/');

      const isFileExcluded = excludedFilesRegexps.some(excludedRegexp =>
        excludedRegexp.test(relativePath)
      );
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

        lines.forEach((line: string, lineIndex: number) => {
          if (!rule.regex.test(line)) {
            return;
          }
          // recreate this rule since it has g flag, and carries local state
          if (rule.expression) {
            // eslint-disable-next-line no-param-reassign
            rule.regex = new RegExp(rule.expression, 'g');
          }

          const lineNumber = lineIndex + 1;

          const exceptionKey = getExceptionKey({
            rule: rule.name,
            path: relativePath,
            lineNumber,
          });

          const exception = exceptionsLookup[exceptionKey];
          if (exception && (!exception.line || exception.line === line)) {
            delete exceptionsLookup[exceptionKey];

            return;
          }

          results.push({
            rule: rule.name,
            path: relativePath,
            line: line.length < 300 ? line : undefined,
            lineNumber,
            reasonCategory: ALL_REASONS,
            updated: now.toJSON(),
            reasonDetail: '<optional>',
          });
        });
      });
    },
    // Without this, we may run into "too many open files" errors.
    { concurrency: 100 }
  );

  const unusedExceptions = Object.values(exceptionsLookup);

  console.log(
    `${scannedCount} files scanned.`,
    `${results.length} questionable lines,`,
    `${unusedExceptions.length} unused exceptions,`,
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
    console.log('Unused exceptions!');
    console.log(JSON.stringify(sortExceptions(unusedExceptions), null, '  '));
  }

  process.exit(1);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
