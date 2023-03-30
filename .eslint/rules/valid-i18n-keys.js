// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

const crypto = require('crypto');

const globalMessages = require('../../_locales/en/messages.json');
const messageKeys = Object.keys(globalMessages).sort((a, b) => {
  return a.localeCompare(b);
});

const hashSum = crypto.createHash('sha256');
hashSum.update(messageKeys.join('\n'));
const messagesCacheKey = hashSum.digest('hex');

function isI18nCall(node) {
  return (
    (node.type === 'CallExpression' &&
      node.callee.type === 'Identifier' &&
      node.callee.name === 'i18n') ||
    (node.callee.type === 'MemberExpression' &&
      node.callee.property.name === 'i18n')
  );
}

function isIntlElement(node) {
  return (
    node.type === 'JSXOpeningElement' &&
    node.name.type === 'JSXIdentifier' &&
    node.name.name === 'Intl'
  );
}

function isStringLiteral(node) {
  return node.type === 'Literal' && typeof node.value === 'string';
}

function valueToMessageKey(node) {
  if (isStringLiteral(node)) {
    return node.value;
  }
  return null;
}

function getI18nCallMessageKey(node) {
  if (node.arguments.length < 1) {
    return null;
  }

  let arg1 = node.arguments[0];
  if (arg1 == null) {
    return null;
  }

  return valueToMessageKey(arg1);
}

function getIntlElementMessageKey(node) {
  let idAttribute = node.attributes.find(attribute => {
    return (
      attribute.type === 'JSXAttribute' &&
      attribute.name.type === 'JSXIdentifier' &&
      attribute.name.name === 'id'
    );
  });

  if (idAttribute == null) {
    return null;
  }

  let value = idAttribute.value;

  return valueToMessageKey(value);
}

function isValidMessageKey(messages, key) {
  return Object.hasOwn(messages, key);
}

function isIcuMessageKey(messages, key) {
  if (!key.startsWith('icu:')) {
    return false;
  }
  const message = messages[key];
  return message?.messageformat != null;
}

function isDeletedMessageKey(messages, key) {
  const description = messages[key]?.description;
  return description?.toLowerCase().startsWith('(deleted ');
}

module.exports = {
  messagesCacheKey,
  meta: {
    type: 'problem',
    hasSuggestions: false,
    fixable: false,
    schema: [
      {
        type: 'object',
        properties: {
          messagesCacheKey: {
            type: 'string',
          },
          __mockMessages__: {
            type: 'object',
            patternProperties: {
              '.*': {
                oneOf: [
                  {
                    type: 'object',
                    properties: {
                      message: { type: 'string' },
                      description: { type: 'string' },
                    },
                    required: ['message'],
                  },
                  {
                    type: 'object',
                    properties: {
                      messageformat: { type: 'string' },
                      description: { type: 'string' },
                    },
                    required: ['messageformat'],
                  },
                ],
              },
            },
          },
        },
        required: ['messagesCacheKey'],
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const messagesCacheKeyOption = context.options[0].messagesCacheKey;
    if (messagesCacheKeyOption !== messagesCacheKey) {
      throw new Error(
        `The cache key for the i18n rule does not match the current messages.json file (expected: ${messagesCacheKey}, received: ${messagesCacheKeyOption})`
      );
    }

    const mockMessages = context.options[0].__mockMessages__;
    const messages = mockMessages ?? globalMessages;

    return {
      JSXOpeningElement(node) {
        if (!isIntlElement(node)) {
          return;
        }

        let key = getIntlElementMessageKey(node);

        if (key == null) {
          context.report({
            node,
            message:
              "<Intl> must always be provided an 'id' attribute with a literal string",
          });
          return;
        }

        if (!isValidMessageKey(messages, key)) {
          context.report({
            node,
            message: `<Intl> id "${key}" not found in _locales/en/messages.json`,
          });
          return;
        }

        if (!isIcuMessageKey(messages, key)) {
          context.report({
            node,
            message: `<Intl> id "${key}" is not an ICU message in _locales/en/messages.json`,
          });
          return;
        }

        if (isDeletedMessageKey(messages, key)) {
          context.report({
            node,
            message: `<Intl> id "${key}" is marked as deleted in _locales/en/messages.json`,
          });
          return;
        }
      },
      CallExpression(node) {
        if (!isI18nCall(node)) {
          return;
        }

        let key = getI18nCallMessageKey(node);

        if (key == null) {
          context.report({
            node,
            message:
              "i18n()'s first argument should always be a literal string",
          });
          return;
        }

        if (!isValidMessageKey(messages, key)) {
          context.report({
            node,
            message: `i18n() key "${key}" not found in _locales/en/messages.json`,
          });
          return;
        }

        if (!isIcuMessageKey(messages, key)) {
          context.report({
            node,
            message: `i18n() key "${key}" is not an ICU message in _locales/en/messages.json`,
          });
          return;
        }

        if (isDeletedMessageKey(messages, key)) {
          context.report({
            node,
            message: `i18n() key "${key}" is marked as deleted in _locales/en/messages.json`,
          });
        }
      },
    };
  },
};
