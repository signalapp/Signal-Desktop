// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import type { LocalizerType } from '../types/Util';
import { Modal } from './Modal';
import { Button, ButtonVariant } from './Button';

export type PropsType = {
  i18n: LocalizerType;
  onCancel: () => unknown;
  onOpenBrowser: () => unknown;
};

export function DonationVerificationModal(props: PropsType): JSX.Element {
  const { i18n, onCancel, onOpenBrowser } = props;

  const footer = (
    <>
      <Button variant={ButtonVariant.Secondary} onClick={onCancel}>
        {i18n('icu:confirmation-dialog--Cancel')}
      </Button>
      <Button onClick={onOpenBrowser}>
        {i18n('icu:Donations__3dsValidationNeeded__OpenBrowser')}
      </Button>
    </>
  );

  return (
    <Modal
      hasXButton
      i18n={i18n}
      modalFooter={footer}
      moduleClassName="DonationVerificationModal"
      modalName="DonationVerificationModal"
      onClose={onCancel}
      title={i18n('icu:Donations__3dsValidationNeeded')}
    >
      {i18n('icu:Donations__3dsValidationNeeded__Description')}
    </Modal>
  );
}
