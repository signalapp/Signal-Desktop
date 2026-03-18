// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

const rule = require('./enforce-array-buffer');
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

const EXPECTED_ARRAY_ERROR = {
  message: 'Should be Uint8Array<ArrayBuffer>',
  type: 'TSTypeReference',
};

const EXPECTED_BUFFER_ERROR = {
  message: 'Should be Buffer<ArrayBuffer>',
  type: 'TSTypeReference',
};

ruleTester.run('enforce-array-buffer', rule, {
  valid: [
    { code: 'type T = number;' },
    { code: 'type T = Uint16Array;' },
    { code: 'type T = Uint8Array<ArrayBuffer>;' },
    { code: 'type T = Uint8Array<SharedArrayBuffer>;' },
    { code: 'type T = Uint8Array<ArrayBufferLike>;' },
    { code: 'type T = Uint8Array<U>;' },
    { code: 'function f(): Uint8Array<ArrayBuffer> {}' },
    { code: 'function f(p: Uint8Array<ArrayBuffer>) {}' },
    { code: 'let v: Uint8Array<ArrayBuffer>;' },
    { code: 'let v = new Uint8Array();' },
    { code: 'let v = new Uint8Array<ArrayBuffer>();' },
    { code: 'let v = Uint8Array.of();' },
    { code: 'let v = Uint8Array.from();' },
    { code: 'let v: { p: Uint8Array<ArrayBuffer> };' },
    { code: 'type T = Buffer<ArrayBuffer>;' },
    { code: 'type T = Buffer<SharedArrayBuffer>;' },
    { code: 'type T = Buffer<ArrayBufferLike>;' },
    { code: 'type T = Buffer<U>;' },
    { code: 'let v = new Buffer();' },
    { code: 'let v = Buffer.from();' },
  ],
  invalid: [
    {
      code: `type T = Uint8Array`,
      output: `type T = Uint8Array<ArrayBuffer>`,
      errors: [EXPECTED_ARRAY_ERROR],
    },
    {
      code: `function f(): Uint8Array {}`,
      output: `function f(): Uint8Array<ArrayBuffer> {}`,
      errors: [EXPECTED_ARRAY_ERROR],
    },
    {
      code: `function f(p: Uint8Array) {}`,
      output: `function f(p: Uint8Array<ArrayBuffer>) {}`,
      errors: [EXPECTED_ARRAY_ERROR],
    },
    {
      code: `let v: Uint8Array;`,
      output: `let v: Uint8Array<ArrayBuffer>;`,
      errors: [EXPECTED_ARRAY_ERROR],
    },
    {
      code: `let v: { p: Uint8Array };`,
      output: `let v: { p: Uint8Array<ArrayBuffer> };`,
      errors: [EXPECTED_ARRAY_ERROR],
    },
    {
      code: `type T = Buffer`,
      output: `type T = Buffer<ArrayBuffer>`,
      errors: [EXPECTED_BUFFER_ERROR],
    },
  ],
});
