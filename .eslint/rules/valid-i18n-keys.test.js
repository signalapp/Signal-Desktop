// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

const rule = require('./valid-i18n-keys');
const RuleTester = require('eslint').RuleTester;

const messagesCacheKey = rule.messagesCacheKey;

// Need to load so mocha doesn't complain about polluting the global namespace
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

ruleTester.run('valid-i18n-keys', rule, {
  valid: [
    {
      code: `i18n("AddCaptionModal__title")`,
      options: [{ messagesCacheKey }],
    },
    {
      code: `window.i18n("AddCaptionModal__title")`,
      options: [{ messagesCacheKey }],
    },
    {
      code: `let jsx = <Intl id="AddCaptionModal__title"/>`,
      options: [{ messagesCacheKey }],
    },
  ],
  invalid: [
    {
      code: 'i18n(`AddCaptionModal__${title}`)',
      options: [{ messagesCacheKey }],
      errors: [
        {
          message: "i18n()'s first argument should always be a literal string",
          type: 'CallExpression',
        },
      ],
    },
    {
      code: 'window.i18n(`AddCaptionModal__${title}`)',
      options: [{ messagesCacheKey }],
      errors: [
        {
          message: "i18n()'s first argument should always be a literal string",
          type: 'CallExpression',
        },
      ],
    },
    {
      code: `let jsx = <Intl id={"AddCaptionModal__title"}/>`,
      options: [{ messagesCacheKey }],
      errors: [
        {
          message:
            "<Intl> must always be provided an 'id' attribute with a literal string",
          type: 'JSXOpeningElement',
        },
      ],
    },
    {
      code: 'let jsx = <Intl id={`AddCaptionModal__title`}/>',
      options: [{ messagesCacheKey }],
      errors: [
        {
          message:
            "<Intl> must always be provided an 'id' attribute with a literal string",
          type: 'JSXOpeningElement',
        },
      ],
    },
    {
      code: 'let jsx = <Intl id={`AddCaptionModal__${title}`}/>',
      options: [{ messagesCacheKey }],
      errors: [
        {
          message:
            "<Intl> must always be provided an 'id' attribute with a literal string",
          type: 'JSXOpeningElement',
        },
      ],
    },
    {
      code: `i18n("THIS_KEY_SHOULD_NEVER_EXIST")`,
      options: [{ messagesCacheKey }],
      errors: [
        {
          message:
            'i18n() key "THIS_KEY_SHOULD_NEVER_EXIST" not found in _locales/en/messages.json',
          type: 'CallExpression',
        },
      ],
    },
    {
      code: `i18n(cond ? "AddCaptionModal__title" : "AddCaptionModal__title")`,
      options: [{ messagesCacheKey }],
      errors: [
        {
          message: "i18n()'s first argument should always be a literal string",
          type: 'CallExpression',
        },
      ],
    },
    {
      code: `i18n(42)`,
      options: [{ messagesCacheKey }],
      errors: [
        {
          message: "i18n()'s first argument should always be a literal string",
          type: 'CallExpression',
        },
      ],
    },
    {
      code: `let jsx = <Intl id="THIS_KEY_SHOULD_NEVER_EXIST"/>`,
      options: [{ messagesCacheKey }],
      errors: [
        {
          message:
            '<Intl> id "THIS_KEY_SHOULD_NEVER_EXIST" not found in _locales/en/messages.json',
          type: 'JSXOpeningElement',
        },
      ],
    },
    {
      code: `let jsx = <Intl id={cond ? "AddCaptionModal__title" : "AddCaptionModal__title"}/>`,
      options: [{ messagesCacheKey }],
      errors: [
        {
          message:
            "<Intl> must always be provided an 'id' attribute with a literal string",
          type: 'JSXOpeningElement',
        },
      ],
    },
    {
      code: `let jsx = <Intl id={42}/>`,
      options: [{ messagesCacheKey }],
      errors: [
        {
          message:
            "<Intl> must always be provided an 'id' attribute with a literal string",
          type: 'JSXOpeningElement',
        },
      ],
    },
  ],
});
