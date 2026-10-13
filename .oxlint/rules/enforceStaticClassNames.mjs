// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check
// oxlint-disable signal-desktop/enforce-static-class-names
import { ESLintUtils } from '@typescript-eslint/utils';
import {
  createClassNameGetterTracker,
  getCalleeName,
  getClassNameGetter,
  getPropertyName,
  getReferenceResolvers,
  isClassNameIdentifierName,
  isFunction,
  unwrap,
  visitClassNameCall,
  visitClassNameLookup,
  isStaticString,
} from '../utils/classNames.mjs';

/**
 * @import { TSESTree } from "@typescript-eslint/utils"
 */

/**
 * @typedef {TSESTree.Node} Node
 * @typedef {TSESTree.Identifier} Identifier
 * @typedef {TSESTree.MemberExpression} MemberExpression
 * @typedef {TSESTree.CallExpression} CallExpression
 * @typedef {'dynamicClassName' | 'useClassNamesHelper' | 'unverifiableClassName' | 'noStaticTemplateLiteralClassName' | 'noSingleClassNameInClassNames'} MessageId
 * @typedef {{ type: 'static', text: string } | { type: 'dynamic', node: Node | null }} ConcatPart
 */

/** classNames(...) */
const CLASS_NAMES_FUNCTIONS = new Set(['classNames', 'css']);

/** `enforceTw` rule and Tailwind already ensure these are static */
const STATIC_CLASS_NAMES_FUNCTIONS = new Set(['tw']);

/**
 * Flatten string concatenation (`a + b`, `${a}b`) into static and dynamic
 * parts.
 *
 * @param {Node} input
 * @param {Array<ConcatPart>} parts
 * @returns {Array<ConcatPart>}
 */
function flattenConcatenation(input, parts) {
  const node = unwrap(input);
  if (
    node.type === 'Literal' &&
    (typeof node.value === 'string' ||
      typeof node.value === 'number' ||
      typeof node.value === 'boolean')
  ) {
    parts.push({ type: 'static', text: `${node.value}` });
  } else if (node.type === 'TemplateLiteral') {
    node.quasis.forEach((quasi, index) => {
      parts.push({
        type: 'static',
        text: quasi.value.cooked ?? quasi.value.raw,
      });
      const expression = node.expressions[index];
      if (expression != null) {
        flattenConcatenation(expression, parts);
      }
    });
  } else if (node.type === 'BinaryExpression' && node.operator === '+') {
    flattenConcatenation(node.left, parts);
    flattenConcatenation(node.right, parts);
  } else {
    parts.push({ type: 'dynamic', node });
  }
  return parts;
}

/**
 * Normalize to alternating `[static, dynamic, static, ..., static]`, merging
 * adjacent static parts and inserting empty static parts between adjacent
 * dynamic parts.
 *
 * @param {ReadonlyArray<ConcatPart>} parts
 * @returns {Array<ConcatPart>}
 */
function normalizeConcatenation(parts) {
  /** @type {Array<ConcatPart>} */
  const result = [{ type: 'static', text: '' }];
  for (const part of parts) {
    const last = result[result.length - 1];
    if (part.type === 'static') {
      if (last?.type === 'static') {
        last.text += part.text;
      } else {
        result.push({ type: 'static', text: part.text });
      }
    } else {
      if (last?.type === 'dynamic') {
        result.push({ type: 'static', text: '' });
      }
      result.push(part);
    }
  }
  if (result[result.length - 1]?.type === 'dynamic') {
    result.push({ type: 'static', text: '' });
  }
  return result;
}

