// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type {
  MessageFormatElement,
  LiteralElement,
  ArgumentElement,
  NumberElement,
  DateElement,
  TimeElement,
  SelectElement,
  PluralElement,
  PoundElement,
  TagElement,
} from '@formatjs/icu-messageformat-parser';
import { TYPE } from '@formatjs/icu-messageformat-parser';

export type VisitorMethod<T extends MessageFormatElement> = (
  element: T,
  parent: MessageFormatElement | null
) => void;

export type Visitor = {
  enterLiteral?: VisitorMethod<LiteralElement>;
  exitLiteral?: VisitorMethod<LiteralElement>;
  enterArgument?: VisitorMethod<ArgumentElement>;
  exitArgument?: VisitorMethod<ArgumentElement>;
  enterNumber?: VisitorMethod<NumberElement>;
  exitNumber?: VisitorMethod<NumberElement>;
  enterDate?: VisitorMethod<DateElement>;
  exitDate?: VisitorMethod<DateElement>;
  enterTime?: VisitorMethod<TimeElement>;
  exitTime?: VisitorMethod<TimeElement>;
  enterSelect?: VisitorMethod<SelectElement>;
  exitSelect?: VisitorMethod<SelectElement>;
  enterPlural?: VisitorMethod<PluralElement>;
  exitPlural?: VisitorMethod<PluralElement>;
  enterPound?: VisitorMethod<PoundElement>;
  exitPound?: VisitorMethod<PoundElement>;
  enterTag?: VisitorMethod<TagElement>;
  exitTag?: VisitorMethod<TagElement>;
};

export function traverse(
  parent: MessageFormatElement | null,
  elements: Array<MessageFormatElement>,
  visitor: Visitor
): void {
  for (const element of elements) {
    if (element.type === TYPE.literal) {
      visitor.enterLiteral?.(element, parent);
      visitor.exitLiteral?.(element, parent);
    } else if (element.type === TYPE.argument) {
      visitor.enterArgument?.(element, parent);
      visitor.exitArgument?.(element, parent);
    } else if (element.type === TYPE.number) {
      visitor.enterNumber?.(element, parent);
      visitor.exitNumber?.(element, parent);
    } else if (element.type === TYPE.date) {
      visitor.enterDate?.(element, parent);
      visitor.exitDate?.(element, parent);
    } else if (element.type === TYPE.time) {
      visitor.enterTime?.(element, parent);
      visitor.exitTime?.(element, parent);
    } else if (element.type === TYPE.select) {
      visitor.enterSelect?.(element, parent);
      for (const node of Object.values(element.options)) {
        traverse(element, node.value, visitor);
      }
      visitor.exitSelect?.(element, parent);
    } else if (element.type === TYPE.plural) {
      visitor.enterPlural?.(element, parent);
      for (const node of Object.values(element.options)) {
        traverse(element, node.value, visitor);
      }
      visitor.exitPlural?.(element, parent);
    } else if (element.type === TYPE.pound) {
      visitor.enterPound?.(element, parent);
      visitor.exitPound?.(element, parent);
    } else if (element.type === TYPE.tag) {
      visitor.enterTag?.(element, parent);
      traverse(element, element.children, visitor);
      visitor.exitTag?.(element, parent);
    } else {
      unreachable(element);
    }
  }
}

function unreachable(x: never): never {
  throw new Error(`unreachable: ${x}`);
}
