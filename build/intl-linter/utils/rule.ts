// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type {
  MessageFormatElement,
  Location,
} from '@formatjs/icu-messageformat-parser';
import type { Visitor } from './traverse';
import { traverse } from './traverse';

export type Element = MessageFormatElement;
export type { Location };

export type Context = {
  messageId: string;
  report(
    message: string,
    location: Location | void,
    locationOffset?: number
  ): void;
};

export type RuleFactory = {
  (context: Context): Visitor;
};

export type Rule = {
  id: string;
  run(elements: Array<MessageFormatElement>, context: Context): void;
};

export function rule(id: string, ruleFactory: RuleFactory): Rule {
  return {
    id,
    run(elements, context) {
      traverse(null, elements, ruleFactory(context));
    },
  };
}
