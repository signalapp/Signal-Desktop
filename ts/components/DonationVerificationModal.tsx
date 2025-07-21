// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useState } from 'react';

import type { LocalizerType } from '../types/Util';
import { Modal } from './Modal';
import { Button, ButtonVariant } from './Button';

export type PropsType = {
  i18n: LocalizerType;
  onCancelDonation: () => unknown;
  onOpenBrowser: () => unknown;
};

export function DonationVerificationModal(props: PropsType): JSX.Element {
  const { i18n, onCancelDonation, onOpenBrowser } = props;
  const [hasOpenedBrowser, setHasOpenedBrowser] = useState(false);

  const titleText = hasOpenedBrowser
    ? i18n('icu:Donations__3dsValidationNeeded--waiting')
    : i18n('icu:Donations__3dsValidationNeeded');
  const openBrowserText = hasOpenedBrowser
    ? i18n('icu:Donations__3dsValidationNeeded__OpenBrowser--opened')
    : i18n('icu:Donations__3dsValidationNeeded__OpenBrowser');

  const footer = (
    <>
      <Button variant={ButtonVariant.Secondary} onClick={onCancelDonation}>
        {i18n('icu:Donations__3dsValidationNeeded__CancelDonation')}
      </Button>
      <Button
        onClick={() => {
          setHasOpenedBrowser(true);
          onOpenBrowser();
        }}
      >
        {openBrowserText}
      </Button>
    </>
  );

  return (
    <Modal
      i18n={i18n}
      modalFooter={footer}
      moduleClassName="DonationVerificationModal"
      modalName="DonationVerificationModal"
      noMouseClose
      onClose={onCancelDonation}
      title={titleText}
    >
      {i18n('icu:Donations__3dsValidationNeeded__Description')}
    </Modal>
  );
}
