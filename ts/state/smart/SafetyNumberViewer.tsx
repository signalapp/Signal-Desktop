// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { memo } from 'react';
import { useSelector } from 'react-redux';
import { SafetyNumberViewer } from '../../components/SafetyNumberViewer';
import type { StateType } from '../reducer';
import type { SafetyNumberProps } from '../../components/SafetyNumberChangeDialog';
import { getContactSafetyNumber } from '../selectors/safetyNumber';
import { getConversationSelector } from '../selectors/conversations';
import { getIntl } from '../selectors/user';
import { useSafetyNumberActions } from '../ducks/safetyNumber';

export const SmartSafetyNumberViewer = memo(function SmartSafetyNumberViewer({
  contactID,
  onClose,
}: SafetyNumberProps) {
  const i18n = useSelector(getIntl);
  const safetyNumberContact = useSelector((state: StateType) => {
    return getContactSafetyNumber(state, { contactID });
  });
  const conversationSelector = useSelector(getConversationSelector);
  const contact = conversationSelector(contactID);

  const { generateSafetyNumber, toggleVerified } = useSafetyNumberActions();

  return (
    <SafetyNumberViewer
      contact={contact}
      generateSafetyNumber={generateSafetyNumber}
      i18n={i18n}
      onClose={onClose}
      safetyNumber={safetyNumberContact?.safetyNumber ?? null}
      toggleVerified={toggleVerified}
      verificationDisabled={safetyNumberContact?.verificationDisabled ?? null}
    />
  );
});
