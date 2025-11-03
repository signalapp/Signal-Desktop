// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import lodash from 'lodash';

import type { SignalService as Proto } from '../protobuf/index.std.js';
import {
  BodyRange,
  type RawBodyRange,
  type HydratedBodyRangeType,
} from '../types/BodyRange.std.js';
import type { AciString } from '../types/ServiceId.std.js';
import { createLogger } from '../logging/log.std.js';
import { isNotNil } from './isNotNil.std.js';
import { dropNull } from './dropNull.std.js';
import { fromAciUuidBytesOrString } from './ServiceId.node.js';

const { isNumber } = lodash;

const log = createLogger('BodyRange');

const { BOLD, ITALIC, MONOSPACE, SPOILER, STRIKETHROUGH, NONE } =
  BodyRange.Style;
const MENTION_NAME = 'mention';
const MAX_PER_TYPE = 250;

// We drop unknown bodyRanges and remove extra stuff so they serialize properly
export function filterAndClean(
  ranges: ReadonlyArray<Proto.IBodyRange | RawBodyRange> | undefined | null
): ReadonlyArray<RawBodyRange> | undefined {
  if (!ranges) {
    return undefined;
  }

  const countByTypeRecord: Record<
    BodyRange.Style | typeof MENTION_NAME,
    number
  > = {
    [MENTION_NAME]: 0,
    [BOLD]: 0,
    [ITALIC]: 0,
    [MONOSPACE]: 0,
    [SPOILER]: 0,
    [STRIKETHROUGH]: 0,
    [NONE]: 0,
  };

  return ranges
    .map(range => {
      const { start: startFromRange, length, ...restOfRange } = range;

      const start = startFromRange ?? 0;
      if (!isNumber(length)) {
        log.warn('filterAndClean: Dropping bodyRange with non-number length');
        return undefined;
      }

      let rawMentionAci: string | undefined;
      let mentionAciBinary: Uint8Array | undefined;
      if ('mentionAci' in range) {
        rawMentionAci = dropNull(range.mentionAci);
      }
      if ('mentionAciBinary' in range) {
        mentionAciBinary = dropNull(range.mentionAciBinary);
      }

      let mentionAci: AciString | undefined;
      if (rawMentionAci != null || mentionAciBinary?.length) {
        mentionAci = fromAciUuidBytesOrString(
          mentionAciBinary,
          rawMentionAci,
          'BodyRange.mentionAci'
        );
      }

      if (mentionAci) {
        countByTypeRecord[MENTION_NAME] += 1;
        if (countByTypeRecord[MENTION_NAME] > MAX_PER_TYPE) {
          return undefined;
        }

        return {
          ...restOfRange,
          start,
          length,
          mentionAci,
        };
      }
      if ('style' in range && range.style) {
        countByTypeRecord[range.style] += 1;
        if (countByTypeRecord[range.style] > MAX_PER_TYPE) {
          return undefined;
        }
        return {
          ...restOfRange,
          start,
          length,
          style: range.style,
        };
      }

      log.warn('filterAndClean: Dropping unknown bodyRange');
      return undefined;
    })
    .filter(isNotNil);
}

export function hydrateRanges(
  ranges: ReadonlyArray<BodyRange<object>> | undefined,
  conversationSelector: (id: string) => { id: string; title: string }
): Array<HydratedBodyRangeType> | undefined {
  if (!ranges) {
    return undefined;
  }

  return filterAndClean(ranges)?.map(range => {
    if (BodyRange.isMention(range)) {
      const conversation = conversationSelector(range.mentionAci);

      return {
        ...range,
        conversationID: conversation.id,
        replacementText: conversation.title,
      };
    }

    return range;
  });
}
