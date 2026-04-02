// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import ts from 'typescript';
import prettier from 'prettier';
import { getICUMessageParams } from './utils/getICUMessageParams.mjs';
import globalMessages from '../_locales/en/messages.json' with { type: 'json' };
import { unreachable } from './utils/assert.mjs';
import { DELETED_REGEXP } from './utils/intlMessages.mjs';

/** @import { ICUMessageParamType } from './utils/getICUMessageParams.mjs' */

/**
 * @param {ICUMessageParamType} param
 * @param {ts.TypeNode} stringType
 * @param {ts.TypeNode} componentType
 * @returns {ts.TypeNode}
 */
function translateParamType(param, stringType, componentType) {
  switch (param.type) {
    case 'string':
      return stringType;
    case 'number':
      return ts.factory.createToken(ts.SyntaxKind.NumberKeyword);
    case 'date':
    case 'time':
      return ts.factory.createTypeReferenceNode('Date');
    case 'jsx':
      return componentType;
    case 'select':
      return ts.factory.createUnionTypeNode(
        param.validOptions.map(option => {
          if (option === 'other') {
            return stringType;
          }

          return ts.factory.createLiteralTypeNode(
            ts.factory.createStringLiteral(option, true)
          );
        })
      );
    default:
      unreachable(param);
  }
}

const messageKeys = /** @type {Array<keyof typeof globalMessages>} */ (
  Object.keys(globalMessages)
).sort((a, b) => {
  return a.localeCompare(b);
});

/**
 * @param {Map<string, ICUMessageParamType>} params
 */
function filterDefaultParams(params) {
  /** @type {Map<string, ICUMessageParamType>} */
  const filteredParams = new Map();

  for (const [key, value] of params) {
    if (key === 'emojify') {
      continue;
    }

    filteredParams.set(key, value);
  }

  return filteredParams;
}

const ComponentOrStringNode =
  ts.factory.createTypeReferenceNode('ComponentOrString');
const ComponentNode = ts.factory.createTypeReferenceNode('Component');
const StringToken = ts.factory.createToken(ts.SyntaxKind.StringKeyword);
const NeverToken = ts.factory.createToken(ts.SyntaxKind.NeverKeyword);

/**
 * @param {string} name
 * @param {boolean} supportsComponents
 * @returns {ts.Statement}
 */
function generateType(name, supportsComponents) {
  /** @type {Array<ts.TypeElement>} */
  const props = [];
  for (const key of messageKeys) {
    if (key === 'smartling') {
      continue;
    }

    const message = globalMessages[key];

    // Skip deleted strings
    if ('description' in message && DELETED_REGEXP.test(message.description)) {
      continue;
    }

    const { messageformat } = message;

    const rawParams = getICUMessageParams(messageformat);
    const params = filterDefaultParams(rawParams);

    if (!supportsComponents) {
      const needsComponents = Array.from(rawParams.values()).some(value => {
        return value.type === 'jsx';
      });

      if (needsComponents) {
        continue;
      }
    }

    const stringType = supportsComponents ? ComponentOrStringNode : StringToken;
    const componentType = supportsComponents ? ComponentNode : NeverToken;

    /** @type {ts.TypeNode} */
    let paramType;
    if (params.size === 0) {
      paramType = ts.factory.createToken(ts.SyntaxKind.UndefinedKeyword);
    } else {
      /** @type {Array<ts.TypeElement>} */
      const subTypes = [];

      for (const [paramName, value] of params) {
        subTypes.push(
          ts.factory.createPropertySignature(
            undefined,
            ts.factory.createStringLiteral(paramName, true),
            undefined,
            translateParamType(value, stringType, componentType)
          )
        );
      }

      paramType = ts.factory.createTypeLiteralNode(subTypes);
    }

    props.push(
      ts.factory.createPropertySignature(
        undefined,
        ts.factory.createStringLiteral(key, true),
        undefined,
        paramType
      )
    );
  }

  return ts.factory.createTypeAliasDeclaration(
    [ts.factory.createToken(ts.SyntaxKind.ExportKeyword)],
    name,
    undefined,
    ts.factory.createTypeLiteralNode(props)
  );
}

