// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { useSelector } from 'react-redux';
import type { LocalizerType } from '../../types/Util';
import type { SafetyNumberChangedBlockingDataType } from '../ducks/globalModals';
import type { StateType } from '../reducer';
import * as SingleServePromise from '../../services/singleServePromise';
import {
  SafetyNumberChangeDialog,
  SafetyNumberChangeSource,
} from '../../components/SafetyNumberChangeDialog';
import { SmartSafetyNumberViewer } from './SafetyNumberViewer';
import { getConversationsStoppingSend } from '../selectors/conversations';
import { getIntl, getTheme } from '../selectors/user';
import { getPreferredBadgeSelector } from '../selectors/badges';
import { useConversationsActions } from '../ducks/conversations';
import { useGlobalModalActions } from '../ducks/globalModals';

export function SmartSendAnywayDialog(): JSX.Element {
  const { hideBlockingSafetyNumberChangeDialog } = useGlobalModalActions();
  const { cancelConversationVerification, verifyConversationsStoppingSend } =
    useConversationsActions();
  const getPreferredBadge = useSelector(getPreferredBadgeSelector);
  const i18n = useSelector<StateType, LocalizerType>(getIntl);
  const theme = useSelector(getTheme);

  const contacts = useSelector(getConversationsStoppingSend);

  const safetyNumberChangedBlockingData = useSelector<
    StateType,
    SafetyNumberChangedBlockingDataType | undefined
  >(state => state.globalModals.safetyNumberChangedBlockingData);

  const explodedPromise = safetyNumberChangedBlockingData
    ? SingleServePromise.get<boolean>(
        safetyNumberChangedBlockingData.promiseUuid
      )
    : undefined;

  let confirmText: string | undefined = i18n(
    'safetyNumberChangeDialog__pending-messages'
  );
  if (safetyNumberChangedBlockingData?.source) {
    confirmText =
      safetyNumberChangedBlockingData?.source ===
      SafetyNumberChangeSource.Calling
        ? i18n('callAnyway')
        : undefined;
  }

  return (
    <SafetyNumberChangeDialog
      confirmText={confirmText}
      contacts={contacts}
      getPreferredBadge={getPreferredBadge}
      i18n={i18n}
      onCancel={() => {
        cancelConversationVerification();
        explodedPromise?.resolve(false);
        hideBlockingSafetyNumberChangeDialog();
      }}
      onConfirm={() => {
        verifyConversationsStoppingSend();
        explodedPromise?.resolve(true);
        hideBlockingSafetyNumberChangeDialog();
      }}
      renderSafetyNumber={({ contactID, onClose }) => (
        <SmartSafetyNumberViewer contactID={contactID} onClose={onClose} />
      )}
      theme={theme}
    />
  );
}
