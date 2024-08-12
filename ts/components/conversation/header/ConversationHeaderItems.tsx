import { useSelector } from 'react-redux';
import { callRecipient } from '../../../interactions/conversationInteractions';
import { getHasIncomingCall, getHasOngoingCall } from '../../../state/selectors/call';

import {
  useSelectedConversationKey,
  useSelectedIsActive,
  useSelectedIsBlocked,
  useSelectedIsNoteToSelf,
  useSelectedIsPrivate,
  useSelectedIsPrivateFriend,
} from '../../../state/selectors/selectedConversation';
import { Avatar, AvatarSize } from '../../avatar/Avatar';
import { SessionIconButton } from '../../icon';

export const AvatarHeader = (props: {
  pubkey: string;
  onAvatarClick?: (pubkey: string) => void;
}) => {
  const { pubkey, onAvatarClick } = props;

  return (
    <span className="module-conversation-header__avatar">
      <Avatar
        size={AvatarSize.S}
        onAvatarClick={() => {
          if (onAvatarClick) {
            onAvatarClick(pubkey);
          }
        }}
        pubkey={pubkey}
        dataTestId="conversation-options-avatar"
      />
    </span>
  );
};

export const BackButton = (props: { onGoBack: () => void; showBackButton: boolean }) => {
  const { onGoBack, showBackButton } = props;
  if (!showBackButton) {
    return null;
  }

  return (
    <SessionIconButton
      iconType="chevron"
      iconSize="large"
      iconRotation={90}
      onClick={onGoBack}
      dataTestId="back-button-message-details"
    />
  );
};

export const CallButton = () => {
  const isPrivate = useSelectedIsPrivate();
  const isBlocked = useSelectedIsBlocked();
  const activeAt = useSelectedIsActive();
  const isMe = useSelectedIsNoteToSelf();
  const selectedConvoKey = useSelectedConversationKey();

  const hasIncomingCall = useSelector(getHasIncomingCall);
  const hasOngoingCall = useSelector(getHasOngoingCall);
  const canCall = !(hasIncomingCall || hasOngoingCall);

  const isPrivateAndFriend = useSelectedIsPrivateFriend();

  if (
    !isPrivate ||
    isMe ||
    !selectedConvoKey ||
    isBlocked ||
    !activeAt ||
    !isPrivateAndFriend // call requires us to be friends
  ) {
    return null;
  }

  return (
    <SessionIconButton
      iconType="phone"
      iconSize="large"
      iconPadding="2px"
      // negative margin to keep conversation header title centered
      margin="0 10px 0 -32px"
      onClick={() => {
        void callRecipient(selectedConvoKey, canCall);
      }}
      dataTestId="call-button"
    />
  );
};