/** @type {Array<ts.Statement>} */
const statements = [];

let top = ts.factory.createImportDeclaration(
  undefined,
  ts.factory.createImportClause(
    true,
    undefined,
    ts.factory.createNamedImports([
      ts.factory.createImportSpecifier(
        false,
        undefined,
        ts.factory.createIdentifier('JSX')
      ),
      ts.factory.createImportSpecifier(
        false,
        undefined,
        ts.factory.createIdentifier('ReactNode')
      ),
    ])
  ),
  ts.factory.createStringLiteral('react')
);

top = ts.addSyntheticLeadingComment(
  top,
  ts.SyntaxKind.SingleLineCommentTrivia,
  ` Copyright ${new Date().getFullYear()} Signal Messenger, LLC`
);

top = ts.addSyntheticLeadingComment(
  top,
  ts.SyntaxKind.SingleLineCommentTrivia,
  ' SPDX-License-Identifier: AGPL-3.0-only'
);

statements.push(top);

const JSXElement = ts.factory.createTypeReferenceNode(
  ts.factory.createQualifiedName(ts.factory.createIdentifier('JSX'), 'Element')
);

statements.push(
  ts.factory.createTypeAliasDeclaration(
    undefined,
    'Component',
    undefined,
    ts.factory.createUnionTypeNode([
      JSXElement,
      ts.factory.createFunctionTypeNode(
        undefined,
        [
          ts.factory.createParameterDeclaration(
            undefined,
            undefined,
            'parts',
            undefined,
            ts.factory.createTypeReferenceNode('Array', [
              ts.factory.createUnionTypeNode([
                ts.factory.createToken(ts.SyntaxKind.StringKeyword),
                JSXElement,
              ]),
            ])
          ),
        ],
        JSXElement
      ),
    ])
  )
);

statements.push(
  ts.factory.createTypeAliasDeclaration(
    undefined,
    'ComponentOrString',
    undefined,
    ts.factory.createUnionTypeNode([
      ts.factory.createToken(ts.SyntaxKind.StringKeyword),
      ts.factory.createTypeReferenceNode('ReadonlyArray', [
        ts.factory.createUnionTypeNode([
          ts.factory.createToken(ts.SyntaxKind.StringKeyword),
          JSXElement,
        ]),
      ]),
      ts.factory.createTypeReferenceNode('Component'),
    ])
  )
);

statements.push(generateType('ICUJSXMessageParamsByKeyType', true));

statements.push(generateType('ICUStringMessageParamsByKeyType', false));

const root = ts.factory.createSourceFile(
  statements,
  ts.factory.createToken(ts.SyntaxKind.EndOfFileToken),
  ts.NodeFlags.None
);

const resultFile = ts.createSourceFile(
  'icuTypes.d.ts',
  '',
  ts.ScriptTarget.Latest,
  false,
  ts.ScriptKind.TS
);
const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
const unformattedOutput = printer.printNode(
  ts.EmitHint.Unspecified,
  root,
  resultFile
);

const destinationPath = path.join(
  import.meta.dirname,
  '..',
  'build',
  'ICUMessageParams.d.ts'
);

/** @type {string | undefined} */
let oldHash;
try {
  oldHash = createHash('sha512')
    .update(await fs.readFile(destinationPath))
    .digest('hex');
} catch {
  // Ignore errors
}

const prettierConfig = await prettier.resolveConfig(destinationPath);
const output = await prettier.format(unformattedOutput, {
  ...prettierConfig,
  filepath: destinationPath,
});

const newHash = createHash('sha512').update(output).digest('hex');
if (oldHash === newHash) {
  console.log('ICUMessageParams.d.ts is unchanged');
}

await fs.writeFile(destinationPath, output);
