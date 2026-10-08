// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check
// oxlint-disable signal-desktop/enforce-static-class-names
import { ESLintUtils } from '@typescript-eslint/utils';

/**
 * @typedef {import("@typescript-eslint/utils").TSESTree.Node} Node
 * @typedef {import("@typescript-eslint/utils").TSESTree.Identifier} Identifier
 * @typedef {import("@typescript-eslint/utils").TSESTree.MemberExpression} MemberExpression
 * @typedef {import("@typescript-eslint/utils").TSESTree.CallExpression} CallExpression
 * @typedef {import("@typescript-eslint/utils").TSESTree.ReturnStatement} ReturnStatement
 * @typedef {import("@typescript-eslint/utils").TSESTree.ArrowFunctionExpression
 *   | import("@typescript-eslint/utils").TSESTree.FunctionExpression
 *   | import("@typescript-eslint/utils").TSESTree.FunctionDeclaration
 * } FunctionNode
 * @typedef {'dynamicClassName' | 'useClassNamesHelper' | 'unverifiableClassName' | 'noStaticTemplateLiteralClassName' | 'noSingleClassNameInClassNames'} MessageId
 * @typedef {{ type: 'static', text: string } | { type: 'dynamic', node: Node | null }} ConcatPart
 */

/** Example: `className` or `iconClassName` */
const CLASS_NAME_PATTERN = /^(?:className|[a-z][a-zA-Z0-9]*ClassName)$/;

/** classNames(...) */
const CLASS_NAMES_FUNCTIONS = new Set(['classNames', 'css']);

/** `enforceTw` rule and Tailwind already ensure these are static */
const STATIC_CLASS_NAMES_FUNCTIONS = new Set(['tw']);

/** Number of leading arguments to `element.classList.*()` that are class names */
const CLASS_LIST_METHODS = new Map([
  ['add', Infinity], // classList.add(...classNames)
  ['remove', Infinity], // classList.remove(...classNames)
  ['toggle', 1], // classList.toggle(className, [toggle])
  ['contains', 1], // classList.toggle(className)
  ['replace', 2], // classList.replace(before, after)
]);

/**
 * @param {string | null} name
 * @returns {boolean}
 */
function isClassNameName(name) {
  return name != null && CLASS_NAME_PATTERN.test(name);
}

/**
 * Strip TypeScript-only wrappers and optional chains, which don't change the
 * runtime value.
 *
 * @param {Node} node
 * @returns {Node}
 */
function unwrap(node) {
  let current = node;
  while (
    current.type === 'TSAsExpression' ||
    current.type === 'TSSatisfiesExpression' ||
    current.type === 'TSNonNullExpression' ||
    current.type === 'TSTypeAssertion' ||
    current.type === 'ChainExpression'
  ) {
    current = current.expression;
  }
  return current;
}

/**
 * `'a'` or `` `a` ``
 *
 * @param {Node} input
 * @returns {boolean}
 */
function isStaticString(input) {
  const node = unwrap(input);
  if (node.type === 'Literal') {
    return typeof node.value === 'string';
  }
  return node.type === 'TemplateLiteral' && node.expressions.length === 0;
}

/**
 * @param {Node} node
 * @returns {node is FunctionNode}
 */
function isFunction(node) {
  return (
    node.type === 'ArrowFunctionExpression' ||
    node.type === 'FunctionExpression' ||
    node.type === 'FunctionDeclaration'
  );
}

/**
 * @param {Node} key
 * @param {boolean} computed
 * @returns {string | null}
 */
function getKeyName(key, computed) {
  if (!computed && key.type === 'Identifier') {
    return key.name;
  }
  if (key.type === 'Literal' && typeof key.value === 'string') {
    return key.value;
  }
  if (key.type === 'TemplateLiteral' && key.expressions.length === 0) {
    const [quasi] = key.quasis;
    return quasi?.value.cooked ?? null;
  }
  return null;
}

/**
 * @param {Node} node
 * @returns {string | null}
 */
function getPropertyName(node) {
  if (
    node.type === 'Property' ||
    node.type === 'PropertyDefinition' ||
    node.type === 'MethodDefinition'
  ) {
    return getKeyName(node.key, node.computed);
  }
  if (node.type === 'MemberExpression') {
    return getKeyName(node.property, node.computed);
  }
  return null;
}

