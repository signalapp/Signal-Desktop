// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check
import { noDisabledTests } from './noDisabledTests.mjs';
import { RuleTester } from '@typescript-eslint/rule-tester';

const ruleTester = new RuleTester();

ruleTester.run('no-disabled-tests', noDisabledTests, {
  valid: [
    { code: 'describe(() => {});' },
    { code: 'it(() => {});' },
    { code: 'test(() => {});' },
    { code: 'describe.only(() => {});' },
    { code: 'it.only(() => {});' },
    { code: 'test.only(() => {});' },
    { code: 'let describe; describe.skip(() => {});' },
    { code: 'x.describe.skip(() => {});' },
  ],
  invalid: [
    {
      code: `describe.skip(() => {});`,
      suggestion: `describe(() => {});`,
    },
    {
      code: `it.skip(() => {});`,
      suggestion: `it(() => {});`,
    },
    {
      code: `test.skip(() => {});`,
      suggestion: `test(() => {});`,
    },
    {
      code: `describe['skip'](() => {});`,
      suggestion: `describe(() => {});`,
    },
    {
      code: `it['skip'](() => {});`,
      suggestion: `it(() => {});`,
    },
    {
      code: `test['skip'](() => {});`,
      suggestion: `test(() => {});`,
    },
  ].map(opts => {
    return {
      code: opts.code,
      errors: [
        {
          messageId: 'unexpectedDisabledTest',
          suggestions: [{ messageId: 'removeSkip', output: opts.suggestion }],
        },
      ],
    };
  }),
});
