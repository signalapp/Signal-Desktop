// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { memo } from 'react';
import { useSelector } from 'react-redux';
import { SafetyNumberViewer } from '../../components/SafetyNumberViewer.js';
import type { SafetyNumberProps } from '../../components/SafetyNumberChangeDialog.js';
import { getContactSafetyNumberSelector } from '../selectors/safetyNumber.js';
import { getConversationSelector } from '../selectors/conversations.js';
import { getIntl } from '../selectors/user.js';
import { useSafetyNumberActions } from '../ducks/safetyNumber.js';

export const SmartSafetyNumberViewer = memo(function SmartSafetyNumberViewer({
  contactID,
  onClose,
}: SafetyNumberProps) {
  const i18n = useSelector(getIntl);
  const contactSafetyNumberSelector = useSelector(
    getContactSafetyNumberSelector
  );
  const safetyNumberContact = contactSafetyNumberSelector(contactID);
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
