import React from 'react';
import { ConversationTypeEnum } from '../../../models/conversation';
import { MessageModelType } from '../../../models/messageType';
import { PubKey } from '../../../session/types/PubKey';
import { Flex } from '../../basic/Flex';
import { ContactName } from '../ContactName';

export type MessageAuthorProps = {
  authorName: string | null;
  authorProfileName: string | null;
  authorPhoneNumber: string;
  conversationType: ConversationTypeEnum;
  direction: MessageModelType;
  isPublic: boolean;
  firstMessageOfSeries: boolean;
};

export const MessageAuthorText = (props: MessageAuthorProps) => {
  const {
    authorName,
    authorPhoneNumber,
    authorProfileName,
    conversationType,
    direction,
    isPublic,
    firstMessageOfSeries,
  } = props;

  const title = authorName ? authorName : authorPhoneNumber;

  if (direction !== 'incoming' || conversationType !== 'group' || !title || !firstMessageOfSeries) {
    return null;
  }

  const shortenedPubkey = PubKey.shorten(authorPhoneNumber);

  const displayedPubkey = authorProfileName ? shortenedPubkey : authorPhoneNumber;

  return (
    <div className="module-message__author">
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
    </div>
  );
};
