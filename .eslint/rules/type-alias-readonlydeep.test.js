// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

const rule = require('./type-alias-readonlydeep');
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

ruleTester.run('type-alias-readonlydeep', rule, {
  valid: [
    {
      code: `import type { ReadonlyDeep } from "type-fest"; type Foo = ReadonlyDeep<{}>`,
    },
    {
      code: `import { ReadonlyDeep } from "type-fest"; type Foo = ReadonlyDeep<{}>`,
    },
  ],
  invalid: [
    {
      code: `type Foo = {}`,
      errors: [
        {
          message:
            'Type aliases must be wrapped with ReadonlyDeep from type-fest',
          type: 'Identifier',
        },
      ],
    },
    {
      code: `type Foo = Bar<{}>`,
      errors: [
        {
          message:
            'Type aliases must be wrapped with ReadonlyDeep from type-fest',
          type: 'Identifier',
        },
      ],
    },
    {
      code: `type Foo = ReadonlyDeep<{}>`,
      errors: [
        {
          message:
            'Type aliases must be wrapped with ReadonlyDeep from type-fest',
          type: 'Identifier',
        },
      ],
    },
    {
      code: `interface ReadonlyDeep<T> {}; type Foo = ReadonlyDeep<{}>`,
      errors: [
        {
          message:
            'Type aliases must be wrapped with ReadonlyDeep from type-fest',
          type: 'Identifier',
        },
      ],
    },
    {
      code: `import type { ReadonlyDeep } from "foo"; type Foo = ReadonlyDeep<{}>`,
      errors: [
        {
          message:
            'Type aliases must be wrapped with ReadonlyDeep from type-fest',
          type: 'Identifier',
        },
      ],
    },
  ],
});
