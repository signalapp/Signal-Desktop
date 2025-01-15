// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { memo, useCallback, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { useCallingActions } from '../ducks/calling';
import { getCallLinkSelector } from '../selectors/calling';
import * as log from '../../logging/log';
import { getIntl } from '../selectors/user';
import { useGlobalModalActions } from '../ducks/globalModals';
import { getCallLinkAddNameModalRoomId } from '../selectors/globalModals';
import { strictAssert } from '../../util/assert';
import { isCallLinkAdmin } from '../../types/CallLink';
import { CallLinkAddNameModal } from '../../components/CallLinkAddNameModal';

export const SmartCallLinkAddNameModal = memo(
  function SmartCallLinkAddNameModal(): JSX.Element | null {
    const roomId = useSelector(getCallLinkAddNameModalRoomId);
    strictAssert(roomId, 'Expected roomId to be set');

    const i18n = useSelector(getIntl);
    const callLinkSelector = useSelector(getCallLinkSelector);

    const { updateCallLinkName } = useCallingActions();
    const { toggleCallLinkAddNameModal } = useGlobalModalActions();

    const callLink = useMemo(() => {
      return callLinkSelector(roomId);
    }, [callLinkSelector, roomId]);

    const handleClose = useCallback(() => {
      toggleCallLinkAddNameModal(null);
    }, [toggleCallLinkAddNameModal]);

    const handleUpdateCallLinkName = useCallback(
      (newName: string) => {
        updateCallLinkName(roomId, newName);
      },
      [roomId, updateCallLinkName]
    );

    if (!callLink) {
      log.error(
        'SmartCallLinkEditModal: No call link found for roomId',
        roomId
      );
      return null;
    }

    strictAssert(isCallLinkAdmin(callLink), 'User is not an admin');

    return (
      <CallLinkAddNameModal
        i18n={i18n}
        callLink={callLink}
        onClose={handleClose}
        onUpdateCallLinkName={handleUpdateCallLinkName}
      />
    );
  }
);
