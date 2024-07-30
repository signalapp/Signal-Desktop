// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { memo } from 'react';
import { useSelector } from 'react-redux';
import { SafetyNumberModal } from '../../components/SafetyNumberModal';
import { getContactSafetyNumberSelector } from '../selectors/safetyNumber';
import { getConversationSelector } from '../selectors/conversations';
import { getIntl } from '../selectors/user';
import { useSafetyNumberActions } from '../ducks/safetyNumber';
import { useGlobalModalActions } from '../ducks/globalModals';

export type SmartSafetyNumberModalProps = {
  contactID: string;
};

export const SmartSafetyNumberModal = memo(function SmartSafetyNumberModal({
  contactID,
}: SmartSafetyNumberModalProps) {
  const i18n = useSelector(getIntl);
  const conversationSelector = useSelector(getConversationSelector);
  const contact = conversationSelector(contactID);
  const contactSafetyNumberSelector = useSelector(
    getContactSafetyNumberSelector
  );
  const contactSafetyNumber = contactSafetyNumberSelector(contactID);
  const { generateSafetyNumber, toggleVerified } = useSafetyNumberActions();
  const { toggleSafetyNumberModal } = useGlobalModalActions();
  return (
    <SafetyNumberModal
      i18n={i18n}
      contact={contact}
      safetyNumber={contactSafetyNumber?.safetyNumber ?? null}
      verificationDisabled={contactSafetyNumber?.verificationDisabled ?? null}
      toggleSafetyNumberModal={toggleSafetyNumberModal}
      generateSafetyNumber={generateSafetyNumber}
      toggleVerified={toggleVerified}
    />
  );
});
