// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
const { createSyncFn } = require('synckit');

const worker = createSyncFn(require.resolve('./enforce-tw.worker.js'));

/** @type {import("eslint").Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    hasSuggestions: true,
    fixable: true,
    schema: [],
  },
  create(context) {
    function check(input, node) {
      if (typeof input !== 'string') {
        throw new Error(`Unexpected input ${input} for node type ${node.type}`);
      }

      const tailwindClasses = worker(input.split(/\s+/));

      for (const tailwindClass of tailwindClasses) {
        const index = input.indexOf(tailwindClass) + 1;
        const length = tailwindClass.length;
        context.report({
          node,
          loc: {
            start: {
              line: node.loc.start.line,
              column: node.loc.start.column + index,
            },
            end: {
              line: node.loc.end.line,
              column: node.loc.start.column + index + length,
            },
          },
          message: 'Tailwind classes must be wrapped with tw()',
        });
      }
    }

    function traverse(node) {
      if (node.type === 'Literal') {
        if (typeof node.value === 'string') {
          check(node.value, node);
        }
        // ignore other literals
      } else if (node.type === 'TemplateLiteral') {
        for (let element of node.quasis) {
          traverse(element);
        }
        for (let expression of node.expressions) {
          traverse(expression);
        }
      } else if (node.type === 'TemplateElement') {
        check(node.value.cooked, node);
      } else if (node.type === 'JSXExpressionContainer') {
        traverse(node.expression);
      } else if (node.type === 'ConditionalExpression') {
        // ignore node.test
        traverse(node.consequent);
        traverse(node.alternate);
      } else if (node.type === 'LogicalExpression') {
        if (node.operator === '||' || node.operator === '??') {
          traverse(node.left);
        }
        traverse(node.right);
      } else if (node.type === 'BinaryExpression') {
        if (node.operator === '+') {
          traverse(node.left);
          traverse(node.right);
        } else {
          throw new Error(`Unexpected binary operator: ${node.operator}`);
        }
      } else if (node.type === 'ObjectExpression') {
        for (let prop of node.properties) {
          traverse(prop);
        }
      } else if (node.type === 'Property') {
        if (node.key.type === 'Identifier') {
          if (!node.computed) {
            check(node.key.name, node.key);
          }
          // ignore computed
        } else if (node.key.type === 'Literal') {
          traverse(node.key);
        } else if (node.key.type === 'TemplateLiteral') {
          traverse(node.key);
        } else if (node.key.type === 'CallExpression') {
          // ignore
        } else {
          throw new Error(`Unexpected property key type: ${node.key.type}`);
        }
      } else if (node.type === 'ArrayExpression') {
        for (let element of node.elements) {
          traverse(element);
        }
      } else if (node.type === 'Identifier') {
        // ignore
      } else if (node.type === 'CallExpression') {
        // ignore
      } else if (node.type === 'MemberExpression') {
        // ignore
      } else {
        throw new Error(`Unexpected traverse node type: ${node.type}`);
      }
    }

    return {
      CallExpression(node) {
        if (node.callee.type !== 'Identifier') return;
        if (node.callee.name !== 'classNames') return;
        for (let arg of node.arguments) {
          traverse(arg);
        }
      },
      JSXAttribute(node) {
        if (node.name.type !== 'JSXIdentifier') return;
        if (node.name.name !== 'className') return;
        traverse(node.value);
      },
    };
  },
};
