// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { memo } from 'react';
import { useSelector } from 'react-redux';
import { SafetyNumberModal } from '../../components/SafetyNumberModal.dom.tsx';
import { getConversationSelector } from '../selectors/conversations.dom.ts';
import { getIntl } from '../selectors/user.std.ts';
import { useGlobalModalActions } from '../ducks/globalModals.preload.ts';
import type { SafetyNumberProps } from '../../components/SafetyNumberChangeDialog.dom.tsx';
import { SmartSafetyNumberViewer } from './SafetyNumberViewer.preload.tsx';

export type SmartSafetyNumberModalProps = {
  contactID: string;
};

function renderSafetyNumberViewer(props: SafetyNumberProps): React.JSX.Element {
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
