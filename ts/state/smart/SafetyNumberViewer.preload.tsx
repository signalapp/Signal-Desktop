// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { memo } from 'react';
import { useSelector } from 'react-redux';
import { SafetyNumberViewer } from '../../components/SafetyNumberViewer.dom.js';
import type { SafetyNumberProps } from '../../components/SafetyNumberChangeDialog.dom.js';
import { getContactSafetyNumberSelector } from '../selectors/safetyNumber.std.js';
import { getConversationSelector } from '../selectors/conversations.dom.js';
import { getIntl } from '../selectors/user.std.js';
import { useSafetyNumberActions } from '../ducks/safetyNumber.preload.js';

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
