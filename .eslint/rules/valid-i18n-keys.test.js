// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

const rule = require('./valid-i18n-keys');
const RuleTester = require('eslint').RuleTester;

const messagesCacheKey = rule.messagesCacheKey;

const __mockMessages__ = {
  legacy_real_message: {
    message: 'Legacy $message$',
  },
  'icu:real_message': {
    messageformat: 'ICU {message}',
  },
  'icu:deleted_message': {
    messageformat: 'shouldnt use me anymore',
    description: '(deleted 01/01/1970)',
  },
};

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
      code: `i18n("icu:real_message")`,
      options: [{ messagesCacheKey, __mockMessages__ }],
    },
    {
      code: `window.i18n("icu:real_message")`,
      options: [{ messagesCacheKey, __mockMessages__ }],
    },
    {
      code: `let jsx = <Intl id="icu:real_message"/>`,
      options: [{ messagesCacheKey, __mockMessages__ }],
    },
  ],
  invalid: [
    {
      code: `i18n("legacy_real_message")`,
      options: [{ messagesCacheKey, __mockMessages__ }],
      errors: [
        {
          message:
            'i18n() key "legacy_real_message" is not an ICU message in _locales/en/messages.json',
          type: 'CallExpression',
        },
      ],
    },
    {
      code: `window.i18n("legacy_real_message")`,
      options: [{ messagesCacheKey, __mockMessages__ }],
      errors: [
        {
          message:
            'i18n() key "legacy_real_message" is not an ICU message in _locales/en/messages.json',
          type: 'CallExpression',
        },
      ],
    },
    {
      code: `let jsx = <Intl id="legacy_real_message"/>`,
      options: [{ messagesCacheKey, __mockMessages__ }],
      errors: [
        {
          message:
            '<Intl> id "legacy_real_message" is not an ICU message in _locales/en/messages.json',
          type: 'JSXOpeningElement',
        },
      ],
    },
    {
      code: 'i18n(`icu:real_${message}`)',
      options: [{ messagesCacheKey, __mockMessages__ }],
      errors: [
        {
          message: "i18n()'s first argument should always be a literal string",
          type: 'CallExpression',
        },
      ],
    },
    {
      code: 'window.i18n(`icu:real_${message}`)',
      options: [{ messagesCacheKey, __mockMessages__ }],
      errors: [
        {
          message: "i18n()'s first argument should always be a literal string",
          type: 'CallExpression',
        },
      ],
    },
    {
      code: `let jsx = <Intl id={"icu:real_message"}/>`,
      options: [{ messagesCacheKey, __mockMessages__ }],
      errors: [
        {
          message:
            "<Intl> must always be provided an 'id' attribute with a literal string",
          type: 'JSXOpeningElement',
        },
      ],
    },
    {
      code: 'let jsx = <Intl id={`icu:real_message`}/>',
      options: [{ messagesCacheKey, __mockMessages__ }],
      errors: [
        {
          message:
            "<Intl> must always be provided an 'id' attribute with a literal string",
          type: 'JSXOpeningElement',
        },
      ],
    },
    {
      code: 'let jsx = <Intl id={`icu:real_${message}`}/>',
      options: [{ messagesCacheKey, __mockMessages__ }],
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
      options: [{ messagesCacheKey, __mockMessages__ }],
      errors: [
        {
          message:
            'i18n() key "THIS_KEY_SHOULD_NEVER_EXIST" not found in _locales/en/messages.json',
          type: 'CallExpression',
        },
      ],
    },
    {
      code: `i18n(cond ? "icu:real_message" : "icu:real_message")`,
      options: [{ messagesCacheKey, __mockMessages__ }],
      errors: [
        {
          message: "i18n()'s first argument should always be a literal string",
          type: 'CallExpression',
        },
      ],
    },
    {
      code: `i18n(42)`,
      options: [{ messagesCacheKey, __mockMessages__ }],
      errors: [
        {
          message: "i18n()'s first argument should always be a literal string",
          type: 'CallExpression',
        },
      ],
    },
    {
      code: `let jsx = <Intl id="THIS_KEY_SHOULD_NEVER_EXIST"/>`,
      options: [{ messagesCacheKey, __mockMessages__ }],
      errors: [
        {
          message:
            '<Intl> id "THIS_KEY_SHOULD_NEVER_EXIST" not found in _locales/en/messages.json',
          type: 'JSXOpeningElement',
        },
      ],
    },
    {
      code: `let jsx = <Intl id={cond ? "icu:real_message" : "icu:real_message"}/>`,
      options: [{ messagesCacheKey, __mockMessages__ }],
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
      options: [{ messagesCacheKey, __mockMessages__ }],
      errors: [
        {
          message:
            "<Intl> must always be provided an 'id' attribute with a literal string",
          type: 'JSXOpeningElement',
        },
      ],
    },
    {
      code: `i18n("icu:deleted_message")`,
      options: [{ messagesCacheKey, __mockMessages__ }],
      errors: [
        {
          message:
            'i18n() key "icu:deleted_message" is marked as deleted in _locales/en/messages.json',
          type: 'CallExpression',
        },
      ],
    },
    {
      code: `let jsx = <Intl id="icu:deleted_message"/>`,
      options: [{ messagesCacheKey, __mockMessages__ }],
      errors: [
        {
          message:
            '<Intl> id "icu:deleted_message" is marked as deleted in _locales/en/messages.json',
          type: 'JSXOpeningElement',
        },
      ],
    },
  ],
});
