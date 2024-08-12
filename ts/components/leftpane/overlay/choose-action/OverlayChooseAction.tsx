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
          ariaLabel={'New message button'}
          iconType={'chatBubble'}
          iconSize={20}
          onClick={openNewMessage}
          dataTestId="chooser-new-conversation-button"
        />
        <ActionRow
          title={window.i18n('createGroup')}
          ariaLabel={'Create a group button'}
          iconType={'group'}
          iconSize={30}
          onClick={openCreateGroup}
          dataTestId="chooser-new-group"
        />
        <ActionRow
          title={window.i18n('joinOpenGroup')}
          ariaLabel={'Join a community button'}
          iconType={'communities'}
          iconSize={20}
          onClick={openJoinCommunity}
          dataTestId="chooser-new-community"
        />
        <ActionRow
          title={window.i18n('sessionInviteAFriend')}
          ariaLabel={'Invite a friend button'}
          iconType={'addUser'}
          iconSize={20}
          onClick={inviteAFriend}
          dataTestId="chooser-invite-friend"
        />
      </StyledActionRowContainer>
      <SpacerSM />
      <ContactsListWithBreaks />
    </StyledLeftPaneOverlay>
  );
};
