// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { memo, useCallback } from 'react';
import { useSelector } from 'react-redux';

import { getIntl } from '../selectors/user.std.ts';
import { getPinReminderModalProps } from '../selectors/globalModals.std.ts';
import { useGlobalModalActions } from '../ducks/globalModals.preload.ts';
import { pinReminderService } from '../../services/pinReminder.preload.ts';
import { PinReminderState } from '../../types/globalModals.std.ts';
import { PinReminderModal } from '../../components/PinReminderModal.dom.tsx';

export const SmartPinReminderModal = memo(function SmartPinReminderModal() {
  const i18n = useSelector(getIntl);
  const pinReminderState = useSelector(getPinReminderModalProps);
  const { togglePinReminder } = useGlobalModalActions();

  const handleCancel = useCallback(() => {
    togglePinReminder(PinReminderState.Megaphone);
  }, [togglePinReminder]);

  const handlePinEntry = useCallback(
    (pin: string, ignoreWrongGuess?: boolean): boolean => {
      return pinReminderService.handlePinEntry(pin, ignoreWrongGuess);
    },
    []
  );

  if (pinReminderState !== PinReminderState.Modal) {
    return null;
  }

  return (
    <PinReminderModal
      i18n={i18n}
      open
      onCancel={handleCancel}
      onPinEntry={handlePinEntry}
    />
  );
});
