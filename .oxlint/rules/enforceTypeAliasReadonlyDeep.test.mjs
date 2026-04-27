// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check
import { enforceTypeAliasReadonlyDeep } from './enforceTypeAliasReadonlyDeep.mjs';
import { RuleTester } from '@typescript-eslint/rule-tester';

const ruleTester = new RuleTester();

ruleTester.run('type-alias-readonlydeep', enforceTypeAliasReadonlyDeep, {
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
      errors: [{ messageId: 'needsReadonlyDeep' }],
    },
    {
      code: `type Foo = Bar<{}>`,
      errors: [{ messageId: 'needsReadonlyDeep' }],
    },
    {
      code: `type Foo = ReadonlyDeep<{}>`,
      errors: [{ messageId: 'needsReadonlyDeep' }],
    },
    {
      code: `interface ReadonlyDeep<T> {}; type Foo = ReadonlyDeep<{}>`,
      errors: [{ messageId: 'needsReadonlyDeep' }],
    },
    {
      code: `import type { ReadonlyDeep } from "foo"; type Foo = ReadonlyDeep<{}>`,
      errors: [{ messageId: 'needsReadonlyDeep' }],
    },
  ],
});