export const enforceStaticClassNames = ESLintUtils.RuleCreator.withoutDocs({
  name: 'enforce-static-class-names',
  meta: {
    type: 'problem',
    messages: {
      dynamicClassName:
        'Class names must not be constructed dynamically. Write out every ' +
        "full class name as a static string (e.g. `cond ? 'Foo--a' : " +
        "'Foo--b'` or a lookup object of complete class names).",
      useClassNamesHelper:
        'Do not join class names with string concatenation or template ' +
        "literals. Use classNames() instead (e.g. `classNames('Foo', " +
        'className)`), or write a single string literal.',
      unverifiableClassName:
        'Class names must be statically declared. Use a string literal, ' +
        'classNames(), tw(), a const lookup object/Map of complete class ' +
        'names, or a value named `className` or `*ClassName`.',
      noStaticTemplateLiteralClassName:
        // oxlint-disable-next-line signal-desktop/enforce-class-name-has-styles
        'Do not use template literals for class names.',
      noSingleClassNameInClassNames:
        'Do not use classNames() for a single class name. Use a string ' +
        'literal instead.',
    },
    schema: [],
    defaultOptions: [],
  },
  create(context) {
    const { sourceCode } = context;
    const { resolveConstantReference, resolveFunctionReference } =
      getReferenceResolvers(sourceCode);

    /** @type {WeakSet<Node>} */
    const reportedNodes = new WeakSet();
    /** @type {WeakSet<Node>} */
    const checkedNodes = new WeakSet();
    const classNameGetterTracker = createClassNameGetterTracker(checkValue);

    /**
     * @param {Node} node
     * @param {MessageId} messageId
     */
    function report(node, messageId) {
      if (reportedNodes.has(node)) {
        return;
      }
      reportedNodes.add(node);
      context.report({ node, messageId });
    }

    /**
     * @param {Node} node
     * @param {ReadonlyArray<ConcatPart>} rawParts
     */
    function reportConcatenation(node, rawParts) {
      const parts = normalizeConcatenation(rawParts);
      const lastIndex = parts.length - 1;

      const isPartial = parts.some((part, index) => {
        if (part.type !== 'dynamic') {
          return false;
        }

        const before = parts[index - 1];
        const after = parts[index + 1];
        const beforeText = before?.type === 'static' ? before.text : '';
        const afterText = after?.type === 'static' ? after.text : '';

        const isStartDelimited =
          (index - 1 === 0 && beforeText === '') || /\s$/.test(beforeText);
        const isEndDelimited =
          (index + 1 === lastIndex && afterText === '') ||
          /^\s/.test(afterText);

        return !isStartDelimited || !isEndDelimited;
      });

      report(node, isPartial ? 'dynamicClassName' : 'useClassNamesHelper');
    }

    /**
     * @param {Node} input
     */
    function checkValue(input) {
      const node = unwrap(input);
      if (checkedNodes.has(node)) {
        return;
      }
      checkedNodes.add(node);

      if (node.type === 'Literal') {
        return;
      }

      if (node.type === 'TemplateLiteral') {
        if (node.expressions.length > 0) {
          reportConcatenation(node, flattenConcatenation(node, []));
        } else {
          report(node, 'noStaticTemplateLiteralClassName');
        }
        return;
      }

      if (node.type === 'BinaryExpression') {
        if (node.operator === '+') {
          reportConcatenation(node, flattenConcatenation(node, []));
        } else {
          report(node, 'unverifiableClassName');
        }
        return;
      }

      if (node.type === 'ConditionalExpression') {
        checkValue(node.consequent);
        checkValue(node.alternate);
        return;
      }

      if (node.type === 'LogicalExpression') {
        if (node.operator !== '&&') {
          checkValue(node.left);
        }
        checkValue(node.right);
        return;
      }

      if (node.type === 'ArrayExpression') {
        for (const element of node.elements) {
          if (element == null) {
            continue;
          }
          checkValue(
            element.type === 'SpreadElement' ? element.argument : element
          );
        }
        return;
      }

      if (node.type === 'ObjectExpression') {
        // `classNames({ 'class-name': condition })`
        for (const property of node.properties) {
          if (property.type === 'SpreadElement') {
            checkValue(property.argument);
          } else if (property.computed) {
            checkValue(property.key);
          }
        }
        return;
      }

      if (node.type === 'Identifier') {
        checkIdentifier(node);
        return;
      }

      if (node.type === 'MemberExpression') {
        checkMemberExpression(node);
        return;
      }

      if (node.type === 'CallExpression') {
        checkCallExpression(node);
        return;
      }

      report(node, 'unverifiableClassName');
    }

    /**
     * @param {Identifier} node
     */
    function checkIdentifier(node) {
      if (node.name === 'undefined' || isClassNameIdentifierName(node.name)) {
        return;
      }
      const init = resolveConstantReference(node);
      if (init != null) {
        checkValue(init);
        return;
      }
      report(node, 'unverifiableClassName');
    }

    /**
     * @param {MemberExpression} node
     */
    function checkMemberExpression(node) {
      const name = getPropertyName(node);
      // `props.className`, `this.props.iconClassName`
      if (isClassNameIdentifierName(name)) {
        return;
      }
      if (checkLookup(node.object, name, 'object')) {
        return;
      }
      report(node, 'unverifiableClassName');
    }

    /**
     * @param {CallExpression} node
     */
    function checkCallExpression(node) {
      const callee = unwrap(node.callee);
      const name = getCalleeName(callee);

      if (
        callee.type === 'Identifier' &&
        (CLASS_NAMES_FUNCTIONS.has(callee.name) ||
          STATIC_CLASS_NAMES_FUNCTIONS.has(callee.name))
      ) {
        return;
      }
      if (isClassNameIdentifierName(name)) {
        return;
      }
      if (name === 'useMemo') {
        const [callback] = node.arguments;
        if (callback != null) {
          const fn = unwrap(callback);
          if (isFunction(fn)) {
            classNameGetterTracker.mark(fn);
            return;
          }
        }
      }
      if (
        callee.type === 'MemberExpression' &&
        name === 'get' &&
        checkLookup(callee.object, null, 'map')
      ) {
        return;
      }
      if (callee.type === 'Identifier') {
        const fn = resolveFunctionReference(callee);
        if (fn != null) {
          classNameGetterTracker.mark(fn);
          return;
        }
      }
      report(node, 'unverifiableClassName');
    }

    /**
     * @param {Node} input
     * @param {string | null} key
     * @param {'object' | 'map'} kind
     * @returns {boolean}
     */
    function checkLookup(input, key, kind) {
      return visitClassNameLookup(input, key, kind, {
        resolveConstantReference,
        onValue: checkValue,
        onUnverifiable(node) {
          report(node, 'unverifiableClassName');
        },
      });
    }

    /**
     * @param {Node} input
     */
    function checkClassNameGetter(input) {
      getClassNameGetter(input, classNameGetterTracker.mark, checkValue);
    }

    return {
      // <div className={...}/>
      // <Component iconClassName={...}/>
      JSXAttribute(node) {
        if (node.name.type !== 'JSXIdentifier') {
          return;
        }
        if (!isClassNameIdentifierName(node.name.name)) {
          return;
        }
        const { value } = node;
        if (value == null || value.type === 'Literal') {
          return;
        }
        if (value.type === 'JSXExpressionContainer') {
          if (value.expression.type !== 'JSXEmptyExpression') {
            checkValue(value.expression);
          }
          return;
        }
        report(value, 'unverifiableClassName');
      },

      // { className: ... }
      // { iconClassName: ... }
      // { getClassName() {...} }
      Property(node) {
        if (node.parent.type !== 'ObjectExpression') {
          return;
        }
        if (!isClassNameIdentifierName(getPropertyName(node))) {
          return;
        }
        checkClassNameGetter(node.value);
      },

      // class Foo { iconClassName = ... }
      PropertyDefinition(node) {
        if (node.value == null) {
          return;
        }
        if (!isClassNameIdentifierName(getPropertyName(node))) {
          return;
        }
        checkClassNameGetter(node.value);
      },

      // class Foo { getClassName() {...} }
      MethodDefinition(node) {
        if (node.value.type !== 'FunctionExpression') {
          return;
        }
        if (!isClassNameIdentifierName(getPropertyName(node))) {
          return;
        }
        classNameGetterTracker.mark(node.value);
      },

      // function getClassName() {...}
      FunctionDeclaration(node) {
        if (node.id == null || !isClassNameIdentifierName(node.id.name)) {
          return;
        }
        classNameGetterTracker.mark(node);
      },

      // const iconClassName = ...
      VariableDeclarator(node) {
        if (node.id.type !== 'Identifier' || node.init == null) {
          return;
        }
        if (!isClassNameIdentifierName(node.id.name)) {
          return;
        }
        checkClassNameGetter(node.init);
      },

      // iconClassName = ...
      // element.className = ...
      AssignmentExpression(node) {
        const left = unwrap(node.left);
        let name = null;
        if (left.type === 'Identifier') {
          name = left.name;
        } else if (left.type === 'MemberExpression') {
          name = getPropertyName(left);
        }
        if (!isClassNameIdentifierName(name)) {
          return;
        }

        if (node.operator === '+=') {
          /** @type {Array<ConcatPart>} */
          const parts = [{ type: 'dynamic', node: null }];
          reportConcatenation(
            node.right,
            flattenConcatenation(node.right, parts)
          );
        } else if (
          node.operator === '=' ||
          node.operator === '||=' ||
          node.operator === '??=' ||
          node.operator === '&&='
        ) {
          checkClassNameGetter(node.right);
        } else {
          report(node, 'unverifiableClassName');
        }
      },

      // function Foo({ className = ... }) {}
      // const { iconClassName: icon = ... } = props;
      AssignmentPattern(node) {
        const { left, parent } = node;
        const name = left.type === 'Identifier' ? left.name : null;
        const keyName =
          parent.type === 'Property' && parent.value === node
            ? getPropertyName(parent)
            : null;
        if (
          !isClassNameIdentifierName(name) &&
          !isClassNameIdentifierName(keyName)
        ) {
          return;
        }
        checkValue(node.right);
      },

      CallExpression(node) {
        const callee = unwrap(node.callee);

        // classNames('a', cond && 'b')
        if (
          callee.type === 'Identifier' &&
          CLASS_NAMES_FUNCTIONS.has(callee.name)
        ) {
          // classNames('a')
          if (callee.name === 'classNames' && node.arguments.length === 1) {
            const [arg] = node.arguments;
            if (arg != null && isStaticString(arg)) {
              report(node, 'noSingleClassNameInClassNames');
            }
          }
          for (const arg of node.arguments) {
            checkValue(arg.type === 'SpreadElement' ? arg.argument : arg);
          }
          return;
        }

        if (callee.type !== 'MemberExpression') {
          return;
        }

        if (visitClassNameCall(node, checkValue, { includeContains: true })) {
          return;
        }
      },

      ReturnStatement(node) {
        classNameGetterTracker.recordReturn(node);
      },

      'Program:exit'() {
        classNameGetterTracker.complete();
      },
    };
  },
});
