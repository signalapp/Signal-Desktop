// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { JSX } from 'react';

import { MINUTE } from '../../../util/durations/constants.std.ts';
import { tw } from '../../../axo/tw.dom.tsx';
import { AxoButton } from '../../../axo/AxoButton.dom.tsx';
import { openLinkInWebBrowser } from '../../../util/openLinkInWebBrowser.dom.ts';
import { CONTACT_SUPPORT_URL } from '../../../util/contactSupport.dom.tsx';
import {
  Container,
  Description,
  Spacer,
  Title,
} from '../util/StepComponents.dom.tsx';

import type { LocalizerType } from '../../../types/I18N.std.ts';
import type { ActionCreator } from '../../../state/types.std.ts';
import type { startRegistration as doStartRegistration } from '../../../state/ducks/standaloneInstaller.preload.ts';

export function AccountLockedScreen({
  i18n,
  startRegistration,
}: {
  startRegistration: ActionCreator<typeof doStartRegistration>;
  i18n: LocalizerType;
}): JSX.Element {
  return (
    <Container>
      <Spacer className={tw('h-23')} />
      <Title text={i18n('icu:StandaloneRegistration--AccountLocked--header')} />
      <Description className={tw('w-125')}>
        {i18n('icu:StandaloneRegistration--AccountLocked--description')}
      </Description>
      <Spacer className={tw('h-40 grow')} />
      <div className={tw('flex w-64 flex-col gap-2')}>
        <AxoButton.Root
          variant="strong-primary"
          size="lg"
          onClick={() =>
            startRegistration({
              waitUntil: Date.now() + MINUTE * 5,
              blankPhoneNumber: true,
            })
          }
        >
          {i18n('icu:StandaloneRegistration--AccountLocked--start-over-button')}
        </AxoButton.Root>
        <AxoButton.Root
          variant="strong-secondary"
          size="lg"
          onClick={() => {
            openLinkInWebBrowser(CONTACT_SUPPORT_URL);
          }}
        >
          {i18n('icu:StandaloneRegistration--AccountLocked--help-button')}
        </AxoButton.Root>
      </div>
    </Container>
  );
}
