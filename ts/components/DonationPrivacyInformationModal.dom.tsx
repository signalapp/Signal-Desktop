// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useCallback } from 'react';
import { Modal } from './Modal.dom.js';
import { Button, ButtonSize } from './Button.dom.js';
import { I18n } from './I18n.dom.js';
import type { LocalizerType } from '../types/Util.std.js';
import { openLinkInWebBrowser } from '../util/openLinkInWebBrowser.dom.js';

export type DonationPrivacyInformationModalProps = {
  i18n: LocalizerType;
  onClose: () => void;
};

export function DonationPrivacyInformationModal({
  i18n,
  onClose,
}: DonationPrivacyInformationModalProps): JSX.Element {
  const handleDonationFAQsClick = () => {
    openLinkInWebBrowser(
      'https://support.signal.org/hc/articles/360031949872-Donor-FAQs'
    );
  };

  const modalFooter = (
    <div className="DonationPrivacyInformationModal__footer">
      <button
        type="button"
        className="DonationPrivacyInformationModal__faqs-link"
        onClick={handleDonationFAQsClick}
      >
        {i18n('icu:PreferencesDonations__faqs')}
      </button>
      <Button onClick={onClose} size={ButtonSize.Small}>
        {i18n('icu:PreferencesDonations__privacy-modal-ok')}
      </Button>
    </div>
  );

  const paragraphComponent = useCallback(
    (parts: Array<string | JSX.Element>) => <p>{parts}</p>,
    []
  );

  return (
    <Modal
      modalName="DonationPrivacyInformationModal"
      moduleClassName="DonationPrivacyInformationModal"
      i18n={i18n}
      title={i18n('icu:PreferencesDonations__privacy-modal-title')}
      onClose={onClose}
      modalFooter={modalFooter}
      padded={false}
    >
      <I18n
        components={{
          paragraph: paragraphComponent,
        }}
        i18n={i18n}
        id="icu:PreferencesDonations__privacy-modal-content"
      />
    </Modal>
  );
}
