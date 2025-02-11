// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { memo, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { AttachmentNotAvailableModal } from '../../components/AttachmentNotAvailableModal';
import { strictAssert } from '../../util/assert';
import { getAttachmentNotAvailableModalType } from '../selectors/globalModals';
import { getIntl } from '../selectors/user';
import { useGlobalModalActions } from '../ducks/globalModals';

export const SmartAttachmentNotAvailableModal = memo(
  function SmartAttachmentNotAvailableModal() {
    const i18n = useSelector(getIntl);
    const attachmentNotAvailableModalType = useSelector(
      getAttachmentNotAvailableModalType
    );

    strictAssert(
      attachmentNotAvailableModalType != null,
      'attachmentNotAvailableModalType is required'
    );

    const { hideAttachmentNotAvailableModal } = useGlobalModalActions();

    const handleClose = useCallback(() => {
      hideAttachmentNotAvailableModal();
    }, [hideAttachmentNotAvailableModal]);

    return (
      <AttachmentNotAvailableModal
        i18n={i18n}
        modalType={attachmentNotAvailableModalType}
        onClose={handleClose}
      />
    );
  }
);