/**
 * @param {Node} input
 * @returns {string | null}
 */
function getCalleeName(input) {
  const callee = unwrap(input);
  if (callee.type === 'Identifier') {
    return callee.name;
  }
  return getPropertyName(callee);
}

/**
 * @param {Node} node
 * @returns {boolean}
 */
function isClassListObject(node) {
  const object = unwrap(node);
  return (
    object.type === 'MemberExpression' &&
    getPropertyName(object) === 'classList'
  );
}

/**
 * @param {Node} node
 * @returns {FunctionNode | null}
 */
function getEnclosingFunction(node) {
  let current = node.parent;
  while (current != null) {
    if (isFunction(current)) {
      return current;
    }
    current = current.parent;
  }
  return null;
}

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

    /** @type {WeakSet<Node>} */
    const reportedNodes = new WeakSet();
    /** @type {WeakSet<Node>} */
    const checkedNodes = new WeakSet();
    /** @type {WeakSet<FunctionNode>} */
    const classNameGetters = new WeakSet();
    /** @type {Array<FunctionNode>} */
    const pendingClassNameGetters = [];
    /** @type {Map<FunctionNode, Array<ReturnStatement>>} */
    const returnsByFunction = new Map();
    let isProgramComplete = false;

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
     * @param {Identifier} node
     */
    function resolveReference(node) {
      const scope = sourceCode.getScope(node);
      const reference = scope.references.find(ref => {
        return ref.identifier === node;
      });
      const variable = reference?.resolved;
      if (variable == null || variable.defs.length !== 1) {
        return null;
      }
      return variable.defs[0] ?? null;
    }

    /**
     * Resolve an identifier to the initializer of a `const` declaration in
     * this file.
     *
     * @param {Identifier} node
     * @returns {Node | null}
     */
    function resolveConstantReference(node) {
      const def = resolveReference(node);
      if (def == null || def.node.type !== 'VariableDeclarator') {
        return null;
      }
      const declarator = def.node;
      if (
        declarator.id.type !== 'Identifier' ||
        declarator.init == null ||
        declarator.parent.type !== 'VariableDeclaration' ||
        declarator.parent.kind !== 'const'
      ) {
        return null;
      }
      return declarator.init;
    }

    /**
     * Resolve an identifier to a function declared in this file.
     *
     * @param {Identifier} node
     * @returns {FunctionNode | null}
     */
    function resolveFunctionReference(node) {
      const def = resolveReference(node);
      if (def?.node.type === 'FunctionDeclaration') {
        return def.node;
      }
      const init = resolveConstantReference(node);
      if (init != null) {
        const value = unwrap(init);
        if (isFunction(value)) {
          return value;
        }
      }
      return null;
    }

    /**
     * Every value this function returns is a class name.
     *
     * @param {FunctionNode} node
     */
    function markClassNameGetter(node) {
      if (classNameGetters.has(node)) {
        return;
      }
      classNameGetters.add(node);
      if (node.body.type !== 'BlockStatement') {
        checkValue(node.body);
      } else if (isProgramComplete) {
        checkReturns(node);
      } else {
        // Return statements are collected while traversing, check them once
        // we've seen all of them.
        pendingClassNameGetters.push(node);
      }
    }

    /**
     * @param {FunctionNode} node
     */
    function checkReturns(node) {
      for (const returnStatement of returnsByFunction.get(node) ?? []) {
        if (returnStatement.argument != null) {
          checkValue(returnStatement.argument);
        }
      }
    }

    /**
     * Concatenation (template literal or `+`) is never allowed. Report
     * whether it builds partial class names or only joins complete ones.
     *
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
     * Check a value that will be used as one or more class names.
     *
     * @param {Node} input
     */
    function checkValue(input) {
      const node = unwrap(input);

      // Avoid re-checking shared values (e.g. a `const` referenced in
      // multiple places) and infinite recursion
      if (checkedNodes.has(node)) {
        return;
      }
      checkedNodes.add(node);

      switch (node.type) {
        case 'Literal':
          return;
        case 'TemplateLiteral':
          if (node.expressions.length > 0) {
            reportConcatenation(node, flattenConcatenation(node, []));
          } else {
            report(node, 'noStaticTemplateLiteralClassName');
          }
          return;
        case 'BinaryExpression':
          if (node.operator === '+') {
            reportConcatenation(node, flattenConcatenation(node, []));
          } else {
            report(node, 'unverifiableClassName');
          }
          return;
        case 'ConditionalExpression':
          checkValue(node.consequent);
          checkValue(node.alternate);
          return;
        case 'LogicalExpression':
          if (node.operator !== '&&') {
            checkValue(node.left);
          }
          checkValue(node.right);
          return;
        case 'ArrayExpression':
          for (const element of node.elements) {
            if (element == null) {
              continue;
            }
            checkValue(
              element.type === 'SpreadElement' ? element.argument : element
            );
          }
          return;
        case 'ObjectExpression':
          // `classNames({ 'class-name': condition })`
          for (const property of node.properties) {
            if (property.type === 'SpreadElement') {
              checkValue(property.argument);
            } else if (property.computed) {
              checkValue(property.key);
            }
          }
          return;
        case 'Identifier':
          checkIdentifier(node);
          return;
        case 'MemberExpression':
          checkMemberExpression(node);
          return;
        case 'CallExpression':
          checkCallExpression(node);
          return;
        default:
          report(node, 'unverifiableClassName');
      }
    }

    /**
     * @param {Identifier} node
     */
    function checkIdentifier(node) {
      if (node.name === 'undefined' || isClassNameName(node.name)) {
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
      if (isClassNameName(name)) {
        return;
      }
      // `CLASS_NAMES[variant]`, `CLASS_NAMES.foo`
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

      // Arguments are checked by the `CallExpression` visitor
      if (
        callee.type === 'Identifier' &&
        (CLASS_NAMES_FUNCTIONS.has(callee.name) ||
          STATIC_CLASS_NAMES_FUNCTIONS.has(callee.name))
      ) {
        return;
      }

      // `getClassName()`, `themeClassName(theme)`, `OS.getClassName()`
      if (isClassNameName(name)) {
        return;
      }

      // `useMemo(() => ..., [])`
      if (name === 'useMemo') {
        const [callback] = node.arguments;
        if (callback != null) {
          const fn = unwrap(callback);
          if (isFunction(fn)) {
            markClassNameGetter(fn);
            return;
          }
        }
      }

      // `CLASS_NAMES.get(variant)`
      if (
        callee.type === 'MemberExpression' &&
        name === 'get' &&
        checkLookup(callee.object, null, 'map')
      ) {
        return;
      }

      // `getVariantClass(variant)` defined in this file
      if (callee.type === 'Identifier') {
        const fn = resolveFunctionReference(callee);
        if (fn != null) {
          markClassNameGetter(fn);
          return;
        }
      }

      report(node, 'unverifiableClassName');
    }

    /**
     * Check the values of a lookup table defined in this file:
     *
     * - `const X = { a: 'a', b: 'b' }` (`kind: 'object'`)
     * - `const X = ['a', 'b']` (`kind: 'object'`)
     * - `const X = new Map([[A, 'a'], [B, 'b']])` (`kind: 'map'`)
     * - `const X = variants('Name', { a: 'a', b: 'b' })` (`kind: 'map'`)
     *
     * @param {Node} input
     * @param {string | null} key
     * @param {'object' | 'map'} kind
     * @returns {boolean} `false` if the lookup table could not be found
     */
    function checkLookup(input, key, kind) {
      const node = unwrap(input);

      if (node.type === 'Identifier') {
        const init = resolveConstantReference(node);
        return init != null && checkLookup(init, key, kind);
      }

      if (kind === 'object' && node.type === 'ObjectExpression') {
        const match =
          key == null
            ? null
            : node.properties.find(property => {
                return getPropertyName(property) === key;
              });
        if (match != null && match.type === 'Property') {
          checkValue(match.value);
          return true;
        }
        for (const property of node.properties) {
          if (property.type === 'SpreadElement') {
            if (!checkLookup(property.argument, null, kind)) {
              report(property.argument, 'unverifiableClassName');
            }
          } else {
            checkValue(property.value);
          }
        }
        return true;
      }

      if (kind === 'object' && node.type === 'ArrayExpression') {
        for (const element of node.elements) {
          if (element == null) {
            continue;
          }
          if (element.type === 'SpreadElement') {
            if (!checkLookup(element.argument, null, kind)) {
              report(element.argument, 'unverifiableClassName');
            }
          } else {
            checkValue(element);
          }
        }
        return true;
      }

      if (
        kind === 'map' &&
        node.type === 'NewExpression' &&
        node.callee.type === 'Identifier' &&
        node.callee.name === 'Map'
      ) {
        const [entriesArg] = node.arguments;
        if (entriesArg == null) {
          return true;
        }
        const entries = unwrap(entriesArg);
        if (entries.type !== 'ArrayExpression') {
          return false;
        }
        for (const entry of entries.elements) {
          if (entry == null) {
            continue;
          }
          const value =
            entry.type === 'ArrayExpression' ? entry.elements[1] : null;
          if (value != null && value.type !== 'SpreadElement') {
            checkValue(value);
          } else {
            report(entry, 'unverifiableClassName');
          }
        }
        return true;
      }

      if (
        kind === 'map' &&
        node.type === 'CallExpression' &&
        node.callee.type === 'Identifier' &&
        node.callee.name === 'variants'
      ) {
        const values = node.arguments[node.arguments.length - 1];
        return values != null && checkLookup(values, null, 'object');
      }

      return false;
    }

    /**
     * Check a value assigned to something named `className`/`*ClassName`,
     * which may be a function that returns class names.
     *
     * @param {Node} input
     */
    function checkClassNameGetter(input) {
      const node = unwrap(input);
      if (isFunction(node)) {
        markClassNameGetter(node);
        return;
      }
      if (
        node.type === 'CallExpression' &&
        getCalleeName(node.callee) === 'useCallback'
      ) {
        const [callback] = node.arguments;
        if (callback != null) {
          const fn = unwrap(callback);
          if (isFunction(fn)) {
            markClassNameGetter(fn);
            return;
          }
        }
      }
      checkValue(node);
    }

    return {
      // <div className={...}/>
      // <Component iconClassName={...}/>
      JSXAttribute(node) {
        if (node.name.type !== 'JSXIdentifier') {
          return;
        }
        if (!isClassNameName(node.name.name)) {
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
        if (!isClassNameName(getPropertyName(node))) {
          return;
        }
        checkClassNameGetter(node.value);
      },

      // class Foo { iconClassName = ... }
      PropertyDefinition(node) {
        if (node.value == null) {
          return;
        }
        if (!isClassNameName(getPropertyName(node))) {
          return;
        }
        checkClassNameGetter(node.value);
      },

      // class Foo { getClassName() {...} }
      MethodDefinition(node) {
        if (node.value.type !== 'FunctionExpression') {
          return;
        }
        if (!isClassNameName(getPropertyName(node))) {
          return;
        }
        markClassNameGetter(node.value);
      },

      // function getClassName() {...}
      FunctionDeclaration(node) {
        if (node.id == null || !isClassNameName(node.id.name)) {
          return;
        }
        markClassNameGetter(node);
      },

      // const iconClassName = ...
      VariableDeclarator(node) {
        if (node.id.type !== 'Identifier' || node.init == null) {
          return;
        }
        if (!isClassNameName(node.id.name)) {
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
        if (!isClassNameName(name)) {
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
        if (!isClassNameName(name) && !isClassNameName(keyName)) {
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

        const method = getPropertyName(callee);

        // element.classList.add('a')
        if (isClassListObject(callee.object)) {
          const count =
            method != null ? (CLASS_LIST_METHODS.get(method) ?? 0) : 0;
          node.arguments.slice(0, count).forEach(arg => {
            checkValue(arg.type === 'SpreadElement' ? arg.argument : arg);
          });
          return;
        }

        // element.setAttribute('class', 'a')
        if (method === 'setAttribute') {
          const [attr, value] = node.arguments;
          if (
            attr?.type === 'Literal' &&
            attr.value === 'class' &&
            value != null
          ) {
            checkValue(value);
          }
        }
      },

      ReturnStatement(node) {
        const fn = getEnclosingFunction(node);
        if (fn == null) {
          return;
        }
        let returns = returnsByFunction.get(fn);
        if (returns == null) {
          returns = [];
          returnsByFunction.set(fn, returns);
        }
        returns.push(node);
      },

      'Program:exit'() {
        isProgramComplete = true;
        for (const fn of pendingClassNameGetters) {
          checkReturns(fn);
        }
      },
    };
  },
});
