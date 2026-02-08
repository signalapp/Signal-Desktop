// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useCallback } from 'react';
import type { LocalizerType } from '../types/Util.std.js';
import { openLinkInWebBrowser } from '../util/openLinkInWebBrowser.dom.js';
import { AxoDialog } from '../axo/AxoDialog.dom.js';
import { I18n } from './I18n.dom.js';
import { tw } from '../axo/tw.dom.js';

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

  const paragraphComponent = useCallback(
    (parts: Array<string | React.JSX.Element>) => <p>{parts}</p>,
    []
  );

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
          <AxoDialog.Title>
            {i18n('icu:PreferencesDonations__privacy-modal-title')}
          </AxoDialog.Title>
          <AxoDialog.Close aria-label={i18n('icu:PinMessageDialog__Close')} />
        </AxoDialog.Header>
        <AxoDialog.Body>
          <div className={tw('flex flex-col gap-4 pt-1.5 pb-4')}>
            <I18n
              components={{
                paragraph: paragraphComponent,
              }}
              i18n={i18n}
              id="icu:PreferencesDonations__privacy-modal-content"
            />
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
