// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import type { LocalizerType } from '../types/Util';
import { Modal } from './Modal';
import { SpinnerV2 } from './SpinnerV2';

export type PropsType = {
  i18n: LocalizerType;
  onClose: () => void;
};

export function DonationProgressModal(props: PropsType): JSX.Element {
  const { i18n, onClose } = props;

  return (
    <Modal
      i18n={i18n}
      moduleClassName="DonationProgressModal"
      modalName="DonationProgressModal"
      onClose={onClose}
    >
      <SpinnerV2 size={58} strokeWidth={8} />
      <div className="DonationProgressModal__text">
        {i18n('icu:Donations__Processing')}
      </div>
    </Modal>
  );
}
