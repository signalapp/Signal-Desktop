// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import type { LocalizerType } from '../types/Util';
import { Modal } from './Modal';
import { Button } from './Button';

export type PropsType = {
  i18n: LocalizerType;
  onClose: () => unknown;
};

export function DonationStillProcessingModal(props: PropsType): JSX.Element {
  const { i18n, onClose } = props;

  return (
    <Modal
      i18n={i18n}
      modalFooter={
        <Button onClick={onClose}>{i18n('icu:Confirmation--confirm')}</Button>
      }
      hasXButton
      moduleClassName="DonationStillProcessingModal"
      modalName="DonationStillProcessingModal"
      onClose={onClose}
      title={i18n('icu:Donations__StillProcessing')}
    >
      {i18n('icu:Donations__StillProcessing__Description')}
    </Modal>
  );
}
