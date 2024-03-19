// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { memo, useCallback } from 'react';
import { useSelector } from 'react-redux';
import * as SingleServePromise from '../../services/singleServePromise';
import type { SafetyNumberProps } from '../../components/SafetyNumberChangeDialog';
import {
  SafetyNumberChangeDialog,
  SafetyNumberChangeSource,
} from '../../components/SafetyNumberChangeDialog';
import { SmartSafetyNumberViewer } from './SafetyNumberViewer';
import { getByDistributionListConversationsStoppingSend } from '../selectors/conversations-extra';
import { getIntl, getTheme } from '../selectors/user';
import { getPreferredBadgeSelector } from '../selectors/badges';
import { useConversationsActions } from '../ducks/conversations';
import { useGlobalModalActions } from '../ducks/globalModals';
import { useStoryDistributionListsActions } from '../ducks/storyDistributionLists';
import { getSafetyNumberChangedBlockingData } from '../selectors/globalModals';

function renderSafetyNumber({ contactID, onClose }: SafetyNumberProps) {
  return <SmartSafetyNumberViewer contactID={contactID} onClose={onClose} />;
}

export const SmartSendAnywayDialog = memo(
  function SmartSendAnywayDialog(): JSX.Element {
    const { hideBlockingSafetyNumberChangeDialog } = useGlobalModalActions();
    const { removeMembersFromDistributionList } =
      useStoryDistributionListsActions();
    const { cancelConversationVerification, verifyConversationsStoppingSend } =
      useConversationsActions();
    const getPreferredBadge = useSelector(getPreferredBadgeSelector);
    const i18n = useSelector(getIntl);
    const theme = useSelector(getTheme);

    const contacts = useSelector(
      getByDistributionListConversationsStoppingSend
    );

    const safetyNumberChangedBlockingData = useSelector(
      getSafetyNumberChangedBlockingData
    );

    const explodedPromise = safetyNumberChangedBlockingData
      ? SingleServePromise.get<boolean>(
          safetyNumberChangedBlockingData.promiseUuid
        )
      : undefined;

    let confirmText: string | undefined = i18n(
      'icu:safetyNumberChangeDialog__pending-messages'
    );
    if (
      safetyNumberChangedBlockingData?.source ===
      SafetyNumberChangeSource.InitiateCall
    ) {
      confirmText = i18n('icu:callAnyway');
    } else if (
      safetyNumberChangedBlockingData?.source ===
      SafetyNumberChangeSource.JoinCall
    ) {
      confirmText = i18n('icu:joinAnyway');
    } else {
      confirmText = undefined;
    }

    const handleCancel = useCallback(() => {
      cancelConversationVerification();
      explodedPromise?.resolve(false);
      hideBlockingSafetyNumberChangeDialog();
    }, [
      cancelConversationVerification,
      explodedPromise,
      hideBlockingSafetyNumberChangeDialog,
    ]);

    const handleConfirm = useCallback(() => {
      verifyConversationsStoppingSend();
      explodedPromise?.resolve(true);
      hideBlockingSafetyNumberChangeDialog();
    }, [
      verifyConversationsStoppingSend,
      explodedPromise,
      hideBlockingSafetyNumberChangeDialog,
    ]);

    return (
      <SafetyNumberChangeDialog
        confirmText={confirmText}
        contacts={contacts}
        getPreferredBadge={getPreferredBadge}
        i18n={i18n}
        onCancel={handleCancel}
        onConfirm={handleConfirm}
        removeFromStory={removeMembersFromDistributionList}
        renderSafetyNumber={renderSafetyNumber}
        theme={theme}
      />
    );
  }
);
