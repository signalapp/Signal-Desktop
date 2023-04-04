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
  'icu:no_params': {
    messageformat: 'ICU message',
  },
  'icu:nested': {
    messageformat: '{one, select, other {{two, plural, other {{three}}}}}}',
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
      code: `i18n("icu:real_message", { message: "foo" })`,
      options: [{ messagesCacheKey, __mockMessages__ }],
    },
    {
      code: `window.i18n("icu:real_message", { message: "foo" })`,
      options: [{ messagesCacheKey, __mockMessages__ }],
    },
    {
      code: `let jsx = <Intl id="icu:real_message" components={{ message: "foo" }}/>`,
      options: [{ messagesCacheKey, __mockMessages__ }],
    },
    {
      code: `i18n("icu:no_params")`,
      options: [{ messagesCacheKey, __mockMessages__ }],
    },
    {
      code: `let jsx = <Intl id="icu:no_params"/>`,
      options: [{ messagesCacheKey, __mockMessages__ }],
    },
    {
      code: `i18n("icu:nested", { one: "1", two: "2", three: "3" })`,
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
    {
      code: `i18n("icu:no_params", { message: "foo" })`,
      options: [{ messagesCacheKey, __mockMessages__ }],
      errors: [
        {
          message:
            'i18n() message "icu:no_params" does not have any params, but has a "values" argument',
          type: 'CallExpression',
        },
      ],
    },
    {
      code: `i18n("icu:real_message")`,
      options: [{ messagesCacheKey, __mockMessages__ }],
      errors: [
        {
          message:
            'i18n() message "icu:real_message" has params, but is missing a "values" argument',
          type: 'CallExpression',
        },
      ],
    },
    {
      code: `i18n("icu:real_message", null)`,
      options: [{ messagesCacheKey, __mockMessages__ }],
      errors: [
        {
          message: 'i18n() "values" argument must be an object literal',
          type: 'Literal',
        },
      ],
    },
    {
      code: `i18n("icu:real_message", { [foo]: "foo" })`,
      options: [{ messagesCacheKey, __mockMessages__ }],
      errors: [
        {
          message: 'i18n() "values" argument must only contain literal keys',
          type: 'Property',
        },
      ],
    },
    {
      code: `i18n("icu:real_message", { ...props })`,
      options: [{ messagesCacheKey, __mockMessages__ }],
      errors: [
        {
          message: 'i18n() "values" argument must only contain literal keys',
          type: 'SpreadElement',
        },
      ],
    },
    {
      code: `i18n("icu:real_message", {})`,
      options: [{ messagesCacheKey, __mockMessages__ }],
      errors: [
        {
          message:
            'i18n() message "icu:real_message" has a param "message", but no corresponding value',
          type: 'ObjectExpression',
        },
      ],
    },
    {
      code: `i18n("icu:real_message", { message: "foo", foo: "bar" })`,
      options: [{ messagesCacheKey, __mockMessages__ }],
      errors: [
        {
          message:
            'i18n() message "icu:real_message" has a value "foo", but no corresponding param',
          type: 'ObjectExpression',
        },
      ],
    },
    {
      code: `let jsx = <Intl id="icu:no_params" components={{ message: "foo" }}/>`,
      options: [{ messagesCacheKey, __mockMessages__ }],
      errors: [
        {
          message:
            '<Intl> message "icu:no_params" does not have any params, but has a "components" attribute',
          type: 'JSXOpeningElement',
        },
      ],
    },
    {
      code: `let jsx = <Intl id="icu:real_message"/>`,
      options: [{ messagesCacheKey, __mockMessages__ }],
      errors: [
        {
          message:
            '<Intl> message "icu:real_message" has params, but is missing a "components" attribute',
          type: 'JSXOpeningElement',
        },
      ],
    },
    {
      code: `let jsx = <Intl id="icu:real_message" components={null}/>`,
      options: [{ messagesCacheKey, __mockMessages__ }],
      errors: [
        {
          message: '<Intl> "components" attribute must be an object literal',
          type: 'Literal',
        },
      ],
    },
    {
      code: `let jsx = <Intl id="icu:real_message" components={{ [foo]: "foo" }}/>`,
      options: [{ messagesCacheKey, __mockMessages__ }],
      errors: [
        {
          message:
            '<Intl> "components" attribute must only contain literal keys',
          type: 'Property',
        },
      ],
    },
    {
      code: `let jsx = <Intl id="icu:real_message" components={{ ...props }}/>`,
      options: [{ messagesCacheKey, __mockMessages__ }],
      errors: [
        {
          message:
            '<Intl> "components" attribute must only contain literal keys',
          type: 'SpreadElement',
        },
      ],
    },
    {
      code: `let jsx = <Intl id="icu:real_message" components={{}}/>`,
      options: [{ messagesCacheKey, __mockMessages__ }],
      errors: [
        {
          message:
            '<Intl> message "icu:real_message" has a param "message", but no corresponding component',
          type: 'ObjectExpression',
        },
      ],
    },
    {
      code: `let jsx = <Intl id="icu:real_message" components={{ message: "foo", foo: "bar" }}/>`,
      options: [{ messagesCacheKey, __mockMessages__ }],
      errors: [
        {
          message:
            '<Intl> message "icu:real_message" has a component "foo", but no corresponding param',
          type: 'ObjectExpression',
        },
      ],
    },
    {
      code: `i18n("icu:nested", { one: "1", two: "2" })`,
      options: [{ messagesCacheKey, __mockMessages__ }],
      errors: [
        {
          message:
            'i18n() message "icu:nested" has a param "three", but no corresponding value',
          type: 'ObjectExpression',
        },
      ],
    },
  ],
});
