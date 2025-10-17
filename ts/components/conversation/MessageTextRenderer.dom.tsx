// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import type { ReactElement } from 'react';
import classNames from 'classnames';
import emojiRegex from 'emoji-regex';
import lodash from 'lodash';

import { linkify, SUPPORTED_PROTOCOLS } from './Linkify.dom.js';
import type {
  BodyRangesForDisplayType,
  DisplayNode,
  HydratedBodyRangeMention,
  RangeNode,
} from '../../types/BodyRange.std.js';
import {
  BodyRange,
  insertRange,
  collapseRangeTree,
  groupContiguousSpoilers,
} from '../../types/BodyRange.std.js';
import { AtMention } from './AtMention.dom.js';
import { isLinkSneaky } from '../../types/LinkPreview.std.js';
import { Emojify } from './Emojify.dom.js';
import { AddNewLines } from './AddNewLines.dom.js';
import type { LocalizerType } from '../../types/Util.std.js';
import type { FunJumboEmojiSize } from '../fun/FunEmoji.dom.js';

const { sortBy } = lodash;

const EMOJI_REGEXP = emojiRegex();
export enum RenderLocation {
  ConversationList = 'ConversationList',
  Quote = 'Quote',
  MediaEditor = 'MediaEditor',
  SearchResult = 'SearchResult',
  StoryViewer = 'StoryViewer',
  Timeline = 'Timeline',
}

type Props = {
  bodyRanges: BodyRangesForDisplayType;
  direction: 'incoming' | 'outgoing' | undefined;
  disableLinks: boolean;
  jumboEmojiSize: FunJumboEmojiSize | null;
  i18n: LocalizerType;
  isSpoilerExpanded: Record<number, boolean>;
  messageText: string;
  originalMessageText: string;
  onExpandSpoiler?: (data: Record<number, boolean>) => void;
  onMentionTrigger: (conversationId: string) => void;
  renderLocation: RenderLocation;
  // Sometimes we're passed a string with a suffix (like '...'); we won't process that
  textLength: number;
};

export function MessageTextRenderer({
  bodyRanges,
  direction,
  disableLinks,
  jumboEmojiSize,
  i18n,
  isSpoilerExpanded,
  messageText,
  onExpandSpoiler,
  onMentionTrigger,
  renderLocation,
  textLength,
  originalMessageText,
}: Props): JSX.Element {
  const finalNodes = React.useMemo(() => {
    const links = disableLinks
      ? []
      : extractLinks(messageText, originalMessageText);

    // We need mentions to come last; they can't have children for proper rendering
    const sortedRanges = sortBy(bodyRanges, range =>
      BodyRange.isMention(range) ? 1 : 0
    );

    // Create range tree, dropping bodyRanges that don't apply. Read More means truncated
    //   strings.
    let spoilerCount = 0;
    const tree = sortedRanges.reduce<ReadonlyArray<RangeNode>>(
      (acc, range) => {
        if (
          BodyRange.isFormatting(range) &&
          range.style === BodyRange.Style.SPOILER
        ) {
          spoilerCount += 1;
          return insertRange(
            {
              ...range,
              spoilerId: spoilerCount,
            },
            acc
          );
        }
        if (range.start < textLength) {
          return insertRange(range, acc);
        }
        return acc;
      },
      links.map(b => ({ ...b, ranges: [] }))
    );

    // Turn tree into flat list for proper spoiler rendering
    const nodes = collapseRangeTree({ tree, text: messageText });

    // Group all contigusous spoilers to create one parent spoiler element in the DOM
    return groupContiguousSpoilers(nodes);
  }, [bodyRanges, disableLinks, messageText, originalMessageText, textLength]);

  return (
    <>
      {finalNodes.map(node =>
        renderNode({
          direction,
          disableLinks,
          jumboEmojiSize,
          i18n,
          isInvisible: false,
          isSpoilerExpanded,
          node,
          renderLocation,
          onMentionTrigger,
          onExpandSpoiler,
        })
      )}
    </>
  );
}

