// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

const rule = require('./enforce-tw');
const RuleTester = require('eslint').RuleTester;

const message = 'Tailwind classes must be wrapped with tw()';

// avoid triggering mocha's global leak detection
require('@typescript-eslint/parser');

const ruleTester = new RuleTester({
  parser: require.resolve('@typescript-eslint/parser'),
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
});

ruleTester.run('enforce-tw', rule, {
  valid: [
    { code: `classNames("foo")` },
    { code: `<div className="foo"/>` },
    { code: `tw("flex")` },
  ],
  invalid: [
    { code: `classNames("flex")`, errors: [{ message }] },
    { code: `<div className="flex"/>`, errors: [{ message }] },
    { code: `<div className={"flex"}/>`, errors: [{ message }] },
    { code: `classNames("foo", "flex")`, errors: [{ message }] },
    { code: `classNames(cond ? "foo" : "flex")`, errors: [{ message }] },
    { code: `classNames(cond ? "flex" : "foo")`, errors: [{ message }] },
    { code: `classNames(cond && "flex")`, errors: [{ message }] },
    { code: `classNames(cond || "flex")`, errors: [{ message }] },
    { code: `classNames(cond ?? "flex")`, errors: [{ message }] },
    { code: `classNames("foo" + "flex")`, errors: [{ message }] },
    { code: `classNames("flex" + "foo")`, errors: [{ message }] },
  ],
});
