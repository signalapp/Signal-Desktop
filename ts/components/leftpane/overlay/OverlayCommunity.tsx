/* eslint-disable @typescript-eslint/no-misused-promises */
import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import useKey from 'react-use/lib/useKey';

import { SessionJoinableRooms } from './SessionJoinableDefaultRooms';

import {
  joinOpenGroupV2WithUIEvents,
  JoinSogsRoomUICallbackArgs,
} from '../../../session/apis/open_group_api/opengroupV2/JoinOpenGroupV2';
import { openGroupV2CompleteURLRegex } from '../../../session/apis/open_group_api/utils/OpenGroupUtils';
import { resetLeftOverlayMode } from '../../../state/ducks/section';
import { SessionButton } from '../../basic/SessionButton';
import { SessionSpinner } from '../../loading';

import { VALIDATION } from '../../../session/constants';
import {
  markConversationInitialLoadingInProgress,
  openConversationWithMessages,
} from '../../../state/ducks/conversations';
import { getLeftOverlayMode } from '../../../state/selectors/section';
import { Spacer2XL } from '../../basic/Text';
import { SessionInput } from '../../inputs';
import { StyledLeftPaneOverlay } from './OverlayMessage';

async function joinOpenGroup(
  serverUrl: string,
  errorHandler: (error: string) => void,
  uiCallback?: (args: JoinSogsRoomUICallbackArgs) => void
) {
  // guess if this is an open
  if (serverUrl.match(openGroupV2CompleteURLRegex)) {
    const groupCreated = await joinOpenGroupV2WithUIEvents(
      serverUrl,
      false,
      false,
      uiCallback,
      errorHandler
    );
    return groupCreated;
  }
  throw new Error(window.i18n('invalidOpenGroupUrl'));
}

export const OverlayCommunity = () => {
  const dispatch = useDispatch();

  const [groupUrl, setGroupUrl] = useState('');
  const [groupUrlError, setGroupUrlError] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  const overlayModeIsCommunity = useSelector(getLeftOverlayMode) === 'open-group';

  function closeOverlay() {
    dispatch(resetLeftOverlayMode());
  }

  async function onTryJoinRoom(completeUrl?: string) {
    try {
      if (loading) {
        return;
      }
      setGroupUrlError(undefined);
      await joinOpenGroup(completeUrl || groupUrl, setGroupUrlError, joinSogsUICallback);
    } catch (e) {
      setGroupUrlError(e.message);
      window.log.warn(e);
    } finally {
      setLoading(false);
    }
  }

  function joinSogsUICallback(args: JoinSogsRoomUICallbackArgs) {
    setLoading(args.loadingState === 'started');
    if (args.conversationKey) {
      dispatch(
        markConversationInitialLoadingInProgress({
          conversationKey: args.conversationKey,
          isInitialFetchingInProgress: true,
        })
      );
    }
    if (args.loadingState === 'finished' && overlayModeIsCommunity && args.conversationKey) {
      closeOverlay();
      void openConversationWithMessages({ conversationKey: args.conversationKey, messageId: null }); // open to last unread for a session run sogs
    }
  }

  useKey('Escape', closeOverlay);

  return (
    <StyledLeftPaneOverlay
      container={true}
      flexDirection={'column'}
      flexGrow={1}
      alignItems={'center'}
      padding={'var(--margins-md)'}
    >
      <SessionInput
        autoFocus={true}
        type="text"
        placeholder={window.i18n('enterAnOpenGroupURL')}
        value={groupUrl}
        onValueChanged={setGroupUrl}
        onEnterPressed={onTryJoinRoom}
        error={groupUrlError}
        maxLength={VALIDATION.MAX_COMMUNITY_NAME_LENGTH}
        centerText={true}
        isGroup={true}
      />
      <Spacer2XL />
      <SessionButton text={window.i18n('join')} disabled={!groupUrl} onClick={onTryJoinRoom} />
      {!loading ? <Spacer2XL /> : null}
      <SessionSpinner loading={loading} />
      <SessionJoinableRooms onJoinClick={onTryJoinRoom} alreadyJoining={loading} />
    </StyledLeftPaneOverlay>
  );
};
