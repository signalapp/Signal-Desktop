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
import { getByDistributionListConversationsStoppingSend } from '../selectors/conversations-extra';
import { getIntl, getTheme } from '../selectors/user';
import { getPreferredBadgeSelector } from '../selectors/badges';
import { useConversationsActions } from '../ducks/conversations';
import { useGlobalModalActions } from '../ducks/globalModals';
import { useStoryDistributionListsActions } from '../ducks/storyDistributionLists';

export function SmartSendAnywayDialog(): JSX.Element {
  const { hideBlockingSafetyNumberChangeDialog } = useGlobalModalActions();
  const { removeMembersFromDistributionList } =
    useStoryDistributionListsActions();
  const { cancelConversationVerification, verifyConversationsStoppingSend } =
    useConversationsActions();
  const getPreferredBadge = useSelector(getPreferredBadgeSelector);
  const i18n = useSelector<StateType, LocalizerType>(getIntl);
  const theme = useSelector(getTheme);

  const contacts = useSelector(getByDistributionListConversationsStoppingSend);

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
      removeFromStory={removeMembersFromDistributionList}
      renderSafetyNumber={({ contactID, onClose }) => (
        <SmartSafetyNumberViewer contactID={contactID} onClose={onClose} />
      )}
      theme={theme}
    />
  );
}
