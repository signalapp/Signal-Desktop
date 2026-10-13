// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check

/**
 * @import { TSESTree, TSESLint } from "@typescript-eslint/utils")
 */

/**
 * @typedef {TSESTree.Node} Node
 * @typedef {TSESTree.Identifier} Identifier
 * @typedef {TSESTree.CallExpression} CallExpression
 * @typedef {TSESTree.ReturnStatement} ReturnStatement
 * @typedef {TSESTree.FunctionDeclaration | TSESTree.FunctionExpression | TSESTree.ArrowFunctionExpression} FunctionNode
 */

const CLASS_NAME_PATTERN = /^(?:className|[a-z][a-zA-Z0-9]*ClassName)$/;

const CLASS_LIST_METHODS = new Map([
  ['add', Infinity],
  ['remove', Infinity],
  ['toggle', 1],
  ['contains', 1],
  ['replace', 2],
]);

/**
 * @param {string | null} name
 * @returns {boolean}
 */
export function isClassNameIdentifierName(name) {
  return name != null && CLASS_NAME_PATTERN.test(name);
}

/**
 * @param {TSESLint.SourceCode} sourceCode
 */
export function getReferenceResolvers(sourceCode) {
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

  return { resolveConstantReference, resolveFunctionReference };
}

/**
 * @param {(node: Node) => void} checkValue
 */
export function createClassNameGetterTracker(checkValue) {
  /** @type {WeakSet<FunctionNode>} */
  const classNameGetters = new WeakSet();
  /** @type {Array<FunctionNode>} */
  const pendingClassNameGetters = [];
  /** @type {Map<FunctionNode, Array<ReturnStatement>>} */
  const returnsByFunction = new Map();
  let isProgramComplete = false;

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
   * @param {FunctionNode} node
   */
  function mark(node) {
    if (classNameGetters.has(node)) {
      return;
    }
    classNameGetters.add(node);
    if (node.body.type !== 'BlockStatement') {
      checkValue(node.body);
    } else if (isProgramComplete) {
      checkReturns(node);
    } else {
      pendingClassNameGetters.push(node);
    }
  }

  /**
   * @param {ReturnStatement} node
   */
  function recordReturn(node) {
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
  }

  function complete() {
    isProgramComplete = true;
    for (const fn of pendingClassNameGetters) {
      checkReturns(fn);
    }
  }

  return { mark, recordReturn, complete };
}

/**
 * @param {Node} input
 * @param {(node: FunctionNode) => void} markClassNameGetter
 * @param {(node: Node) => void} onValue
 */
export function getClassNameGetter(input, markClassNameGetter, onValue) {
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
  onValue(node);
}

/**
 * @typedef {'object' | 'map'} LookupKind
 * @typedef {object} LookupCallbacks
 * @property {(node: Node) => void} onValue
 * @property {(node: Node) => void=} onUnverifiable
 * @property {(node: Identifier) => Node | null} resolveConstantReference
 */

/**
 * Visit values in an object, array, Map, or `variants()` lookup.
 *
 * @param {Node} input
 * @param {string | null} key
 * @param {LookupKind} kind
 * @param {LookupCallbacks} callbacks
 * @returns {boolean} Whether the input was a supported lookup
 */
export function visitClassNameLookup(input, key, kind, callbacks) {
  const { onValue, onUnverifiable, resolveConstantReference } = callbacks;
  const node = unwrap(input);

  if (node.type === 'Identifier') {
    const init = resolveConstantReference(node);
    return init != null && visitClassNameLookup(init, key, kind, callbacks);
  }

  if (kind === 'object' && node.type === 'ObjectExpression') {
    const match =
      key == null
        ? null
        : node.properties.find(property => getPropertyName(property) === key);
    if (match != null && match.type === 'Property') {
      onValue(match.value);
      return true;
    }
    for (const property of node.properties) {
      if (property.type === 'SpreadElement') {
        if (!visitClassNameLookup(property.argument, null, kind, callbacks)) {
          onUnverifiable?.(property.argument);
        }
      } else {
        onValue(property.value);
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
        if (!visitClassNameLookup(element.argument, null, kind, callbacks)) {
          onUnverifiable?.(element.argument);
        }
      } else {
        onValue(element);
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
      const value = entry.type === 'ArrayExpression' ? entry.elements[1] : null;
      if (value != null && value.type !== 'SpreadElement') {
        onValue(value);
      } else {
        onUnverifiable?.(entry);
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
    return (
      values != null && visitClassNameLookup(values, null, 'object', callbacks)
    );
  }

  return false;
}

/**
 * @param {CallExpression} node
 * @param {(node: Node) => void} onClassName
 * @param {{ includeContains?: boolean }=} options
 * @returns {boolean} Whether the call applies class names
 */
export function visitClassNameCall(node, onClassName, options = {}) {
  const callee = unwrap(node.callee);
  if (callee.type !== 'MemberExpression') {
    return false;
  }

  const method = getPropertyName(callee);
  if (isClassListObject(callee.object)) {
    let count = 0;

    if (method != null) {
      const shouldSkip = method === 'contains' && !options.includeContains;
      if (!shouldSkip) {
        count = CLASS_LIST_METHODS.get(method) ?? 0;
      }
    }

    const classNameArgs = node.arguments.slice(0, count);
    for (const arg of classNameArgs) {
      if (arg.type === 'SpreadElement') {
        onClassName(arg.argument);
      } else {
        onClassName(arg);
      }
    }

    return true;
  }

  if (method === 'setAttribute') {
    const [attribute, value] = node.arguments;
    if (
      attribute?.type === 'Literal' &&
      attribute.value === 'class' &&
      value != null
    ) {
      onClassName(value);
    }
    return true;
  }

  return false;
}

/**
 * Strip TypeScript-only wrappers and optional chains, which don't change the
 * runtime value.
 *
 * @param {Node} node
 * @returns {Node}
 */
export function unwrap(node) {
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
 * @param {Node} node
 * @returns {node is FunctionNode}
 */
export function isFunction(node) {
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
export function getPropertyName(node) {
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
export function getCalleeName(input) {
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
export function isClassListObject(node) {
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
export function getEnclosingFunction(node) {
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
 * The column offset of `text` within the node's source, or `null` if it can't
 * be located precisely (e.g. multiline strings or escape sequences).
 *
 * @param {Node} node
 * @param {string} text
 * @returns {number | null}
 */
export function getTextOffset(node, text) {
  if (node.loc.start.line !== node.loc.end.line) {
    return null;
  }
  if (node.type === 'Identifier') {
    return 0;
  }
  if (node.type === 'Literal') {
    return node.raw.slice(1, -1) === text ? 1 : null;
  }
  if (node.type === 'TemplateLiteral') {
    return node.quasis[0]?.value.raw === text ? 1 : null;
  }
  return null;
}

/**
 * `'a'` or `` `a` ``
 *
 * @param {Node} input
 * @returns {boolean}
 */
export function isStaticString(input) {
  const node = unwrap(input);
  if (node.type === 'Literal') {
    return typeof node.value === 'string';
  }
  return node.type === 'TemplateLiteral' && node.expressions.length === 0;
}
