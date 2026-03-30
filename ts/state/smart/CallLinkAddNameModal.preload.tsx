// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { memo, useCallback, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { useCallingActions } from '../ducks/calling.preload.ts';
import { getCallLinkSelector } from '../selectors/calling.std.ts';
import { createLogger } from '../../logging/log.std.ts';
import { getIntl } from '../selectors/user.std.ts';
import { useGlobalModalActions } from '../ducks/globalModals.preload.ts';
import { getCallLinkAddNameModalRoomId } from '../selectors/globalModals.std.ts';
import { strictAssert } from '../../util/assert.std.ts';
import { isCallLinkAdmin } from '../../types/CallLink.std.ts';
import { CallLinkAddNameModal } from '../../components/CallLinkAddNameModal.dom.tsx';

const log = createLogger('CallLinkAddNameModal');

export const SmartCallLinkAddNameModal = memo(
  function SmartCallLinkAddNameModal(): React.JSX.Element | null {
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
