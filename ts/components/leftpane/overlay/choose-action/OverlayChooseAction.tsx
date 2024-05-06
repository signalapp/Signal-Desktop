import { useCallback, useEffect } from 'react';

import { isEmpty, isString } from 'lodash';
import { useDispatch } from 'react-redux';
import useKey from 'react-use/lib/useKey';
import { resetLeftOverlayMode, setLeftOverlayMode } from '../../../../state/ducks/section';
import { SpacerSM } from '../../../basic/Text';
import { StyledLeftPaneOverlay } from '../OverlayMessage';
import { ActionRow, StyledActionRowContainer } from './ActionRow';
import { ContactsListWithBreaks } from './ContactsListWithBreaks';

export const OverlayChooseAction = () => {
  const dispatch = useDispatch();
  function closeOverlay() {
    dispatch(resetLeftOverlayMode());
  }

  const openNewMessage = useCallback(() => {
    dispatch(setLeftOverlayMode('message'));
  }, [dispatch]);

  const openCreateGroup = useCallback(() => {
    dispatch(setLeftOverlayMode('closed-group'));
  }, [dispatch]);

  const openJoinCommunity = useCallback(() => {
    dispatch(setLeftOverlayMode('open-group'));
  }, [dispatch]);

  const inviteAFriend = useCallback(() => {
    dispatch(setLeftOverlayMode('invite-a-friend'));
  }, [dispatch]);

  useKey('Escape', closeOverlay);

  useEffect(() => {
    function handlePaste(event: ClipboardEvent) {
      event.preventDefault();

      const pasted = event.clipboardData?.getData('text');

      if (pasted && isString(pasted) && !isEmpty(pasted)) {
        if (pasted.startsWith('http') || pasted.startsWith('https')) {
          openJoinCommunity();
        } else if (pasted.startsWith('05')) {
          openNewMessage();
        }
      }
    }
    document?.addEventListener('paste', handlePaste);

    return () => {
      document?.removeEventListener('paste', handlePaste);
    };
  }, [openJoinCommunity, openNewMessage]);

  return (
    <StyledLeftPaneOverlay
      container={true}
      flexDirection={'column'}
      flexGrow={1}
      alignItems={'center'}
    >
      <StyledActionRowContainer
        container={true}
        flexDirection={'column'}
        justifyContent={'flex-start'}
        alignItems={'flex-start'}
      >
        <ActionRow
          title={window.i18n('newMessage')}
          ariaLabel={window.i18n('createConversationNewContact')}
          iconType={'chatBubble'}
          onClick={openNewMessage}
          dataTestId="chooser-new-conversation-button"
        />
        <ActionRow
          title={window.i18n('createGroup')}
          ariaLabel={window.i18n('createConversationNewGroup')}
          iconType={'group'}
          iconSize={36}
          onClick={openCreateGroup}
          dataTestId="chooser-new-group"
        />
        <ActionRow
          title={window.i18n('joinOpenGroup')}
          ariaLabel={window.i18n('joinACommunity')}
          iconType={'communities'}
          onClick={openJoinCommunity}
          dataTestId="chooser-new-community"
        />
        <ActionRow
          title={window.i18n('sessionInviteAFriend')}
          ariaLabel={window.i18n('sessionInviteAFriend')}
          iconType={'addUser'}
          onClick={inviteAFriend}
          dataTestId="invite-a-friend"
        />
      </StyledActionRowContainer>
      <SpacerSM />
      <ContactsListWithBreaks />
    </StyledLeftPaneOverlay>
  );
};
