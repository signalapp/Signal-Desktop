// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check
import { TYPE, parse } from '@formatjs/icu-messageformat-parser'
import { unreachable } from './assert.mjs';

/** @import { MessageFormatElement, PluralOrSelectOption } from '@formatjs/icu-messageformat-parser' */

/**
 * @typedef {Readonly<
 *   | {
 *      type: 'string' | 'date' | 'number' | 'jsx' | 'time';
 *     }
 *   | {
 *       type: 'select';
 *       validOptions: ReadonlyArray<string>;
 *     }
 * >} ICUMessageParamType
 */

/**
 * @param {string} message
 * @param {string[]} defaultRichTextElementNames
 * @returns {Map<string, ICUMessageParamType>}
 */
export function getICUMessageParams(message, defaultRichTextElementNames = []) {
  const params = new Map();

  /**
   * @param {Record<string, PluralOrSelectOption>} options
   */
  function visitOptions(options) {
    for (const option of Object.values(options)) {
      visit(option.value);
    }
  }

  /**
   * @param {ReadonlyArray<MessageFormatElement>} elements
   */
  function visit(elements) {
    for (const element of elements) {
      switch (element.type) {
        case TYPE.argument:
          params.set(element.value, { type: 'string' });
          break;
        case TYPE.date:
          params.set(element.value, { type: 'Date' });
          break;
        case TYPE.literal:
          break;
        case TYPE.number:
          params.set(element.value, { type: 'number' });
          break;
        case TYPE.plural:
          params.set(element.value, { type: 'number' });
          visitOptions(element.options);
          break;
        case TYPE.pound:
          break;
        case TYPE.select: {
          const validOptions = Object.entries(element.options)
            // We use empty {other ...} to satisfy smartling, but don't allow
            // it in the app.
            .filter(([key, { value }]) => key !== 'other' || value.length)
            .map(([key]) => key);
          params.set(element.value, { type: 'select', validOptions });
          visitOptions(element.options);
          break;
        }
        case TYPE.tag:
          params.set(element.value, { type: 'jsx' });
          visit(element.children);
          break;
        case TYPE.time:
          params.set(element.value, { type: 'time' });
          break;
        default:
          unreachable(element);
      }
    }
  }

  visit(parse(message));

  for (const defaultRichTextElementName of defaultRichTextElementNames) {
    params.delete(defaultRichTextElementName);
  }

  return params;
}
