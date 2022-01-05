import React, { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { MessageRenderingProps } from '../../../../models/messageType';
import { updateUserDetailsModal } from '../../../../state/ducks/modalDialog';
import { getMessageAvatarProps } from '../../../../state/selectors/conversations';
import { Avatar, AvatarSize, CrownIcon } from '../../../avatar/Avatar';
// tslint:disable: use-simple-attributes

export type MessageAvatarSelectorProps = Pick<
  MessageRenderingProps,
  | 'authorAvatarPath'
  | 'authorName'
  | 'sender'
  | 'authorProfileName'
  | 'isSenderAdmin'
  | 'conversationType'
  | 'direction'
  | 'isPublic'
  | 'lastMessageOfSeries'
>;

type Props = { messageId: string };

export const MessageAvatar = (props: Props) => {
  const { messageId } = props;

  const dispatch = useDispatch();
  const avatarProps = useSelector(state => getMessageAvatarProps(state as any, messageId));

  if (!avatarProps) {
    return null;
  }
  const {
    authorAvatarPath,
    authorName,
    sender,
    authorProfileName,
    conversationType,
    direction,
    isPublic,
    isSenderAdmin,
    lastMessageOfSeries,
  } = avatarProps;

  if (conversationType !== 'group' || direction === 'outgoing') {
    return null;
  }
  const userName = authorName || authorProfileName || sender;

  const onMessageAvatarClick = useCallback(() => {
    dispatch(
      updateUserDetailsModal({
        conversationId: sender,
        userName,
        authorAvatarPath,
      })
    );
  }, [userName, sender, authorAvatarPath]);

  if (!lastMessageOfSeries) {
    return <div style={{ marginInlineEnd: '60px' }} key={`msg-avatar-${sender}`} />;
  }

  return (
    <div className="module-message__author-avatar" key={`msg-avatar-${sender}`}>
      <Avatar
        size={AvatarSize.S}
        onAvatarClick={(!isPublic && onMessageAvatarClick) || undefined}
        pubkey={sender}
      />
      {isSenderAdmin && <CrownIcon />}
    </div>
  );
};
