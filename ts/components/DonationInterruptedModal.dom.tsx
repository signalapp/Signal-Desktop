// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import type { LocalizerType } from '../types/Util.std.js';
import { Modal } from './Modal.dom.js';
import { Button, ButtonVariant } from './Button.dom.js';

export type PropsType = {
  i18n: LocalizerType;
  onCancelDonation: () => unknown;
  onRetryDonation: () => unknown;
};

export function DonationInterruptedModal(props: PropsType): JSX.Element {
  const { i18n, onCancelDonation, onRetryDonation } = props;

  const footer = (
    <>
      <Button variant={ButtonVariant.Secondary} onClick={onCancelDonation}>
        {i18n('icu:cancel')}
      </Button>
      <Button
        onClick={() => {
          onRetryDonation();
        }}
      >
        {i18n('icu:Donations__DonationInterrupted__RetryButton')}
      </Button>
    </>
  );

  return (
    <Modal
      i18n={i18n}
      modalFooter={footer}
      moduleClassName="DonationInterruptedModal"
      modalName="DonationInterruptedModal"
      noMouseClose
      onClose={onCancelDonation}
      title={i18n('icu:Donations__DonationInterrupted')}
    >
      {i18n('icu:Donations__DonationInterrupted__Description')}
    </Modal>
  );
}
