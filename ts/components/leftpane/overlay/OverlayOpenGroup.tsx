import React, { useState } from 'react';
// tslint:disable: no-submodule-imports use-simple-attributes

import { SessionJoinableRooms } from './SessionJoinableDefaultRooms';

import { SessionButton, SessionButtonColor, SessionButtonType } from '../../basic/SessionButton';
import { SessionIdEditable } from '../../basic/SessionIdEditable';
import { SessionSpinner } from '../../basic/SessionSpinner';
import { OverlayHeader } from './OverlayHeader';
import { useDispatch } from 'react-redux';
import { setOverlayMode } from '../../../state/ducks/section';
import { joinOpenGroupV2WithUIEvents } from '../../../session/apis/open_group_api/opengroupV2/JoinOpenGroupV2';
import { openGroupV2CompleteURLRegex } from '../../../session/apis/open_group_api/utils/OpenGroupUtils';
import { ToastUtils } from '../../../session/utils';
import useKey from 'react-use/lib/useKey';

async function joinOpenGroup(serverUrl: string) {
  // guess if this is an open
  if (serverUrl.match(openGroupV2CompleteURLRegex)) {
    const groupCreated = await joinOpenGroupV2WithUIEvents(serverUrl, true, false);
    return groupCreated;
  } else {
    ToastUtils.pushToastError('invalidOpenGroupUrl', window.i18n('invalidOpenGroupUrl'));
    window.log.warn('Invalid opengroupv2 url');
    return false;
  }
}

export const OverlayOpenGroup = () => {
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(false);
  const [groupUrl, setGroupUrl] = useState('');

  function closeOverlay() {
    dispatch(setOverlayMode(undefined));
  }

  async function onEnterPressed() {
    try {
      if (loading) {
        return;
      }
      setLoading(true);
      const groupCreated = await joinOpenGroup(groupUrl);
      if (groupCreated) {
        closeOverlay();
      }
    } catch (e) {
      window.log.warn(e);
    } finally {
      setLoading(false);
    }
  }

  // FIXME autofocus inputref on mount
  useKey('Escape', closeOverlay);

  const title = window.i18n('joinOpenGroup');
  const buttonText = window.i18n('next');
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
          onPressEnter={onEnterPressed}
        />
      </div>

      <SessionSpinner loading={loading} />
      <SessionJoinableRooms onRoomClicked={closeOverlay} />
      <SessionButton
        buttonColor={SessionButtonColor.Green}
        buttonType={SessionButtonType.BrandOutline}
        text={buttonText}
        onClick={onEnterPressed}
      />
    </div>
  );
};
