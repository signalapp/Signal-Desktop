// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

const crypto = require('crypto');

const messages = require('../../_locales/en/messages.json');
const messageKeys = Object.keys(messages).sort((a, b) => {
  return a.localeCompare(b);
});

const hashSum = crypto.createHash('sha256');
hashSum.update(messageKeys.join('\n'));
const messagesCacheKey = hashSum.digest('hex');

function isI18nCall(node) {
  return (
    node.type === 'CallExpression' &&
    node.callee.type === 'Identifier' &&
    node.callee.name === 'i18n'
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

  if (node.type !== 'TemplateLiteral') {
    return null;
  }

  if (node.quasis.length === 1) {
    return node.quasis[0].value.cooked;
  }

  const parts = node.quasis.map(element => {
    return element.value.cooked;
  });

  return new RegExp(`^${parts.join('(.*)')}$`);
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

  if (value.type === 'JSXExpressionContainer') {
    value = value.expression;
  }

  return valueToMessageKey(value);
}

function isValidMessageKey(key) {
  if (typeof key === 'string') {
    if (Object.hasOwn(messages, key)) {
      return true;
    }
  } else if (key instanceof RegExp) {
    if (messageKeys.some(k => key.test(k))) {
      return true;
    }
  }
  return false;
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

        if (isValidMessageKey(key)) {
          return;
        }

        context.report({
          node,
          message: `<Intl> id "${key}" not found in _locales/en/messages.json`,
        });
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

        if (isValidMessageKey(key)) {
          return;
        }

        context.report({
          node,
          message: `i18n() key "${key}" not found in _locales/en/messages.json`,
        });
      },
    };
  },
};
