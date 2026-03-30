// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { memo, useCallback, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { CallLinkEditModal } from '../../components/CallLinkEditModal.dom.tsx';
import { useCallingActions } from '../ducks/calling.preload.ts';
import {
  getActiveCallState,
  getCallLinkSelector,
} from '../selectors/calling.std.ts';
import { createLogger } from '../../logging/log.std.ts';
import { getIntl } from '../selectors/user.std.ts';
import { useGlobalModalActions } from '../ducks/globalModals.preload.ts';
import type { CallLinkRestrictions } from '../../types/CallLink.std.ts';
import { getCallLinkEditModalRoomId } from '../selectors/globalModals.std.ts';
import { strictAssert } from '../../util/assert.std.ts';
import { linkCallRoute } from '../../util/signalRoutes.std.ts';
import { copyCallLink } from '../../util/copyLinksWithToast.dom.ts';
import { drop } from '../../util/drop.std.ts';

const log = createLogger('CallLinkEditModal');

export const SmartCallLinkEditModal = memo(
  function SmartCallLinkEditModal(): React.JSX.Element | null {
    const roomId = useSelector(getCallLinkEditModalRoomId);
    strictAssert(roomId, 'Expected roomId to be set');

    const i18n = useSelector(getIntl);
    const callLinkSelector = useSelector(getCallLinkSelector);

    const { updateCallLinkRestrictions, startCallLinkLobby } =
      useCallingActions();
    const {
      toggleCallLinkAddNameModal,
      toggleCallLinkEditModal,
      showShareCallLinkViaSignal,
    } = useGlobalModalActions();

    const callLink = useMemo(() => {
      return callLinkSelector(roomId);
    }, [callLinkSelector, roomId]);

    const handleClose = useCallback(() => {
      toggleCallLinkEditModal(null);
    }, [toggleCallLinkEditModal]);

    const handleCopyCallLink = useCallback(() => {
      strictAssert(callLink != null, 'callLink not found');
      const callLinkWebUrl = linkCallRoute
        .toWebUrl({
          key: callLink?.rootKey,
        })
        .toString();
      drop(copyCallLink(callLinkWebUrl));
    }, [callLink]);

    const handleOpenCallLinkAddNameModal = useCallback(() => {
      toggleCallLinkAddNameModal(roomId);
    }, [roomId, toggleCallLinkAddNameModal]);

    const handleUpdateCallLinkRestrictions = useCallback(
      (newRestrictions: CallLinkRestrictions) => {
        updateCallLinkRestrictions(roomId, newRestrictions);
      },
      [roomId, updateCallLinkRestrictions]
    );

    const handleShareCallLinkViaSignal = useCallback(() => {
      strictAssert(callLink != null, 'callLink not found');
      showShareCallLinkViaSignal(callLink, i18n);
    }, [callLink, i18n, showShareCallLinkViaSignal]);

    const handleStartCallLinkLobby = useCallback(() => {
      strictAssert(callLink != null, 'callLink not found');
      startCallLinkLobby({ rootKey: callLink.rootKey });
      toggleCallLinkEditModal(null);
    }, [callLink, startCallLinkLobby, toggleCallLinkEditModal]);

    const activeCall = useSelector(getActiveCallState);
    const hasActiveCall = Boolean(
      activeCall && callLink && activeCall?.conversationId !== callLink?.roomId
    );

    if (!callLink) {
      log.error(
        'SmartCallLinkEditModal: No call link found for roomId',
        roomId
      );
      return null;
    }

    return (
      <CallLinkEditModal
        i18n={i18n}
        callLink={callLink}
        hasActiveCall={hasActiveCall}
        onClose={handleClose}
        onCopyCallLink={handleCopyCallLink}
        onOpenCallLinkAddNameModal={handleOpenCallLinkAddNameModal}
        onUpdateCallLinkRestrictions={handleUpdateCallLinkRestrictions}
        onShareCallLinkViaSignal={handleShareCallLinkViaSignal}
        onStartCallLinkLobby={handleStartCallLinkLobby}
      />
    );
  }
);
