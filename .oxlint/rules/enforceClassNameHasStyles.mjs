// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check
// oxlint-disable signal-desktop/enforce-static-class-names
import { ESLintUtils } from '@typescript-eslint/utils';
import fs from 'node:fs';
import path from 'node:path';
import postcss from 'postcss';
import createSelectorParser from 'postcss-selector-parser';
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
  getTextOffset,
} from '../utils/classNames.mjs';

/**
 * @import { TSESTree } from "@typescript-eslint/utils";
 */

/**
 * @typedef {TSESTree.Node} Node
 * @typedef {TSESTree.Identifier} Identifier
 * @typedef {TSESTree.MemberExpression} MemberExpression
 * @typedef {TSESTree.CallExpression} CallExpression
 */

/**
 * @typedef {{
 *   stylesheet?: string;
 * }} Options
 */

const rootDir = path.join(import.meta.dirname, '../..');

const DEFAULT_STYLESHEET = 'stylesheets/manifest.css';
const CLASS_NAMES_FUNCTIONS = new Set(['classNames']);
const IGNORED_CLASS_NAMES_FUNCTIONS = new Set(['css', 'tw']);
const IGNORED_CLASS_NAME_PREFIX = 'axo-';

/** @type {Map<string, { mtimeMs: number, classNames: Set<string> }>} */
const stylesheetCache = new Map();

const selectorParser = createSelectorParser();

/** @param {postcss.Rule} rule  */
function isKeyframesSelector(rule) {
  // `from`, `50%`, etc.
  return (
    rule.parent != null &&
    rule.parent.type === 'atrule' &&
    rule.parent.name.includes('keyframes')
  );
}

/**
 * @param {string} stylesheetPath
 * @returns {Set<string> | null} `null` if the stylesheet doesn't exist
 */
function loadStylesheetClassNames(stylesheetPath) {
  let stats;
  try {
    stats = fs.statSync(stylesheetPath);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return null;
    }
    throw error;
  }

  const cached = stylesheetCache.get(stylesheetPath);
  if (cached != null && cached.mtimeMs === stats.mtimeMs) {
    return cached.classNames;
  }

  const css = fs.readFileSync(stylesheetPath, 'utf-8');
  const root = postcss.parse(css, { from: stylesheetPath });

  /** @type {Set<string>} */
  const classNames = new Set();

  root.walkRules(rule => {
    if (rule.type === 'rule')
      if (isKeyframesSelector(rule)) {
        return;
      }
    selectorParser.astSync(rule.selector).walkClasses(node => {
      classNames.add(node.value);
    });
  });

  stylesheetCache.set(stylesheetPath, { mtimeMs: stats.mtimeMs, classNames });
  return classNames;
}

