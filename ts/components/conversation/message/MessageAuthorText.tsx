import React from 'react';
import { useSelector } from 'react-redux';
import { MessageModelType } from '../../../models/messageType';
import { PubKey } from '../../../session/types/PubKey';
import {
  isGroupConversation,
  isPublicGroupConversation,
} from '../../../state/selectors/conversations';
import { Flex } from '../../basic/Flex';
import { ContactName } from '../ContactName';

export type MessageAuthorProps = {
  authorName: string | null;
  authorProfileName: string | null;
  authorPhoneNumber: string;
  direction: MessageModelType;
  firstMessageOfSeries: boolean;
};

export const MessageAuthorText = (props: MessageAuthorProps) => {
  const {
    authorName,
    authorPhoneNumber,
    authorProfileName,
    direction,
    firstMessageOfSeries,
  } = props;

  const isPublic = useSelector(isPublicGroupConversation);
  const isGroup = useSelector(isGroupConversation);

  const title = authorName ? authorName : authorPhoneNumber;

  if (direction !== 'incoming' || !isGroup || !title || !firstMessageOfSeries) {
    return null;
  }

  const shortenedPubkey = PubKey.shorten(authorPhoneNumber);

  const displayedPubkey = authorProfileName ? shortenedPubkey : authorPhoneNumber;

  return (
    <Flex container={true}>
      <ContactName
        phoneNumber={displayedPubkey}
        name={authorName}
        profileName={authorProfileName}
        module="module-message__author"
        boldProfileName={true}
        shouldShowPubkey={Boolean(isPublic)}
      />
    </Flex>
  );
};
