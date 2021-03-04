// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, {
  useCallback,
  CSSProperties,
  FunctionComponent,
  ReactNode,
} from 'react';
import { escapeRegExp } from 'lodash';

import { MessageBodyHighlight } from './MessageBodyHighlight';
import { ContactName } from '../conversation/ContactName';

import { assert } from '../../util/assert';
import { BodyRangesType, LocalizerType } from '../../types/Util';
import { ColorType } from '../../types/Colors';
import { BaseConversationListItem } from './BaseConversationListItem';

export type PropsDataType = {
  isSelected?: boolean;
  isSearchingInConversation?: boolean;

  id: string;
  conversationId: string;
  sentAt?: number;

  snippet: string;
  body: string;
  bodyRanges: BodyRangesType;

  from: {
    phoneNumber?: string;
    title: string;
    isMe?: boolean;
    name?: string;
    color?: ColorType;
    profileName?: string;
    avatarPath?: string;
  };

  to: {
    groupName?: string;
    phoneNumber?: string;
    title: string;
    isMe?: boolean;
    name?: string;
    profileName?: string;
  };
};

type PropsHousekeepingType = {
  i18n: LocalizerType;
  openConversationInternal: (_: {
    conversationId: string;
    messageId?: string;
  }) => void;
  style: CSSProperties;
};

export type PropsType = PropsDataType & PropsHousekeepingType;

const renderPerson = (
  i18n: LocalizerType,
  person: Readonly<{
    isMe?: boolean;
    name?: string;
    phoneNumber?: string;
    profileName?: string;
    title: string;
  }>
): ReactNode =>
  person.isMe ? (
    i18n('you')
  ) : (
    <ContactName
      phoneNumber={person.phoneNumber}
      name={person.name}
      profileName={person.profileName}
      title={person.title}
      i18n={i18n}
    />
  );

// This function exists because bodyRanges tells us the character position
// where the at-mention starts at according to the full body text. The snippet
// we get back is a portion of the text and we don't know where it starts. This
// function will find the relevant bodyRanges that apply to the snippet and
// then update the proper start position of each body range.
function getFilteredBodyRanges(
  snippet: string,
  body: string,
  bodyRanges: BodyRangesType
): BodyRangesType {
  // Find where the snippet starts in the full text
  const stripped = snippet
    .replace(/<<left>>/g, '')
    .replace(/<<right>>/g, '')
    .replace(/^.../, '')
    .replace(/...$/, '');
  const rx = new RegExp(escapeRegExp(stripped));
  const match = rx.exec(body);

  assert(Boolean(match), `No match found for "${snippet}" inside "${body}"`);

  const delta = match ? match.index + snippet.length : 0;

  // Filters out the @mentions that are present inside the snippet
  const filteredBodyRanges = bodyRanges.filter(bodyRange => {
    return bodyRange.start < delta;
  });

  const snippetBodyRanges = [];
  const MENTIONS_REGEX = /\uFFFC/g;

  let bodyRangeMatch = MENTIONS_REGEX.exec(snippet);
  let i = 0;

  // Find the start position within the snippet so these can later be
  // encoded and rendered correctly.
  while (bodyRangeMatch) {
    const bodyRange = filteredBodyRanges[i];

    if (bodyRange) {
      snippetBodyRanges.push({
        ...bodyRange,
        start: bodyRangeMatch.index,
      });
    } else {
      assert(
        false,
        `Body range does not exist? Count: ${i}, Length: ${filteredBodyRanges.length}`
      );
    }

    bodyRangeMatch = MENTIONS_REGEX.exec(snippet);
    i += 1;
  }

  return snippetBodyRanges;
}

export const MessageSearchResult: FunctionComponent<PropsType> = React.memo(
  ({
    body,
    bodyRanges,
    conversationId,
    from,
    i18n,
    id,
    openConversationInternal,
    sentAt,
    snippet,
    style,
    to,
  }) => {
    const onClickItem = useCallback(() => {
      openConversationInternal({ conversationId, messageId: id });
    }, [openConversationInternal, conversationId, id]);

    if (!from || !to) {
      return <div style={style} />;
    }

    const isNoteToSelf = from.isMe && to.isMe;

    let headerName: ReactNode;
    if (isNoteToSelf) {
      headerName = i18n('noteToSelf');
    } else {
      // This isn't perfect because (1) it doesn't work with RTL languages (2)
      //   capitalization may be incorrect for some languages, like English.
      headerName = (
        <>
          {renderPerson(i18n, from)} {i18n('toJoiner')} {renderPerson(i18n, to)}
        </>
      );
    }

    const snippetBodyRanges = getFilteredBodyRanges(snippet, body, bodyRanges);
    const messageText = (
      <MessageBodyHighlight
        text={snippet}
        bodyRanges={snippetBodyRanges}
        i18n={i18n}
      />
    );

    return (
      <BaseConversationListItem
        avatarPath={from.avatarPath}
        color={from.color}
        conversationType="direct"
        headerDate={sentAt}
        headerName={headerName}
        i18n={i18n}
        id={id}
        isNoteToSelf={isNoteToSelf}
        isMe={from.isMe}
        isSelected={false}
        messageText={messageText}
        name={from.name}
        onClick={onClickItem}
        phoneNumber={from.phoneNumber}
        profileName={from.profileName}
        style={style}
        title={from.title}
      />
    );
  }
);
