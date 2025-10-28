// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { FunctionComponent, ReactNode } from 'react';
import React, { useCallback } from 'react';
import lodash from 'lodash';

import { ContactName } from '../conversation/ContactName.dom.js';

import type { BodyRangesForDisplayType } from '../../types/BodyRange.std.js';
import { processBodyRangesForSearchResult } from '../../types/BodyRange.std.js';
import type { LocalizerType, ThemeType } from '../../types/Util.std.js';
import { BaseConversationListItem } from './BaseConversationListItem.dom.js';
import type {
  ConversationType,
  ShowConversationType,
} from '../../state/ducks/conversations.preload.js';
import type { PreferredBadgeSelectorType } from '../../state/selectors/badges.preload.js';
import { I18n } from '../I18n.dom.js';
import {
  MessageTextRenderer,
  RenderLocation,
} from '../conversation/MessageTextRenderer.dom.js';

const { noop } = lodash;

const EMPTY_OBJECT = Object.freeze(Object.create(null));

export type PropsDataType = {
  isSelected?: boolean;
  isSearchingInConversation?: boolean;

  id: string;
  conversationId: string;
  sentAt?: number;

  snippet: string;
  body: string;
  bodyRanges: BodyRangesForDisplayType;

  from: Pick<
    ConversationType,
    | 'acceptedMessageRequest'
    | 'avatarUrl'
    | 'badges'
    | 'color'
    | 'isMe'
    | 'phoneNumber'
    | 'profileName'
    | 'sharedGroupNames'
    | 'title'
    | 'type'
  >;

  to: Pick<
    ConversationType,
    'isMe' | 'phoneNumber' | 'profileName' | 'title' | 'type'
  >;
};

type PropsHousekeepingType = {
  getPreferredBadge: PreferredBadgeSelectorType;
  i18n: LocalizerType;
  showConversation: ShowConversationType;
  theme: ThemeType;
};

export type PropsType = PropsDataType & PropsHousekeepingType;

const renderPerson = (
  i18n: LocalizerType,
  person: Readonly<{
    isMe?: boolean;
    title: string;
  }>
): JSX.Element =>
  person.isMe ? (
    <I18n i18n={i18n} id="icu:you" />
  ) : (
    <ContactName title={person.title} />
  );

export const MessageSearchResult: FunctionComponent<PropsType> = React.memo(
  function MessageSearchResult({
    body,
    bodyRanges,
    conversationId,
    from,
    getPreferredBadge,
    i18n,
    id,
    sentAt,
    showConversation,
    snippet,
    theme,
    to,
  }) {
    const onClickItem = useCallback(() => {
      showConversation({ conversationId, messageId: id });
    }, [showConversation, conversationId, id]);

    if (!from || !to) {
      // Note: mapStateToProps() may return null if the message is not found.
      return <div />;
    }

    const isNoteToSelf = from.isMe && to.isMe;

    let headerName: ReactNode;
    if (isNoteToSelf) {
      headerName = i18n('icu:noteToSelf');
    } else if (from.isMe) {
      if (to.type === 'group') {
        headerName = (
          <span>
            <I18n
              i18n={i18n}
              id="icu:searchResultHeader--you-to-group"
              components={{
                receiverGroup: renderPerson(i18n, to),
              }}
            />
          </span>
        );
      } else {
        headerName = (
          <span>
            <I18n
              i18n={i18n}
              id="icu:searchResultHeader--you-to-receiver"
              components={{
                receiverContact: renderPerson(i18n, to),
              }}
            />
          </span>
        );
      }
    } else {
      // eslint-disable-next-line no-lonely-if
      if (to.type === 'group') {
        headerName = (
          <span>
            <I18n
              i18n={i18n}
              id="icu:searchResultHeader--sender-to-group"
              components={{
                sender: renderPerson(i18n, from),
                receiverGroup: renderPerson(i18n, to),
              }}
            />
          </span>
        );
      } else {
        headerName = (
          <span>
            <I18n
              i18n={i18n}
              id="icu:searchResultHeader--sender-to-you"
              components={{
                sender: renderPerson(i18n, from),
              }}
            />
          </span>
        );
      }
    }

    const { cleanedSnippet, bodyRanges: displayBodyRanges } =
      processBodyRangesForSearchResult({ snippet, body, bodyRanges });
    const messageText = (
      <MessageTextRenderer
        messageText={cleanedSnippet}
        originalMessageText={cleanedSnippet}
        bodyRanges={displayBodyRanges}
        direction={undefined}
        disableLinks
        jumboEmojiSize={null}
        i18n={i18n}
        isSpoilerExpanded={EMPTY_OBJECT}
        onMentionTrigger={noop}
        renderLocation={RenderLocation.SearchResult}
        textLength={cleanedSnippet.length}
      />
    );

    return (
      <BaseConversationListItem
        avatarUrl={from.avatarUrl}
        badge={getPreferredBadge(from.badges)}
        color={from.color}
        conversationType="direct"
        headerDate={sentAt}
        headerName={headerName}
        i18n={i18n}
        id={id}
        isMe={from.isMe}
        isNoteToSelf={isNoteToSelf}
        isSelected={false}
        messageText={messageText}
        onClick={onClickItem}
        phoneNumber={from.phoneNumber}
        profileName={from.profileName}
        sharedGroupNames={from.sharedGroupNames}
        theme={theme}
        title={from.title}
      />
    );
  }
);
