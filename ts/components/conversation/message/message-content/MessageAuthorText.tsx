import React from 'react';
import { useSelector } from 'react-redux';
import { MessageRenderingProps } from '../../../../models/messageType';
import { PubKey } from '../../../../session/types';
import {
  getMessageAuthorProps,
  isGroupConversation,
  isPublicGroupConversation,
} from '../../../../state/selectors/conversations';
import { Flex } from '../../../basic/Flex';
import { ContactName } from '../../ContactName';

export type MessageAuthorSelectorProps = Pick<
  MessageRenderingProps,
  'authorName' | 'authorProfileName' | 'sender' | 'direction' | 'firstMessageOfSeries'
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
  const { authorName, sender, authorProfileName, direction, firstMessageOfSeries } = selected;

  const title = authorName ? authorName : sender;

  if (direction !== 'incoming' || !isGroup || !title || !firstMessageOfSeries) {
    return null;
  }

  const shortenedPubkey = PubKey.shorten(sender);

  const displayedPubkey = authorProfileName ? shortenedPubkey : sender;

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
