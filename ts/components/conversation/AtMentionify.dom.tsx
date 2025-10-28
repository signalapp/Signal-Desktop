// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import lodash from 'lodash';
import type {
  HydratedBodyRangeMention,
  BodyRange,
} from '../../types/BodyRange.std.js';
import { AtMention } from './AtMention.dom.js';

const { sortBy } = lodash;

export type Props = {
  mentions?: ReadonlyArray<HydratedBodyRangeMention>;
  direction?: 'incoming' | 'outgoing';
  showConversation?: (options: {
    conversationId: string;
    messageId?: string;
  }) => unknown;
  text: string;
};

export function AtMentionify({
  mentions,
  direction,
  showConversation,
  text,
}: Props): JSX.Element {
  if (!mentions) {
    return <>{text}</>;
  }

  const MENTIONS_REGEX = /(\uFFFC@(\d+))/g;

  let match = MENTIONS_REGEX.exec(text);
  let last = 0;

  const rangeStarts = new Map<number, HydratedBodyRangeMention>();
  mentions.forEach(range => {
    rangeStarts.set(range.start, range);
  });

  const results = [];
  while (match) {
    if (last < match.index) {
      const textWithNoMentions = text.slice(last, match.index);
      results.push(textWithNoMentions);
    }

    const rangeStart = Number(match[2]);
    const range = rangeStarts.get(rangeStart);

    if (range) {
      results.push(
        <AtMention
          key={range.start}
          direction={direction}
          isInvisible={false}
          onClick={() => {
            if (showConversation) {
              showConversation({ conversationId: range.conversationID });
            }
          }}
          onKeyUp={e => {
            if (
              e.target === e.currentTarget &&
              e.keyCode === 13 &&
              showConversation
            ) {
              showConversation({ conversationId: range.conversationID });
            }
          }}
          id={range.conversationID}
          name={range.replacementText}
        />
      );
    }

    last = MENTIONS_REGEX.lastIndex;
    match = MENTIONS_REGEX.exec(text);
  }

  if (last < text.length) {
    results.push(text.slice(last));
  }

  return <>{results}</>;
}

// At-mentions need to be pre-processed before being pushed through the
// AtMentionify component, this is due to bodyRanges containing start+length
// values that operate on the raw string. The text has to be passed through
// other components before being rendered in the <MessageBody />, components
// such as Linkify, and Emojify. These components receive the text prop as a
// string, therefore we're unable to mark it up with DOM nodes prior to handing
// it off to them. This function will encode the "start" position into the text
// string so we can later pull it off when rendering the @mention.
AtMentionify.preprocessMentions = <T extends BodyRange.Mention>(
  text: string,
  mentions?: ReadonlyArray<BodyRange<T>>
): string => {
  if (!mentions || !mentions.length) {
    return text;
  }

  // Sorting by the start index to ensure that we always replace last -> first.
  return sortBy(mentions, 'start').reduceRight((str, range) => {
    const textBegin = str.substr(0, range.start);
    const encodedMention = `\uFFFC@${range.start}`;
    const textEnd = str.substr(range.start + range.length, str.length);
    return `${textBegin}${encodedMention}${textEnd}`;
  }, text);
};
