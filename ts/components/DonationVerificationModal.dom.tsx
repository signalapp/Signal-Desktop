// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useEffect, useState } from 'react';

import type { LocalizerType } from '../types/Util.std.js';
import { Modal } from './Modal.dom.js';
import { Button, ButtonVariant } from './Button.dom.js';
import { DAY } from '../util/durations/index.std.js';

export type PropsType = {
  // Test-only
  _timeout?: number;
  i18n: LocalizerType;
  onCancelDonation: () => unknown;
  onOpenBrowser: () => unknown;
  onTimedOut: () => unknown;
};

export function DonationVerificationModal(props: PropsType): JSX.Element {
  const { _timeout, i18n, onCancelDonation, onOpenBrowser, onTimedOut } = props;
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

  useEffect(() => {
    let timeout: NodeJS.Timeout | undefined = setTimeout(() => {
      timeout = undefined;
      onTimedOut();
    }, _timeout ?? DAY);

    return () => {
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, [_timeout, onTimedOut]);

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
