// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { memo, useCallback, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { CallLinkEditModal } from '../../components/CallLinkEditModal.dom.js';
import { useCallingActions } from '../ducks/calling.preload.js';
import {
  getActiveCallState,
  getCallLinkSelector,
} from '../selectors/calling.std.js';
import { createLogger } from '../../logging/log.std.js';
import { getIntl } from '../selectors/user.std.js';
import { useGlobalModalActions } from '../ducks/globalModals.preload.js';
import type { CallLinkRestrictions } from '../../types/CallLink.std.js';
import { getCallLinkEditModalRoomId } from '../selectors/globalModals.std.js';
import { strictAssert } from '../../util/assert.std.js';
import { linkCallRoute } from '../../util/signalRoutes.std.js';
import { copyCallLink } from '../../util/copyLinksWithToast.dom.js';
import { drop } from '../../util/drop.std.js';

const log = createLogger('CallLinkEditModal');

export const SmartCallLinkEditModal = memo(
  function SmartCallLinkEditModal(): JSX.Element | null {
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
          epoch: callLink?.epoch,
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
      startCallLinkLobby({ rootKey: callLink.rootKey, epoch: callLink.epoch });
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
