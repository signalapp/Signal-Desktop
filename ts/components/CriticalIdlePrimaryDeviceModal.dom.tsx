// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { useCallback, type JSX } from 'react';
import type { LocalizerType } from '../types/Util.std.ts';
import { CRITICAL_IDLE_PRIMARY_DEVICE_SUPPORT_PAGE } from './CriticalIdlePrimaryDeviceDialog.dom.tsx';
import { I18n } from './I18n.dom.tsx';
import { AxoAlertDialog } from '../axo/AxoAlertDialog.dom.tsx';
import { tw } from '../axo/tw.dom.tsx';
import { AxoSymbol } from '../axo/AxoSymbol.dom.tsx';

type CriticalIdlePrimaryDeviceModalProps = Readonly<{
  i18n: LocalizerType;
  onClose: () => void;
}>;

export function CriticalIdlePrimaryDeviceModal(
  props: CriticalIdlePrimaryDeviceModalProps
): JSX.Element {
  const { i18n } = props;
  const learnMoreLink = useCallback((parts: Array<string | JSX.Element>) => {
    return (
      <a
        href={CRITICAL_IDLE_PRIMARY_DEVICE_SUPPORT_PAGE}
        rel="noreferrer"
        target="_blank"
      >
        {parts}
      </a>
    );
  }, []);

  return (
    <AxoAlertDialog.Root open onOpenChange={props.onClose}>
      <AxoAlertDialog.Content escape="cancel-is-destructive">
        <AxoAlertDialog.Body>
          <div className={tw('mb-2.5 flex justify-center text-destructive')}>
            <AxoSymbol.Icon size={48} symbol="error-circle" label={null} />
          </div>
          <AxoAlertDialog.Title>
            {i18n('icu:CriticalIdlePrimaryDeviceModal__title')}
          </AxoAlertDialog.Title>
          <AxoAlertDialog.Description>
            <I18n
              id="icu:CriticalIdlePrimaryDeviceModal__description"
              i18n={i18n}
              components={{
                learnMoreLink,
              }}
            />
          </AxoAlertDialog.Description>
        </AxoAlertDialog.Body>
        <AxoAlertDialog.Footer>
          <AxoAlertDialog.Action
            variant="strong-primary"
            onClick={props.onClose}
          >
            {i18n('icu:Confirmation--confirm')}
          </AxoAlertDialog.Action>
        </AxoAlertDialog.Footer>
      </AxoAlertDialog.Content>
    </AxoAlertDialog.Root>
  );
}