function renderNode({
  direction,
  disableLinks,
  jumboEmojiSize,
  i18n,
  isInvisible,
  isSpoilerExpanded,
  node,
  onExpandSpoiler,
  onMentionTrigger,
  renderLocation,
}: {
  direction: 'incoming' | 'outgoing' | undefined;
  disableLinks: boolean;
  jumboEmojiSize: FunJumboEmojiSize | null;
  i18n: LocalizerType;
  isInvisible: boolean;
  isSpoilerExpanded: Record<number, boolean>;
  node: DisplayNode;
  onExpandSpoiler?: (data: Record<number, boolean>) => void;
  onMentionTrigger: ((conversationId: string) => void) | undefined;
  renderLocation: RenderLocation;
}): ReactElement {
  const key = node.start;

  if (node.isSpoiler && node.spoilerChildren?.length) {
    const isSpoilerHidden = Boolean(
      node.isSpoiler && !isSpoilerExpanded[node.spoilerId || 0]
    );
    const content = node.spoilerChildren?.map(spoilerNode =>
      renderNode({
        direction,
        disableLinks,
        jumboEmojiSize,
        i18n,
        isInvisible: isSpoilerHidden,
        isSpoilerExpanded,
        node: spoilerNode,
        renderLocation,
        onMentionTrigger,
        onExpandSpoiler,
      })
    );

    if (!isSpoilerHidden) {
      return (
        <span
          key={key}
          className="MessageTextRenderer__formatting--spoiler--revealed"
        >
          {content}
        </span>
      );
    }

    return (
      <span
        key={key}
        tabIndex={disableLinks ? undefined : 0}
        role={disableLinks ? undefined : 'button'}
        aria-label={i18n('icu:MessageTextRenderer--spoiler--label')}
        aria-expanded={false}
        className={classNames(
          'MessageTextRenderer__formatting--spoiler',
          `MessageTextRenderer__formatting--spoiler-${renderLocation}`,
          direction
            ? `MessageTextRenderer__formatting--spoiler-${renderLocation}--${direction}`
            : null,
          disableLinks
            ? 'MessageTextRenderer__formatting--spoiler--noninteractive'
            : null
        )}
        onClick={
          disableLinks
            ? undefined
            : event => {
                if (onExpandSpoiler) {
                  event.preventDefault();
                  event.stopPropagation();
                  onExpandSpoiler({
                    ...isSpoilerExpanded,
                    [node.spoilerId || 0]: true,
                  });
                }
              }
        }
        onKeyDown={
          disableLinks
            ? undefined
            : event => {
                if (event.key !== 'Enter' && event.key !== ' ') {
                  return;
                }
                event.preventDefault();
                event.stopPropagation();
                onExpandSpoiler?.({
                  ...isSpoilerExpanded,
                  [node.spoilerId || 0]: true,
                });
              }
        }
      >
        <span aria-hidden>{content}</span>
      </span>
    );
  }

  let content = renderMentions({
    direction,
    disableLinks,
    jumboEmojiSize,
    isInvisible,
    mentions: node.mentions,
    onMentionTrigger,
    node,
  });

  // We use separate elements for these because we want screenreaders to understand them
  if (node.isBold || node.isKeywordHighlight) {
    content = <strong>{content}</strong>;
  }
  if (node.isItalic) {
    content = <em>{content}</em>;
  }
  if (node.isStrikethrough) {
    content = <s>{content}</s>;
  }

  const formattingClasses = classNames(
    node.isMonospace ? 'MessageTextRenderer__formatting--monospace' : null,
    node.isKeywordHighlight
      ? 'MessageTextRenderer__formatting--keywordHighlight'
      : null,
    isInvisible ? 'MessageTextRenderer__formatting--invisible' : null
  );

  if (
    node.url &&
    SUPPORTED_PROTOCOLS.test(node.url) &&
    !isLinkSneaky(node.url)
  ) {
    return (
      <a
        key={key}
        className={formattingClasses}
        href={node.url}
        target="_blank"
        rel="noreferrer"
      >
        {content}
      </a>
    );
  }

  return (
    <span key={key} className={formattingClasses}>
      {content}
    </span>
  );
}

