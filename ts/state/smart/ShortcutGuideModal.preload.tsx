// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { memo } from 'react';
import { useSelector } from 'react-redux';
import { ShortcutGuideModal } from '../../components/ShortcutGuideModal.dom.js';
import { getIntl, getPlatform } from '../selectors/user.std.js';
import { useGlobalModalActions } from '../ducks/globalModals.preload.js';

export const SmartShortcutGuideModal = memo(function SmartShortcutGuideModal() {
  const i18n = useSelector(getIntl);
  const platform = useSelector(getPlatform);

  const { closeShortcutGuideModal } = useGlobalModalActions();

  return (
    <ShortcutGuideModal
      platform={platform}
      closeShortcutGuideModal={closeShortcutGuideModal}
      i18n={i18n}
    />
  );
});
