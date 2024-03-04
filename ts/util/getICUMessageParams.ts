// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { TYPE, parse } from '@formatjs/icu-messageformat-parser';
import type {
  MessageFormatElement,
  PluralOrSelectOption,
} from '@formatjs/icu-messageformat-parser';
import { missingCaseError } from './missingCaseError';

export type ICUMessageParamType = Readonly<
  | {
      type: 'string' | 'date' | 'number' | 'jsx' | 'time';
    }
  | {
      type: 'select';
      validOptions: ReadonlyArray<string>;
    }
>;

export function getICUMessageParams(
  message: string,
  defaultRichTextElementNames: Array<string> = []
): Map<string, ICUMessageParamType> {
  const params = new Map();

  function visitOptions(options: Record<string, PluralOrSelectOption>) {
    for (const option of Object.values(options)) {
      visit(option.value);
    }
  }

  function visit(elements: ReadonlyArray<MessageFormatElement>) {
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
          throw missingCaseError(element);
      }
    }
  }

  visit(parse(message));

  for (const defaultRichTextElementName of defaultRichTextElementNames) {
    params.delete(defaultRichTextElementName);
  }

  return params;
}
