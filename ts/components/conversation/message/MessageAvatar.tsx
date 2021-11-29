import React, { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { MessageRenderingProps } from '../../../models/messageType';
import { updateUserDetailsModal } from '../../../state/ducks/modalDialog';
import { getMessageAvatarProps } from '../../../state/selectors/conversations';
import { Avatar, AvatarSize } from '../../Avatar';

export type MessageAvatarSelectorProps = Pick<
  MessageRenderingProps,
  | 'authorAvatarPath'
  | 'authorName'
  | 'authorPhoneNumber'
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
    authorPhoneNumber,
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
  const userName = authorName || authorProfileName || authorPhoneNumber;

  const onMessageAvatarClick = useCallback(() => {
    dispatch(
      updateUserDetailsModal({
        conversationId: authorPhoneNumber,
        userName,
        authorAvatarPath,
      })
    );
  }, [userName, authorPhoneNumber, authorAvatarPath]);

  if (!lastMessageOfSeries) {
    return <div style={{ marginInlineEnd: '60px' }} key={`msg-avatar-${authorPhoneNumber}`} />;
  }

  return (
    <div className="module-message__author-avatar" key={`msg-avatar-${authorPhoneNumber}`}>
      <Avatar size={AvatarSize.S} onAvatarClick={onMessageAvatarClick} pubkey={authorPhoneNumber} />
      {isPublic && isSenderAdmin && (
        <div className="module-avatar__icon--crown-wrapper">
          <div className="module-avatar__icon--crown" />
        </div>
      )}
    </div>
  );
};
