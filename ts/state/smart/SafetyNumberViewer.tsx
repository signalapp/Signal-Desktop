// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { memo } from 'react';
import { useSelector } from 'react-redux';
import { SafetyNumberViewer } from '../../components/SafetyNumberViewer';
import type { SafetyNumberProps } from '../../components/SafetyNumberChangeDialog';
import { getContactSafetyNumberSelector } from '../selectors/safetyNumber';
import { getConversationSelector } from '../selectors/conversations';
import { getIntl } from '../selectors/user';
import { useSafetyNumberActions } from '../ducks/safetyNumber';

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
