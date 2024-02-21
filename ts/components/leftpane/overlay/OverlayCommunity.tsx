/* eslint-disable @typescript-eslint/no-misused-promises */
import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import useKey from 'react-use/lib/useKey';

import { SessionJoinableRooms } from './SessionJoinableDefaultRooms';

import {
  joinOpenGroupV2WithUIEvents,
  JoinSogsRoomUICallbackArgs,
} from '../../../session/apis/open_group_api/opengroupV2/JoinOpenGroupV2';
import { openGroupV2CompleteURLRegex } from '../../../session/apis/open_group_api/utils/OpenGroupUtils';
import { ToastUtils } from '../../../session/utils';
import { resetLeftOverlayMode } from '../../../state/ducks/section';
import { SessionButton } from '../../basic/SessionButton';
import { SessionIdEditable } from '../../basic/SessionIdEditable';
import { SessionSpinner } from '../../basic/SessionSpinner';
import { OverlayHeader } from './OverlayHeader';

import {
  markConversationInitialLoadingInProgress,
  openConversationWithMessages,
} from '../../../state/ducks/conversations';
import { getLeftOverlayMode } from '../../../state/selectors/section';

async function joinOpenGroup(
  serverUrl: string,
  uiCallback?: (args: JoinSogsRoomUICallbackArgs) => void
) {
  // guess if this is an open
  if (serverUrl.match(openGroupV2CompleteURLRegex)) {
    const groupCreated = await joinOpenGroupV2WithUIEvents(serverUrl, true, false, uiCallback);
    return groupCreated;
  }
  ToastUtils.pushToastError('invalidOpenGroupUrl', window.i18n('invalidOpenGroupUrl'));
  window.log.warn('Invalid opengroupv2 url');
  return false;
}

export const OverlayCommunity = () => {
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(false);
  const [groupUrl, setGroupUrl] = useState('');

  const overlayModeIsCommunity = useSelector(getLeftOverlayMode) === 'open-group';

  function closeOverlay() {
    dispatch(resetLeftOverlayMode());
  }

  async function onTryJoinRoom(completeUrl?: string) {
    try {
      if (loading) {
        return;
      }
      await joinOpenGroup(completeUrl || groupUrl, joinSogsUICallback);
    } catch (e) {
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

  const title = window.i18n('joinOpenGroup');
  const buttonText = window.i18n('join');
  const subtitle = window.i18n('openGroupURL');
  const placeholder = window.i18n('enterAnOpenGroupURL');

  return (
    <div className="module-left-pane-overlay">
      <OverlayHeader title={title} subtitle={subtitle} />
      <div className="create-group-name-input">
        <SessionIdEditable
          editable={true}
          placeholder={placeholder}
          value={groupUrl}
          isGroup={true}
          maxLength={300}
          onChange={setGroupUrl}
          onPressEnter={onTryJoinRoom}
        />
      </div>
      <SessionButton text={buttonText} disabled={!groupUrl} onClick={onTryJoinRoom} />
      <SessionSpinner loading={loading} />
      <SessionJoinableRooms onJoinClick={onTryJoinRoom} alreadyJoining={loading} />
    </div>
  );
};
