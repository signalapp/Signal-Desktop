// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React from 'react';
import { openLinkInWebBrowser } from '../util/openLinkInWebBrowser.dom.js';
import { KEY_TRANSPARENCY_URL } from '../types/support.std.js';
import type { LocalizerType } from '../types/I18N.std.js';
import { AxoDialog } from '../axo/AxoDialog.dom.js';
import { tw } from '../axo/tw.dom.js';

export type KeyTransparencyOnboardingDialogProps = Readonly<{
  i18n: LocalizerType;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onContinue: () => void;
}>;

function openKeyTransparencyUrl() {
  openLinkInWebBrowser(KEY_TRANSPARENCY_URL);
}

export function KeyTransparencyOnboardingDialog(
  props: KeyTransparencyOnboardingDialogProps
): React.JSX.Element {
  const { i18n, open, onOpenChange, onContinue } = props;

  return (
    <AxoDialog.Root open={open} onOpenChange={onOpenChange}>
      <AxoDialog.Content escape="cancel-is-noop" size="sm">
        <AxoDialog.Header>
          <AxoDialog.Close
            aria-label={i18n(
              'icu:KeyTransparencyOnboardingDialog__CloseButton__AccessibilityLabel'
            )}
          />
        </AxoDialog.Header>
        <AxoDialog.Body>
          <div className={tw('mt-1.5 mb-3 flex items-center justify-center')}>
            <img
              className={tw('dark:hidden')}
              src="images/key-transparency-light.svg"
              height="110"
              width="110"
              alt=""
            />
            <img
              src="images/key-transparency-dark.svg"
              className={tw('hidden dark:inline')}
              height="110"
              width="110"
              alt=""
            />
          </div>
          <h3 className={tw('mt-6 mb-3 type-title-medium font-semibold')}>
            {i18n('icu:KeyTransparencyOnboardingDialog__Title')}
          </h3>
          <AxoDialog.Description>
            <div className={tw('mb-5 type-body-large text-label-secondary')}>
              {i18n('icu:KeyTransparencyOnboardingDialog__Description')}
            </div>
          </AxoDialog.Description>
        </AxoDialog.Body>
        <AxoDialog.Footer>
          <AxoDialog.Actions>
            <AxoDialog.Action
              variant="secondary"
              onClick={openKeyTransparencyUrl}
            >
              {i18n('icu:KeyTransparencyOnboardingDialog__LearnMore')}
            </AxoDialog.Action>
            <AxoDialog.Action variant="primary" onClick={onContinue}>
              {i18n('icu:KeyTransparencyOnboardingDialog__Continue')}
            </AxoDialog.Action>
          </AxoDialog.Actions>
        </AxoDialog.Footer>
      </AxoDialog.Content>
    </AxoDialog.Root>
  );
}
