// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { memo } from 'react';
import { useSelector } from 'react-redux';

import { getIntl } from '../selectors/user.std.ts';
import { useGlobalModalActions } from '../ducks/globalModals.preload.ts';
import { PinChangeModal } from '../../components/PinChangeModal.dom.tsx';
import { getHasSvrPin } from '../selectors/items.dom.ts';

export const SmartPinChangeModal = memo(function SmartPinChangeModal() {
  const hasSvrPin = useSelector(getHasSvrPin);
  const i18n = useSelector(getIntl);
  const { hidePinChangeModal, submitPinChangeModal } = useGlobalModalActions();

  return (
    <PinChangeModal
      hasSvrPin={hasSvrPin}
      i18n={i18n}
      onCancel={hidePinChangeModal}
      onSubmit={submitPinChangeModal}
    />
  );
});
