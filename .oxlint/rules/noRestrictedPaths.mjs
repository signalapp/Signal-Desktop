// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check
import { ESLintUtils } from '@typescript-eslint/utils';
import { createImportSourceVisitor } from './utils/createImportSourceVisitor.mjs';
import micromatch from 'micromatch';
import isGlob from 'is-glob';
import * as path from 'node:path';
import { assert } from './utils/assert.mjs';
import enhancedResolve from 'enhanced-resolve';

const resolver = enhancedResolve.create.sync({
  extensionAlias: {
    '.js': ['.ts', '.tsx', '.js'],
  },
});

/**
 * @param {string} fromDir
 * @param {string} moduleName
 */
function resolveFrom(fromDir, moduleName) {
  try {
    const result = resolver(fromDir, moduleName);
    if (result === false) {
      return null;
    }
    return result;
  } catch (error) {
    return null;
  }
}

/**
 * @param {string | string[]} input
 * @returns {string[]}
 */
function toArray(input) {
  return Array.isArray(input) ? input : [input];
}

/**
 * @param {string} filePath
 * @param {string} target
 */
function containsPath(filePath, target) {
  const relative = path.relative(target, filePath);
  return relative === '' || !relative.startsWith('..');
}

/**
 * @param {string} fileName
 * @param {RegExp | string} targetPath
 */
function isMatchingTargetPath(fileName, targetPath) {
  return typeof targetPath === 'string'
    ? containsPath(fileName, targetPath)
    : targetPath.test(fileName);
}

/** @type {Map<string, RegExp | string>} */
const REGEX_CACHE = new Map();

/**
 * @typedef {object} Zone
 * @property {string | string[]=} target
 * @property {string | string[]=} from
 * @property {string[]=} except
 * @property {string=} message
 */

/**
 * @typedef {object} Matcher
 * @property {(RegExp | string)[]} targetPaths
 * @property {(RegExp | string)[]} fromPaths
 * @property {(RegExp | string)[] | null} exceptPaths
 * @property {string | null} message
 */

/** @type {[Options]} */
const defaultOptions = [{}];

/**
 * @typedef {object} Options
 * @property {Zone[]=} zones
 * @property {string=} basePath
 */

export const noRestrictedPaths = ESLintUtils.RuleCreator.withoutDocs({
  name: 'no-restricted-paths',
  meta: {
    type: 'problem',
    messages: {
      pathRestrictedNoMessage:
        'Unexpected path "{{moduleName}}" imported in restricted zone.',
      pathRestrictedWithMessage:
        'Unexpected path "{{moduleName}}" imported in restricted zone. {{message}}',
    },
    schema: [
      {
        type: 'object',
        properties: {
          zones: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              properties: {
                target: {
                  anyOf: [
                    { type: 'string' },
                    {
                      type: 'array',
                      items: { type: 'string' },
                      uniqueItems: true,
                      minItems: 1,
                    },
                  ],
                },
                from: {
                  anyOf: [
                    { type: 'string' },
                    {
                      type: 'array',
                      items: { type: 'string' },
                      uniqueItems: true,
                      minItems: 1,
                    },
                  ],
                },
                except: {
                  type: 'array',
                  items: {
                    type: 'string',
                  },
                  uniqueItems: true,
                },
                message: { type: 'string' },
              },
              additionalProperties: false,
            },
          },
          basePath: { type: 'string' },
        },
        additionalProperties: false,
      },
    ],
    defaultOptions,
  },
  create(context) {
    const { filename, sourceCode } = context;

    const zones = context.options[0]?.zones ?? [];
    const basePath = context.options[0]?.basePath ?? context.cwd;

    const matchers = zones.map(zone => {
      assert(zone.target != null, 'Zone missing `target`');
      assert(zone.from != null, 'Zone missing `from`');
      const zoneTarget = toArray(zone.target);
      const zoneFrom = toArray(zone.from);
      assert(zoneTarget.length > 0, 'Zone needs at least one `target`');
      assert(zoneFrom.length > 0, 'Zone needs at least one `from`');

      let zoneExcept = zone.except != null ? toArray(zone.except) : null;
      if (zoneExcept?.length === 0) {
        zoneExcept = null;
      }

      let hasGlobPatterns = false;
      let hasNonGlobPatterns = false;

      /** @param {string} target */
      function compilePattern(target) {
        const targetPath = path.resolve(basePath, target);

        const cached = REGEX_CACHE.get(targetPath);
        if (cached != null) {
          return cached;
        }

        /** @type {RegExp | string} */
        let result;
        if (isGlob(targetPath)) {
          hasGlobPatterns = true;
          result = micromatch.makeRe(targetPath);
        } else {
          hasNonGlobPatterns = true;
          result = targetPath;
        }

        if (hasGlobPatterns && hasNonGlobPatterns) {
          throw new Error(
            'Cannot have both glob and non-glob patterns in the same zone'
          );
        }

        REGEX_CACHE.set(targetPath, result);
        return result;
      }

      /** @type {Matcher} */
      const matcher = {
        targetPaths: zoneTarget.map(target => compilePattern(target)),
        fromPaths: zoneFrom.map(from => compilePattern(from)),
        exceptPaths: zoneExcept?.map(except => compilePattern(except)) ?? null,
        message: zone.message ?? null,
      };

      return matcher;
    });

    const targetMatchers = matchers.filter(matcher => {
      return matcher.targetPaths.some(targetPath => {
        return isMatchingTargetPath(filename, targetPath);
      });
    });

    if (targetMatchers.length === 0) {
      return {};
    }

    return createImportSourceVisitor(sourceCode, source => {
      const dirname = path.dirname(filename);
      const moduleName = source.value;

      const resolvedPath = resolveFrom(dirname, moduleName);
      if (resolvedPath == null) {
        return;
      }

      for (const matcher of targetMatchers) {
        const matchesFromPath = matcher.fromPaths.some(fromPath => {
          return isMatchingTargetPath(resolvedPath, fromPath);
        });

        if (!matchesFromPath) {
          continue;
        }

        const matchesExceptPath = matcher.exceptPaths?.some(exceptPath => {
          return isMatchingTargetPath(resolvedPath, exceptPath);
        });

        if (matchesExceptPath) {
          continue;
        }

        if (matcher.message != null) {
          context.report({
            node: source,
            messageId: 'pathRestrictedWithMessage',
            data: { moduleName, message: matcher.message },
          });
        } else {
          context.report({
            node: source,
            messageId: 'pathRestrictedNoMessage',
            data: { moduleName },
          });
        }
      }
    });
  },
});
