// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { JSX, ReactElement } from 'react';

import { openLinkInWebBrowser } from '../util/openLinkInWebBrowser.dom.ts';
import { KEY_TRANSPARENCY_URL } from '../types/support.std.ts';
import type { LocalizerType } from '../types/I18N.std.ts';
import { AxoDialog } from '../axo/AxoDialog.dom.tsx';
import { tw } from '../axo/tw.dom.tsx';
import { I18n, type I18nComponentParts } from './I18n.dom.tsx';

export type KeyTransparencyOnboardingDialogProps = Readonly<{
  i18n: LocalizerType;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onContinue: () => void;
}>;

function openKeyTransparencyUrl() {
  openLinkInWebBrowser(KEY_TRANSPARENCY_URL);
}

function renderParagraph(parts: I18nComponentParts): ReactElement {
  return <p>{parts}</p>;
}

export function KeyTransparencyOnboardingDialog(
  props: KeyTransparencyOnboardingDialogProps
): JSX.Element {
  const { i18n, open, onOpenChange, onContinue } = props;

  return (
    <AxoDialog.Root open={open} onOpenChange={onOpenChange}>
      <AxoDialog.Content escape="cancel-is-noop" size="md">
        <AxoDialog.Header floating>
          <AxoDialog.Close />
        </AxoDialog.Header>
        <AxoDialog.Body>
          <div className={tw('mb-3 flex items-center justify-center')}>
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
          <div className={tw('text-pretty')}>
            <AxoDialog.Title>
              <span className={tw('type-title-medium')}>
                {i18n('icu:KeyTransparencyOnboardingDialog__Title')}
              </span>
            </AxoDialog.Title>
            <AxoDialog.Description>
              <div className={tw('flex flex-col gap-2.5')}>
                <I18n
                  i18n={i18n}
                  id="icu:KeyTransparencyOnboardingDialog__Description-v2"
                  components={{ paragraph: renderParagraph }}
                />
              </div>
            </AxoDialog.Description>
          </div>
        </AxoDialog.Body>
        <AxoDialog.Footer>
          <AxoDialog.Actions>
            <AxoDialog.Action
              variant="subtle-secondary"
              onClick={openKeyTransparencyUrl}
              arrow="external-link"
            >
              {i18n('icu:KeyTransparencyOnboardingDialog__LearnMore')}
            </AxoDialog.Action>
            <AxoDialog.Action variant="strong-primary" onClick={onContinue}>
              {i18n('icu:KeyTransparencyOnboardingDialog__Continue')}
            </AxoDialog.Action>
          </AxoDialog.Actions>
        </AxoDialog.Footer>
      </AxoDialog.Content>
    </AxoDialog.Root>
  );
}
