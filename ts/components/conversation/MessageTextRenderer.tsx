// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import type { ReactElement } from 'react';
import classNames from 'classnames';
import emojiRegex from 'emoji-regex';
import { sortBy } from 'lodash';

import { linkify, SUPPORTED_PROTOCOLS } from './Linkify';
import type {
  BodyRangesForDisplayType,
  DisplayNode,
  HydratedBodyRangeMention,
  RangeNode,
} from '../../types/BodyRange';
import {
  BodyRange,
  insertRange,
  collapseRangeTree,
  groupContiguousSpoilers,
} from '../../types/BodyRange';
import { AtMention } from './AtMention';
import { isLinkSneaky } from '../../types/LinkPreview';
import { Emojify } from './Emojify';
import { AddNewLines } from './AddNewLines';
import type { SizeClassType } from '../emoji/lib';
import type { LocalizerType } from '../../types/Util';

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
  emojiSizeClass: SizeClassType | undefined;
  i18n: LocalizerType;
  isSpoilerExpanded: Record<number, boolean>;
  messageText: string;
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
  emojiSizeClass,
  i18n,
  isSpoilerExpanded,
  messageText,
  onExpandSpoiler,
  onMentionTrigger,
  renderLocation,
  textLength,
}: Props): JSX.Element {
  const finalNodes = React.useMemo(() => {
    const links = disableLinks ? [] : extractLinks(messageText);

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
  }, [bodyRanges, disableLinks, messageText, textLength]);

  return (
    <>
      {finalNodes.map(node =>
        renderNode({
          direction,
          disableLinks,
          emojiSizeClass,
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
  emojiSizeClass,
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
  emojiSizeClass: SizeClassType | undefined;
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
        emojiSizeClass,
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
    emojiSizeClass,
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
      <a key={key} className={formattingClasses} href={node.url}>
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
  emojiSizeClass,
  isInvisible,
  mentions,
  node,
  onMentionTrigger,
}: {
  direction: 'incoming' | 'outgoing' | undefined;
  disableLinks: boolean;
  emojiSizeClass: SizeClassType | undefined;
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
          emojiSizeClass,
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
      emojiSizeClass,
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
  emojiSizeClass,
  isInvisible,
  key,
}: {
  text: string;
  emojiSizeClass: SizeClassType | undefined;
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
      sizeClass={emojiSizeClass}
      text={text}
    />
  );
}

export function extractLinks(
  messageText: string
): ReadonlyArray<BodyRange<{ url: string }>> {
  // to support emojis immediately before links
  // we replace emojis with a space for each byte
  const matches = linkify.match(
    messageText.replace(EMOJI_REGEXP, s => ' '.repeat(s.length))
  );

  if (matches == null) {
    return [];
  }

  return matches.map(match => {
    return {
      start: match.index,
      length: match.lastIndex - match.index,
      url: match.url,
    };
  });
}
