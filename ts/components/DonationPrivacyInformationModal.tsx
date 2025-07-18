// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useCallback } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { I18n } from './I18n';
import type { LocalizerType } from '../types/Util';
import { openLinkInWebBrowser } from '../util/openLinkInWebBrowser';

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
      <Button onClick={onClose}>{i18n('icu:Confirmation--confirm')}</Button>
    </div>
  );

  const paragraphComponent = useCallback(
    (parts: Array<string | JSX.Element>) => <p>{parts}</p>,
    []
  );

  return (
    <Modal
      modalName="DonationPrivacyInformationModal"
      i18n={i18n}
      title={i18n('icu:PreferencesDonations__privacy-modal-title')}
      onClose={onClose}
      hasXButton
      modalFooter={modalFooter}
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
