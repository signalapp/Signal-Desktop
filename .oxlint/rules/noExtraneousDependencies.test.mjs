// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check
import path from 'node:path';
import { noExtraneousDependencies } from './noExtraneousDependencies.mjs';
import { RuleTester } from '@typescript-eslint/rule-tester';

/**
 * @typedef {import("./noExtraneousDependencies.mjs").Options} Options
 */

const ruleTester = new RuleTester();

const filename = path.join(
  import.meta.dirname,
  'fixtures/noExtraneousDependencies/package/foo.js'
);

/** @type {Options} */
const NONE = {
  devDependencies: false,
  peerDependencies: false,
  optionalDependencies: false,
  bundledDependencies: false,
};

/**
 * @satisfies {Record<string, [Options]>}
 */
const opts = {
  none: [NONE],
  dev: [{ ...NONE, devDependencies: true }],
  peer: [{ ...NONE, peerDependencies: true }],
  optional: [{ ...NONE, optionalDependencies: true }],
  bundled: [{ ...NONE, bundledDependencies: true }],
};

ruleTester.run('no-extraneous-dependencies', noExtraneousDependencies, {
  valid: [
    { filename, code: `import a from "./a";`, options: opts.none },
    { filename, code: `import a from "../a";`, options: opts.none },
    { filename, code: `import a from "path";`, options: opts.none },
    { filename, code: `import a from "node:path";`, options: opts.none },
    { filename, code: `import a from "";`, options: opts.none },
    { filename, code: `import a from "prod-dep";`, options: opts.none },
    { filename, code: `import a from "prod-dep/nested";`, options: opts.none },
    { filename, code: `import a from "@scoped/prod-dep";`, options: opts.none },
    {
      filename,
      code: `import a from "@scoped/prod-dep/nested";`,
      options: opts.none,
    },
    { filename, code: `import a from "dev-dep";`, options: opts.dev },
    { filename, code: `import a from "peer-dep";`, options: opts.peer },
    {
      filename,
      code: `import a from "optional-dep";`,
      options: opts.optional,
    },
    { filename, code: `import a from "bundled-dep";`, options: opts.bundled },
  ],
  invalid: [
    {
      filename,
      code: `import a from "dev-dep";`,
      options: opts.none,
      errors: [{ messageId: 'wrongProjectDeps' }],
    },
    {
      filename,
      code: `import a from "peer-dep";`,
      options: opts.none,
      errors: [{ messageId: 'wrongProjectDeps' }],
    },
    {
      filename,
      code: `import a from "optional-dep";`,
      options: opts.none,
      errors: [{ messageId: 'wrongProjectDeps' }],
    },
    {
      filename,
      code: `import a from "bundled-dep";`,
      options: opts.none,
      errors: [{ messageId: 'wrongProjectDeps' }],
    },
    {
      filename,
      code: `import a from "dev-dep";`,
      options: opts.peer,
      errors: [{ messageId: 'wrongProjectDeps' }],
    },
    {
      filename,
      code: `import a from "dev-dep";`,
      options: opts.optional,
      errors: [{ messageId: 'wrongProjectDeps' }],
    },
    {
      filename,
      code: `import a from "dev-dep";`,
      options: opts.bundled,
      errors: [{ messageId: 'wrongProjectDeps' }],
    },
    {
      filename,
      code: `import a from "does-not-exist";`,
      options: opts.bundled,
      errors: [{ messageId: 'missingFromProjectDeps' }],
    },
  ],
});
