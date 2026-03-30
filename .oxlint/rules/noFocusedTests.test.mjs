// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check
import { noFocusedTests } from './noFocusedTests.mjs';
import { RuleTester } from '@typescript-eslint/rule-tester';

const ruleTester = new RuleTester();

ruleTester.run('no-focused-tests', noFocusedTests, {
  valid: [
    { code: 'describe(() => {});' },
    { code: 'it(() => {});' },
    { code: 'test(() => {});' },
    { code: 'describe.skip(() => {});' },
    { code: 'it.skip(() => {});' },
    { code: 'test.skip(() => {});' },
    { code: 'let describe; describe.only(() => {});' },
    { code: 'x.describe.only(() => {});' },
  ],
  invalid: [
    {
      code: `describe.only(() => {});`,
      output: `describe(() => {});`,
      errors: [{ messageId: 'unexpectedFocusedTest' }],
    },
    {
      code: `it.only(() => {});`,
      output: `it(() => {});`,
      errors: [{ messageId: 'unexpectedFocusedTest' }],
    },
    {
      code: `test.only(() => {});`,
      output: `test(() => {});`,
      errors: [{ messageId: 'unexpectedFocusedTest' }],
    },
    {
      code: `describe['only'](() => {});`,
      output: `describe(() => {});`,
      errors: [{ messageId: 'unexpectedFocusedTest' }],
    },
    {
      code: `it['only'](() => {});`,
      output: `it(() => {});`,
      errors: [{ messageId: 'unexpectedFocusedTest' }],
    },
    {
      code: `test['only'](() => {});`,
      output: `test(() => {});`,
      errors: [{ messageId: 'unexpectedFocusedTest' }],
    },
  ],
});
