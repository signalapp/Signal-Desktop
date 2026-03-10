// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { memo } from 'react';
import { useSelector } from 'react-redux';
import { SafetyNumberModal } from '../../components/SafetyNumberModal.dom.js';
import { getConversationSelector } from '../selectors/conversations.dom.js';
import { getIntl } from '../selectors/user.std.js';
import { useGlobalModalActions } from '../ducks/globalModals.preload.js';
import type { SafetyNumberProps } from '../../components/SafetyNumberChangeDialog.dom.js';
import { SmartSafetyNumberViewer } from './SafetyNumberViewer.preload.js';

export type SmartSafetyNumberModalProps = {
  contactID: string;
};

function renderSafetyNumberViewer(props: SafetyNumberProps): JSX.Element {
  return <SmartSafetyNumberViewer key={props.contactID} {...props} />;
}

export const SmartSafetyNumberModal = memo(function SmartSafetyNumberModal({
  contactID,
}: SmartSafetyNumberModalProps) {
  const i18n = useSelector(getIntl);
  const conversationSelector = useSelector(getConversationSelector);
  const contact = conversationSelector(contactID);
  const { toggleSafetyNumberModal } = useGlobalModalActions();
  return (
    <SafetyNumberModal
      i18n={i18n}
      contact={contact}
      toggleSafetyNumberModal={toggleSafetyNumberModal}
      renderSafetyNumberViewer={renderSafetyNumberViewer}
    />
  );
});