function renderMentions({
  direction,
  disableLinks,
  jumboEmojiSize,
  isInvisible,
  mentions,
  node,
  onMentionTrigger,
}: {
  direction: 'incoming' | 'outgoing' | undefined;
  disableLinks: boolean;
  jumboEmojiSize: FunJumboEmojiSize | null;
  isInvisible: boolean;
  mentions: ReadonlyArray<HydratedBodyRangeMention>;
  node: DisplayNode;
  onMentionTrigger: ((conversationId: string) => void) | undefined;
}): ReactElement {
  const result: Array<ReactElement> = [];
  const { text } = node;

  let offset = 0;

  for (const mention of mentions) {
    // collect any previous text
    if (mention.start > offset) {
      result.push(
        renderText({
          isInvisible,
          key: result.length.toString(),
          jumboEmojiSize,
          text: text.slice(offset, mention.start),
        })
      );
    }

    result.push(
      renderMention({
        isInvisible,
        key: result.length.toString(),
        conversationId: mention.conversationID,
        disableLinks,
        direction,
        name: mention.replacementText,
        node,
        onMentionTrigger,
      })
    );

    offset = mention.start + mention.length;
  }

  // collect any text after
  result.push(
    renderText({
      isInvisible,
      key: result.length.toString(),
      jumboEmojiSize,
      text: text.slice(offset, text.length),
    })
  );

  return <>{result}</>;
}

function renderMention({
  conversationId,
  direction,
  disableLinks,
  isInvisible,
  key,
  name,
  node,
  onMentionTrigger,
}: {
  conversationId: string;
  direction: 'incoming' | 'outgoing' | undefined;
  disableLinks: boolean;
  isInvisible: boolean;
  key: string;
  name: string;
  node: DisplayNode;
  onMentionTrigger: ((conversationId: string) => void) | undefined;
}): ReactElement {
  if (disableLinks) {
    return (
      <bdi key={key}>
        @
        <Emojify isInvisible={isInvisible} text={name} />
      </bdi>
    );
  }

  return (
    <AtMention
      key={key}
      id={conversationId}
      isInvisible={isInvisible}
      isStrikethrough={node.isStrikethrough}
      name={name}
      direction={direction}
      onClick={() => {
        if (onMentionTrigger) {
          onMentionTrigger(conversationId);
        }
      }}
      onKeyUp={e => {
        if (
          e.target === e.currentTarget &&
          e.key === 'Enter' &&
          onMentionTrigger
        ) {
          onMentionTrigger(conversationId);
        }
      }}
    />
  );
}
/** Render text that does not contain body ranges or is in between body ranges */
function renderText({
  text,
  jumboEmojiSize,
  isInvisible,
  key,
}: {
  text: string;
  jumboEmojiSize: FunJumboEmojiSize | null;
  isInvisible: boolean;
  key: string;
}) {
  return (
    <Emojify
      key={key}
      isInvisible={isInvisible}
      renderNonEmoji={({ text: innerText, key: innerKey }) => (
        <AddNewLines key={innerKey} text={innerText} />
      )}
      fontSizeOverride={jumboEmojiSize}
      text={text}
    />
  );
}

export function extractLinks(
  messageText: string,
  // Full, untruncated message text
  originalMessageText: string
): ReadonlyArray<BodyRange<{ url: string }>> {
  // to support emojis immediately before links
  // we replace emojis with a space for each byte
  const matches = linkify.match(
    originalMessageText.replace(EMOJI_REGEXP, s => ' '.repeat(s.length))
  );

  if (matches == null) {
    return [];
  }

  // Only return matches present in the `messageText`
  const currentMatches = matches.filter(({ index, lastIndex, url }) => {
    if (index >= messageText.length) {
      return false;
    }

    if (lastIndex > messageText.length) {
      return false;
    }

    return messageText.slice(index, lastIndex) === url;
  });

  return currentMatches.map(match => {
    return {
      start: match.index,
      length: match.lastIndex - match.index,
      url: match.url,
    };
  });
}
