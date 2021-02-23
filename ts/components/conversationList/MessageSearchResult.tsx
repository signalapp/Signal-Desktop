// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, {
  useCallback,
  CSSProperties,
  FunctionComponent,
  ReactNode,
} from 'react';

import { MessageBodyHighlight } from './MessageBodyHighlight';
import { ContactName } from '../conversation/ContactName';

import { LocalizerType } from '../../types/Util';
import { ColorType } from '../../types/Colors';
import { BaseConversationListItem } from './BaseConversationListItem';

export type PropsDataType = {
  isSelected?: boolean;
  isSearchingInConversation?: boolean;

  id: string;
  conversationId: string;
  sentAt?: number;

  snippet: string;

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

export const MessageSearchResult: FunctionComponent<PropsType> = React.memo(
  ({
    id,
    conversationId,
    from,
    to,
    sentAt,
    i18n,
    openConversationInternal,
    style,
    snippet,
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

    const messageText = <MessageBodyHighlight text={snippet} i18n={i18n} />;

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
