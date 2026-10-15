// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { JSX } from 'react';

import type { LocalizerType } from '../types/Util.std.ts';
import { openLinkInWebBrowser } from '../util/openLinkInWebBrowser.dom.ts';
import { AxoDialog } from '../axo/AxoDialog.dom.tsx';
import { tw } from '../axo/tw.dom.tsx';
import { AxoSymbol } from '../axo/AxoSymbol.dom.tsx';

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

  return (
    <AxoDialog.Root
      open
      onOpenChange={open => {
        if (!open) {
          onClose();
        }
      }}
    >
      <AxoDialog.Content size="sm" escape="cancel-is-noop">
        <AxoDialog.Header floating>
          <AxoDialog.Title>
            {i18n('icu:PreferencesDonations__privacy-modal-title')}
          </AxoDialog.Title>
          <AxoDialog.Close />
        </AxoDialog.Header>
        <AxoDialog.Body>
          <div className={tw('mb-2.5 flex justify-center')}>
            <img
              alt={i18n(
                'icu:PreferencesDonations__privacy-modal-icon-accessibility-label'
              )}
              src="images/signal-heart.svg"
              width={64}
              height={64}
            />
          </div>
          <div className={tw('flex flex-col gap-4 text-primary')}>
            <AxoDialog.Description>
              <p>{i18n('icu:PreferencesDonations__privacy-modal-intro')}</p>
            </AxoDialog.Description>
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
              variant="subtle-secondary"
              onClick={handleDonationFAQsClick}
            >
              {i18n('icu:PreferencesDonations__faqs')}
            </AxoDialog.Action>
            <AxoDialog.Action variant="strong-primary" onClick={onClose}>
              {i18n('icu:PreferencesDonations__privacy-modal-ok')}
            </AxoDialog.Action>
          </AxoDialog.Actions>
        </AxoDialog.Footer>
      </AxoDialog.Content>
    </AxoDialog.Root>
  );
}
