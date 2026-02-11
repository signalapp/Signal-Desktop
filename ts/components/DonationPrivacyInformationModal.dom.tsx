// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import type { LocalizerType } from '../types/Util.std.js';
import { openLinkInWebBrowser } from '../util/openLinkInWebBrowser.dom.js';
import { AxoDialog } from '../axo/AxoDialog.dom.js';
import { tw } from '../axo/tw.dom.js';
import { AxoSymbol } from '../axo/AxoSymbol.dom.js';

export type DonationPrivacyInformationModalProps = {
  i18n: LocalizerType;
  onClose: () => void;
};

export function DonationPrivacyInformationModal({
  i18n,
  onClose,
}: DonationPrivacyInformationModalProps): React.JSX.Element {
  const handleDonationFAQsClick = () => {
    openLinkInWebBrowser(
      'https://support.signal.org/hc/articles/360031949872-Donor-FAQs'
    );
  };

  return (
    <AxoDialog.Root
      open
      onOpenChange={open => {
        if (!open) {
          onClose();
        }
      }}
    >
      <AxoDialog.Content
        size="sm"
        escape="cancel-is-noop"
        disableMissingAriaDescriptionWarning
      >
        <AxoDialog.Header>
          <AxoDialog.Title screenReaderOnly>
            {i18n('icu:PreferencesDonations__privacy-modal-title')}
          </AxoDialog.Title>
          <AxoDialog.Close aria-label={i18n('icu:PinMessageDialog__Close')} />
        </AxoDialog.Header>
        <AxoDialog.Body>
          <img
            className={tw('m-auto mb-3')}
            alt={i18n(
              'icu:PreferencesDonations__privacy-modal-icon-accessibility-label'
            )}
            src="images/signal-heart.svg"
          />
          <div className={tw('flex flex-col gap-4 pt-1.5 pb-4')}>
            <div className={tw('mt-1 mb-2')}>
              {i18n('icu:PreferencesDonations__privacy-modal-intro')}
            </div>
            <ul className={tw('flex flex-col gap-6')}>
              <li className={tw('flex flex-row gap-4')}>
                <div>
                  <AxoSymbol.Icon size={20} symbol="badge-set" label={null} />
                </div>
                <div>
                  {i18n('icu:PreferencesDonations__privacy-modal-list-1')}
                </div>
              </li>
              <li className={tw('flex gap-x-4')}>
                <div>
                  <AxoSymbol.Icon size={20} symbol="lock" label={null} />
                </div>
                <div>
                  {i18n('icu:PreferencesDonations__privacy-modal-list-2')}
                </div>
              </li>
              <li className={tw('flex gap-x-4')}>
                <div>
                  <AxoSymbol.Icon size={20} symbol="heart" label={null} />
                </div>
                <div>
                  {i18n('icu:PreferencesDonations__privacy-modal-list-3')}
                </div>
              </li>
            </ul>
          </div>
        </AxoDialog.Body>
        <AxoDialog.Footer>
          <AxoDialog.Actions>
            <AxoDialog.Action
              variant="secondary"
              onClick={handleDonationFAQsClick}
            >
              {i18n('icu:PreferencesDonations__faqs')}
            </AxoDialog.Action>
            <AxoDialog.Action variant="primary" onClick={onClose}>
              {i18n('icu:PreferencesDonations__privacy-modal-ok')}
            </AxoDialog.Action>
          </AxoDialog.Actions>
        </AxoDialog.Footer>
      </AxoDialog.Content>
    </AxoDialog.Root>
  );
}
