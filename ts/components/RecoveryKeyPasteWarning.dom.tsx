// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { type JSX } from 'react';
import { AxoAlertDialog } from '../axo/AxoAlertDialog.dom.tsx';
import { tw } from '../axo/tw.dom.tsx';
import type { LocalizerType } from '../types/I18N.std.ts';
import { I18n } from './I18n.dom.tsx';
import { AxoSymbol } from '../axo/AxoSymbol.dom.tsx';

const SIGNAL_USER_SAFETY_LINK =
  'https://support.signal.org/hc/articles/9932566320410-Staying-Safe-from-Phishing-Scams-and-Impersonation';

function Strong(parts: Array<string | JSX.Element>): JSX.Element {
  return <strong>{parts}</strong>;
}

export const RecoveryKeyPasteWarning = ({
  onConfirm,
  onCancel,
  i18n,
}: {
  onConfirm: () => void;
  onCancel: () => void;
  i18n: LocalizerType;
}): JSX.Element => {
  return (
    <AxoAlertDialog.Root
      open
      onOpenChange={open => {
        if (!open) {
          onCancel();
        }
      }}
    >
      <AxoAlertDialog.Content escape="cancel-is-noop">
        <AxoAlertDialog.Body>
          <div className={tw('mb-2.5 flex justify-center')}>
            <div
              className={tw(
                'size-fit rounded-full p-3',
                'bg-safety-tint text-safety'
              )}
            >
              <AxoSymbol.Icon label={null} symbol="error-triangle" size={32} />
            </div>
          </div>
          <AxoAlertDialog.Title>
            {i18n('icu:Preferences__recovery-key__do-not-share-title')}
          </AxoAlertDialog.Title>
          <AxoAlertDialog.Description>
            <I18n
              id="icu:CompositionInput__recovery-key-warning--description"
              i18n={i18n}
              components={{
                strong: Strong,
                learnMoreLink: parts => (
                  <a
                    className={tw('whitespace-nowrap text-accent')}
                    href={SIGNAL_USER_SAFETY_LINK}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {parts}
                  </a>
                ),
              }}
            />
          </AxoAlertDialog.Description>
        </AxoAlertDialog.Body>
        <AxoAlertDialog.Footer>
          <AxoAlertDialog.Action
            variant="subtle-destructive"
            onClick={onConfirm}
          >
            {i18n('icu:CompositionInput__recovery-key-paste__share-key')}
          </AxoAlertDialog.Action>
          <AxoAlertDialog.Action
            variant="strong-primary"
            autoFocus
            onClick={onCancel}
          >
            {i18n('icu:CompositionInput__recovery-key-paste__do-not-share-key')}
          </AxoAlertDialog.Action>
        </AxoAlertDialog.Footer>
      </AxoAlertDialog.Content>
    </AxoAlertDialog.Root>
  );
};
