import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import styled from 'styled-components';
import { OpenGroupData } from '../../../../data/opengroups';
import { MessageRenderingProps } from '../../../../models/messageType';
import { findCachedBlindedMatchOrLookItUp } from '../../../../session/apis/open_group_api/sogsv3/knownBlindedkeys';
import { getConversationController } from '../../../../session/conversations';
import { getSodiumRenderer } from '../../../../session/crypto';
import { KeyPrefixType, PubKey } from '../../../../session/types';
import { openConversationWithMessages } from '../../../../state/ducks/conversations';
import { updateUserDetailsModal } from '../../../../state/ducks/modalDialog';
import {
  useAuthorAvatarPath,
  useAuthorName,
  useAuthorProfileName,
  useLastMessageOfSeries,
  useMessageAuthor,
  useMessageSenderIsAdmin,
} from '../../../../state/selectors';
import {
  getSelectedCanWrite,
  useSelectedConversationKey,
  useSelectedIsPublic,
} from '../../../../state/selectors/selectedConversation';
import { Avatar, AvatarSize, CrownIcon } from '../../../avatar/Avatar';

const StyledAvatar = styled.div`
  position: relative;
  margin-inline-end: 10px;
  max-width: var(
    --width-avatar-group-msg-list
  ); // enforcing this so we change the variable when changing the content of the avatar
  overflow-y: hidden;
`;

export type MessageAvatarSelectorProps = Pick<
  MessageRenderingProps,
  'sender' | 'isSenderAdmin' | 'lastMessageOfSeries'
>;

type Props = { messageId: string; isPrivate: boolean };

export const MessageAvatar = (props: Props) => {
  const { messageId, isPrivate } = props;

  const dispatch = useDispatch();
  const selectedConvoKey = useSelectedConversationKey();

  const isTypingEnabled = useSelector(getSelectedCanWrite);
  const isPublic = useSelectedIsPublic();
  const authorName = useAuthorName(messageId);
  const authorProfileName = useAuthorProfileName(messageId);
  const authorAvatarPath = useAuthorAvatarPath(messageId);
  const sender = useMessageAuthor(messageId);
  const lastMessageOfSeries = useLastMessageOfSeries(messageId);
  const isSenderAdmin = useMessageSenderIsAdmin(messageId);

  const userName = authorName || authorProfileName || sender;

  const onMessageAvatarClick = useCallback(async () => {
    if (!sender) {
      return;
    }
    if (isPublic && !PubKey.isBlinded(sender)) {
      // public chat but account id not blinded. disable showing user details if we do not have an active convo with that user.
      // an unactive convo with that user means that we never chatted with that id directyly, but only through a sogs
      const convoWithSender = getConversationController().get(sender);
      if (!convoWithSender || !convoWithSender.get('active_at')) {
        // for some time, we might still get some unblinded messages, as in message sent unblinded because
        //    * older clients still send unblinded message and those are allowed by sogs if they doesn't enforce blinding
        //    * new clients still send unblinded message and those are allowed by sogs if it doesn't enforce blinding
        // we want to not allow users to open user details dialog when that's the case.
        // to handle this case, we can drop the click on avatar if the conversation with that user is not active.
        window.log.info(
          'onMessageAvatarClick: public unblinded message and sender convo is not active. Dropping click event'
        );
        return;
      }
    }

    if (isPublic && !isTypingEnabled) {
      window.log.info('onMessageAvatarClick: typing is disabled...');
      return;
    }

    if (isPublic && selectedConvoKey) {
      if (sender.startsWith(KeyPrefixType.blinded25)) {
        window.log.info('onMessageAvatarClick: blinded25 convo click are disabled currently...');

        return;
      }
      const convoOpen = getConversationController().get(selectedConvoKey);
      const room = OpenGroupData.getV2OpenGroupRoom(convoOpen.id);
      let privateConvoToOpen = sender;
      if (room?.serverPublicKey) {
        const foundRealSessionId = await findCachedBlindedMatchOrLookItUp(
          sender,
          room.serverPublicKey,
          await getSodiumRenderer()
        );

        privateConvoToOpen = foundRealSessionId || privateConvoToOpen;
      }

      await getConversationController()
        .get(privateConvoToOpen)
        .setOriginConversationID(selectedConvoKey);

      // public and blinded key for that message, we should open the convo as is and see if the user wants
      // to send a sogs blinded message request.
      await openConversationWithMessages({ conversationKey: privateConvoToOpen, messageId: null });

      return;
    }
    // not public, i.e. closed group. Just open dialog for the user to do what he wants
    dispatch(
      updateUserDetailsModal({
        conversationId: sender,
        userName: userName || '',
        authorAvatarPath,
      })
    );
  }, [dispatch, isTypingEnabled, userName, sender, isPublic, authorAvatarPath, selectedConvoKey]);

  if (!sender) {
    return null;
  }

  if (isPrivate) {
    return null;
  }

  if (!lastMessageOfSeries) {
    return <div style={{ marginInlineEnd: 'var(--width-avatar-group-msg-list)' }} />;
  }
  /* eslint-disable @typescript-eslint/no-misused-promises */
  // The styledAvatar, when rendered needs to have a width with margins included of var(--width-avatar-group-msg-list).
  // This is so that the other message is still aligned when the avatar is not rendered (we need to make up for the space used by the avatar, and we use a margin of width-avatar-group-msg-list)
  return (
    <StyledAvatar>
      <Avatar size={AvatarSize.S} onAvatarClick={onMessageAvatarClick} pubkey={sender} />
      {isSenderAdmin ? <CrownIcon /> : null}
    </StyledAvatar>
  );
};
