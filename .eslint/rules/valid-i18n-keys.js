// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

const crypto = require('crypto');
const icuParser = require('@formatjs/icu-messageformat-parser');

const globalMessages = require('../../_locales/en/messages.json');
const messageKeys = Object.keys(globalMessages).sort((a, b) => {
  return a.localeCompare(b);
});
const allIcuParams = messageKeys
  .filter(key => {
    return isIcuMessageKey(globalMessages, key);
  })
  .map(key => {
    return Array.from(
      getIcuMessageParams(globalMessages[key].messageformat)
    ).join('\n');
  });

const hashSum = crypto.createHash('sha256');
hashSum.update(messageKeys.join('\n'));
hashSum.update(allIcuParams.join('\n'));
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

function getI18nCallValues(node) {
  // babel-eslint messes with elements arrays in some cases because of TS
  if (node.arguments.length < 2) {
    return null;
  }
  return node.arguments[1];
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

function getIntlElementComponents(node) {
  let componentsAttribute = node.attributes.find(attribute => {
    return (
      attribute.type === 'JSXAttribute' &&
      attribute.name.type === 'JSXIdentifier' &&
      attribute.name.name === 'components'
    );
  });

  if (componentsAttribute == null) {
    return null;
  }

  let value = componentsAttribute.value;
  if (value?.type !== 'JSXExpressionContainer') {
    return null;
  }

  return value.expression;
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

function getIcuMessageParams(message) {
  const params = new Set();

  function visitOptions(options) {
    for (const option of Object.values(options)) {
      visit(option.value);
    }
  }

  function visit(elements) {
    for (const element of elements) {
      switch (element.type) {
        case icuParser.TYPE.argument:
          params.add(element.value);
          break;
        case icuParser.TYPE.date:
          params.add(element.value);
          break;
        case icuParser.TYPE.literal:
          break;
        case icuParser.TYPE.number:
          params.add(element.value);
          break;
        case icuParser.TYPE.plural:
          params.add(element.value);
          visitOptions(element.options);
          break;
        case icuParser.TYPE.pound:
          break;
        case icuParser.TYPE.select:
          params.add(element.value);
          visitOptions(element.options);
          break;
        case icuParser.TYPE.tag:
          params.add(element.value);
          visit(element.children);
          break;
        case icuParser.TYPE.time:
          params.add(element.value);
          break;
        default:
          throw new Error(`Unknown element type: ${element.type}`);
      }
    }
  }

  visit(icuParser.parse(message));

  return params;
}

function getMissingFromSet(expected, actual) {
  const result = new Set();
  for (const item of expected) {
    if (!actual.has(item)) {
      result.add(item);
    }
  }
  return result;
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

        const key = getIntlElementMessageKey(node);

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

        const params = getIcuMessageParams(messages[key].messageformat);
        const components = getIntlElementComponents(node);

        if (params.size === 0) {
          if (components != null) {
            context.report({
              node,
              message: `<Intl> message "${key}" does not have any params, but has a "components" attribute`,
            });
          }
          return;
        }

        if (components == null) {
          context.report({
            node,
            message: `<Intl> message "${key}" has params, but is missing a "components" attribute`,
          });
          return;
        }

        if (components.type !== 'ObjectExpression') {
          context.report({
            node: components,
            message: `<Intl> "components" attribute must be an object literal`,
          });
          return;
        }

        const props = new Set();
        for (const property of components.properties) {
          if (property.type !== 'Property' || property.computed) {
            context.report({
              node: property,
              message: `<Intl> "components" attribute must only contain literal keys`,
            });
            return;
          }
          props.add(property.key.name);
        }

        const missingParams = getMissingFromSet(params, props);
        if (missingParams.size > 0) {
          for (const param of missingParams) {
            context.report({
              node: components,
              message: `<Intl> message "${key}" has a param "${param}", but no corresponding component`,
            });
          }
          return;
        }

        const extraComponents = getMissingFromSet(props, params);
        if (extraComponents.size > 0) {
          for (const prop of extraComponents) {
            context.report({
              node: components,
              message: `<Intl> message "${key}" has a component "${prop}", but no corresponding param`,
            });
          }
          return;
        }
      },
      CallExpression(node) {
        if (!isI18nCall(node)) {
          return;
        }

        const key = getI18nCallMessageKey(node);

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
          return;
        }

        const params = getIcuMessageParams(messages[key].messageformat);
        const values = getI18nCallValues(node);

        if (params.size === 0) {
          if (values != null) {
            context.report({
              node,
              message: `i18n() message "${key}" does not have any params, but has a "values" argument`,
            });
          }
          return;
        }

        if (values == null) {
          context.report({
            node,
            message: `i18n() message "${key}" has params, but is missing a "values" argument`,
          });
          return;
        }

        if (values.type !== 'ObjectExpression') {
          context.report({
            node: values,
            message: `i18n() "values" argument must be an object literal`,
          });
          return;
        }

        const props = new Set();
        for (const property of values.properties) {
          if (property.type !== 'Property' || property.computed) {
            context.report({
              node: property,
              message: `i18n() "values" argument must only contain literal keys`,
            });
            return;
          }
          props.add(property.key.name);
        }

        const missingParams = getMissingFromSet(params, props);
        if (missingParams.size > 0) {
          for (const param of missingParams) {
            context.report({
              node: values,
              message: `i18n() message "${key}" has a param "${param}", but no corresponding value`,
            });
          }
          return;
        }

        const extraProps = getMissingFromSet(props, params);
        if (extraProps.size > 0) {
          for (const prop of extraProps) {
            context.report({
              node: values,
              message: `i18n() message "${key}" has a value "${prop}", but no corresponding param`,
            });
          }
          return;
        }
      },
    };
  },
};
