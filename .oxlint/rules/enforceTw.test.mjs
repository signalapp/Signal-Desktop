// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check
import { enforceTw } from './enforceTw.mjs';
import { RuleTester } from '@typescript-eslint/rule-tester';

const ruleTester = new RuleTester({
  languageOptions: {
    parserOptions: {
      ecmaFeatures: {
        jsx: true,
      },
    },
  },
});

ruleTester.run('enforce-tw', enforceTw, {
  valid: [
    { code: `classNames("foo")` },
    { code: `<div className="foo"/>` },
    { code: `tw("flex")` },
  ],
  invalid: [
    {
      code: `classNames("flex")`,
      errors: [{ messageId: 'needsTw' }],
    },
    {
      code: `<div className="flex"/>`,
      errors: [{ messageId: 'needsTw' }],
    },
    {
      code: `<div className={"flex"}/>`,
      errors: [{ messageId: 'needsTw' }],
    },
    {
      code: `classNames("foo", "flex")`,
      errors: [{ messageId: 'needsTw' }],
    },
    {
      code: `classNames(cond ? "foo" : "flex")`,
      errors: [{ messageId: 'needsTw' }],
    },
    {
      code: `classNames(cond ? "flex" : "foo")`,
      errors: [{ messageId: 'needsTw' }],
    },
    {
      code: `classNames(cond && "flex")`,
      errors: [{ messageId: 'needsTw' }],
    },
    {
      code: `classNames(cond || "flex")`,
      errors: [{ messageId: 'needsTw' }],
    },
    {
      code: `classNames(cond ?? "flex")`,
      errors: [{ messageId: 'needsTw' }],
    },
    {
      code: `classNames("foo" + "flex")`,
      errors: [{ messageId: 'needsTw' }],
    },
    {
      code: `classNames("flex" + "foo")`,
      errors: [{ messageId: 'needsTw' }],
    },
  ],
});
