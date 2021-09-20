import React from 'react';
import { useSelector } from 'react-redux';
import { MessageRenderingProps } from '../../../models/messageType';
import { PubKey } from '../../../session/types/PubKey';
import {
  getMessageAuthorProps,
  isGroupConversation,
  isPublicGroupConversation,
} from '../../../state/selectors/conversations';
import { Flex } from '../../basic/Flex';
import { ContactName } from '../ContactName';

export type MessageAuthorSelectorProps = Pick<
  MessageRenderingProps,
  'authorName' | 'authorProfileName' | 'authorPhoneNumber' | 'direction' | 'firstMessageOfSeries'
>;

type Props = {
  messageId: string;
};

export const MessageAuthorText = (props: Props) => {
  const selected = useSelector(state => getMessageAuthorProps(state as any, props.messageId));

  const isPublic = useSelector(isPublicGroupConversation);
  const isGroup = useSelector(isGroupConversation);
  if (!selected) {
    return null;
  }
  const {
    authorName,
    authorPhoneNumber,
    authorProfileName,
    direction,
    firstMessageOfSeries,
  } = selected;

  const title = authorName ? authorName : authorPhoneNumber;

  if (direction !== 'incoming' || !isGroup || !title || !firstMessageOfSeries) {
    return null;
  }

  const shortenedPubkey = PubKey.shorten(authorPhoneNumber);

  const displayedPubkey = authorProfileName ? shortenedPubkey : authorPhoneNumber;

  return (
    <Flex container={true}>
      <ContactName
        pubkey={displayedPubkey}
        name={authorName}
        profileName={authorProfileName}
        module="module-message__author"
        boldProfileName={true}
        shouldShowPubkey={Boolean(isPublic)}
      />
    </Flex>
  );
};