export const enforceClassNameHasStyles = ESLintUtils.RuleCreator.withoutDocs({
  name: 'enforce-class-name-has-styles',
  meta: {
    type: 'problem',
    messages: {
      noStyles:
        'Class name "{{className}}" has no styles in {{stylesheet}}. Add ' +
        'styles for it or remove it.',
      missingStylesheet:
        'Could not find {{stylesheet}}. Run `pnpm run build:styles` to ' +
        'generate it.',
    },
    schema: [
      {
        type: 'object',
        properties: {
          stylesheet: { type: 'string' },
        },
        additionalProperties: false,
      },
    ],
    /** @type {[Options]} */
    defaultOptions: [{}],
  },
  create(context) {
    const { sourceCode } = context;
    const { resolveConstantReference, resolveFunctionReference } =
      getReferenceResolvers(sourceCode);

    const stylesheet = context.options[0]?.stylesheet ?? DEFAULT_STYLESHEET;
    const stylesheetClassNames = loadStylesheetClassNames(
      path.resolve(rootDir, stylesheet)
    );

    /** @type {WeakSet<Node>} */
    const checkedNodes = new WeakSet();
    let isMissingStylesheetReported = false;
    const classNameGetterTracker = createClassNameGetterTracker(collect);

    /**
     * @param {Node} node
     * @param {string} text
     */
    function checkText(node, text) {
      if (stylesheetClassNames == null) {
        if (!isMissingStylesheetReported) {
          isMissingStylesheetReported = true;
          context.report({
            node: sourceCode.ast,
            messageId: 'missingStylesheet',
            data: { stylesheet },
          });
        }
        return;
      }

      const offset = getTextOffset(node, text);

      for (const match of text.matchAll(/\S+/g)) {
        const className = match[0];
        if (
          className.startsWith(IGNORED_CLASS_NAME_PREFIX) ||
          stylesheetClassNames.has(className)
        ) {
          continue;
        }

        const data = { className, stylesheet };
        if (offset == null) {
          context.report({ node, messageId: 'noStyles', data });
          continue;
        }

        const { line, column } = node.loc.start;
        const start = column + offset + match.index;
        context.report({
          node,
          loc: {
            start: { line, column: start },
            end: { line, column: start + className.length },
          },
          messageId: 'noStyles',
          data,
        });
      }
    }

    /**
     * @param {Node} input
     */
    function collect(input) {
      const node = unwrap(input);

      if (checkedNodes.has(node)) {
        return;
      }
      checkedNodes.add(node);

      if (node.type === 'Literal') {
        if (typeof node.value === 'string') {
          checkText(node, node.value);
        }
        return;
      }

      if (node.type === 'TemplateLiteral') {
        if (node.expressions.length === 0) {
          const text = node.quasis[0]?.value.cooked;
          if (text != null) {
            checkText(node, text);
          }
        }
        return;
      }

      if (node.type === 'ConditionalExpression') {
        collect(node.consequent);
        collect(node.alternate);
        return;
      }

      if (node.type === 'LogicalExpression') {
        if (node.operator !== '&&') {
          collect(node.left);
        }
        collect(node.right);
        return;
      }

      if (node.type === 'ArrayExpression') {
        for (const element of node.elements) {
          if (element == null) {
            continue;
          }
          if (element.type === 'SpreadElement') {
            collect(element.argument);
          } else {
            collect(element);
          }
        }
        return;
      }

      if (node.type === 'ObjectExpression') {
        for (const property of node.properties) {
          if (property.type === 'SpreadElement') {
            collect(property.argument);
          } else if (property.computed) {
            collect(property.key);
          } else if (property.key.type === 'Identifier') {
            checkText(property.key, property.key.name);
          } else {
            collect(property.key);
          }
        }
        return;
      }

      if (node.type === 'Identifier') {
        collectIdentifier(node);
        return;
      }

      if (node.type === 'MemberExpression') {
        collectMemberExpression(node);
        return;
      }

      if (node.type === 'CallExpression') {
        collectCallExpression(node);
        return;
      }

      if (node.type === 'BinaryExpression') {
        // Should be checked by `enforceStaticClassNames`
        return;
      }

      throw new Error(`Unhandled node type: ${node.type}`);
    }

    /**
     * @param {Identifier} node
     */
    function collectIdentifier(node) {
      // `*ClassName` variables are checked where they're assigned
      if (isClassNameIdentifierName(node.name)) {
        return;
      }
      const init = resolveConstantReference(node);
      if (init != null) {
        collect(init);
      }
    }

    /**
     * @param {MemberExpression} node
     */
    function collectMemberExpression(node) {
      const name = getPropertyName(node);
      // `props.className`, `this.props.iconClassName`
      if (isClassNameIdentifierName(name)) {
        return;
      }
      // `CLASS_NAMES[variant]`, `CLASS_NAMES.foo`
      collectLookup(node.object, name, 'object');
    }

    /**
     * @param {CallExpression} node
     */
    function collectCallExpression(node) {
      const callee = unwrap(node.callee);
      const name = getCalleeName(callee);

      // Arguments are checked by the `CallExpression` visitor, or are styled
      // outside of manifest.css
      if (
        callee.type === 'Identifier' &&
        (CLASS_NAMES_FUNCTIONS.has(callee.name) ||
          IGNORED_CLASS_NAMES_FUNCTIONS.has(callee.name))
      ) {
        return;
      }

      // `useMemo(() => ..., [])`
      if (name === 'useMemo') {
        const [callback] = node.arguments;
        if (callback != null) {
          const fn = unwrap(callback);
          if (isFunction(fn)) {
            classNameGetterTracker.mark(fn);
          }
        }
        return;
      }

      // `CLASS_NAMES.get(variant)`
      if (callee.type === 'MemberExpression' && name === 'get') {
        collectLookup(callee.object, null, 'map');
        return;
      }

      // `getVariantClass(variant)` defined in this file
      if (callee.type === 'Identifier') {
        const fn = resolveFunctionReference(callee);
        if (fn != null) {
          classNameGetterTracker.mark(fn);
        }
      }
    }

    /**
     * @param {Node} input
     * @param {string | null} key
     * @param {'object' | 'map'} kind
     */
    function collectLookup(input, key, kind) {
      visitClassNameLookup(input, key, kind, {
        resolveConstantReference,
        onValue: collect,
      });
    }

    /**
     * Collect a value assigned to something named `className`/`*ClassName`,
     * which may be a function that returns class names.
     *
     * @param {Node} input
     */
    function collectClassNameGetter(input) {
      getClassNameGetter(input, classNameGetterTracker.mark, collect);
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
        if (value == null) {
          return;
        }
        if (value.type === 'Literal') {
          collect(value);
        } else if (
          value.type === 'JSXExpressionContainer' &&
          value.expression.type !== 'JSXEmptyExpression'
        ) {
          collect(value.expression);
        }
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
        collectClassNameGetter(node.value);
      },

      // class Foo { iconClassName = ... }
      // class Blot { static className = ... }
      PropertyDefinition(node) {
        if (node.value == null) {
          return;
        }
        if (!isClassNameIdentifierName(getPropertyName(node))) {
          return;
        }
        collectClassNameGetter(node.value);
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
        collectClassNameGetter(node.init);
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
        if (
          node.operator === '=' ||
          node.operator === '||=' ||
          node.operator === '??=' ||
          node.operator === '&&='
        ) {
          collectClassNameGetter(node.right);
        } else if (node.operator === '+=') {
          collect(node.right);
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
        collect(node.right);
      },

      CallExpression(node) {
        const callee = unwrap(node.callee);

        // classNames('a', cond && 'b')
        if (
          callee.type === 'Identifier' &&
          CLASS_NAMES_FUNCTIONS.has(callee.name)
        ) {
          for (const arg of node.arguments) {
            collect(arg.type === 'SpreadElement' ? arg.argument : arg);
          }
          return;
        }

        if (callee.type !== 'MemberExpression') {
          return;
        }

        if (visitClassNameCall(node, collect)) {
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
