// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useId, useCallback, useState } from 'react';
import type { ReactNode } from 'react';

import { tw } from '../../axo/tw.dom.tsx';
import { createLogger } from '../../logging/log.std.ts';
import type { LocalizerType } from '../../types/Util.std.ts';
import { toLogFormat } from '../../types/errors.std.ts';
import type {
  PromptOSAuthReasonType,
  PromptOSAuthResultType,
} from '../../util/os/promptOSAuthMain.main.ts';
import { AxoItem } from '../../axo/items/AxoItem.dom.tsx';
import { OSAuthErrorDialog } from './OSAuthErrorDialog.dom.tsx';

type SignalAccountKeysButtonPropsType = Readonly<{
  i18n: LocalizerType;
  promptOSAuth: (
    reason: PromptOSAuthReasonType
  ) => Promise<PromptOSAuthResultType>;
  onClick: () => void;
}>;

const log = createLogger('SignalAccountKeysButton');

export function SignalAccountKeysButton({
  i18n,
  promptOSAuth,
  onClick: showAccountKeys,
}: SignalAccountKeysButtonPropsType): ReactNode {
  const id = useId();

  const [authError, setAuthError] =
    useState<Exclude<PromptOSAuthResultType, 'success' | 'unsupported'>>();
  const [isAuthPending, setIsAuthPending] = useState<boolean>(false);

  const onClick = useCallback(async () => {
    setAuthError(undefined);

    try {
      setIsAuthPending(true);
      const result = await promptOSAuth('view-aep');
      if (result === 'success' || result === 'unsupported') {
        showAccountKeys();
      } else {
        setAuthError(result);
      }
    } catch (e) {
      log.error(
        'Error thrown when requesting OS auth for viewing AEP',
        toLogFormat(e)
      );
      setAuthError('error');
      // oxlint-disable-next-line react/todo
    } finally {
      setIsAuthPending(false);
    }
  }, [promptOSAuth, showAccountKeys]);

  return (
    <>
      <AxoItem.Root disabled={isAuthPending}>
        <AxoItem.Leading>
          <img
            className={tw('min-w-17.5')}
            alt={i18n('icu:Preferences__SignalAccount__label')}
            src="images/signal-login.svg"
            width="70"
            height="40"
          />
        </AxoItem.Leading>
        <AxoItem.Content>
          <AxoItem.Body>
            <AxoItem.Label id={id}>
              {i18n('icu:Preferences__SignalAccount__label')}
            </AxoItem.Label>
            <AxoItem.Description>
              {i18n('icu:Preferences__SignalAccount__description')}
            </AxoItem.Description>
            <AxoItem.HiddenTrigger labelledby={id} onClick={onClick} />
          </AxoItem.Body>
          <AxoItem.Trailing>
            <AxoItem.Arrow />
          </AxoItem.Trailing>
        </AxoItem.Content>
      </AxoItem.Root>
      <OSAuthErrorDialog
        i18n={i18n}
        open={authError != null}
        onOpenChange={newOpen => {
          setAuthError(newOpen ? 'error' : undefined);
        }}
      />
    </>
  );
}
