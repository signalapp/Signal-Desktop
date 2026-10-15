// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ReactNode } from 'react';
import { tw } from '../../axo/tw.dom.tsx';
import type { LocalizerType } from '../../types/I18N.std.ts';
import { AxoDialog } from '../../axo/AxoDialog.dom.tsx';
import { I18n } from '../I18n.dom.tsx';
import { AxoSymbol } from '../../axo/AxoSymbol.dom.tsx';

export type LinkedDevicesOnboardingDialogsProps = Readonly<{
  i18n: LocalizerType;
  onDismiss: VoidFunction;
}>;

export function LinkedDevicesOnboardingDialog(
  props: LinkedDevicesOnboardingDialogsProps
): ReactNode {
  const { i18n, onDismiss } = props;
  return (
    <AxoDialog.Root open onOpenChange={onDismiss}>
      <AxoDialog.Content size="sm" escape="cancel-is-noop">
        <AxoDialog.Header floating>
          <AxoDialog.Close />
        </AxoDialog.Header>
        <AxoDialog.Body>
          <div className={tw('mb-2.5 flex justify-center')}>
            <div
              className={tw(
                'size-fit rounded-full p-3',
                'bg-accent-tint text-accent'
              )}
            >
              <AxoSymbol.Icon
                size={24}
                label={null}
                symbol="device-phone-laptop"
              />
            </div>
          </div>
          <AxoDialog.Description>
            <div className={tw('text-primary')}>
              <p>
                <I18n
                  i18n={i18n}
                  id="icu:LinkedDevicesOnboardingDialog__description"
                  components={{
                    bold: children => <b>{children}</b>,
                  }}
                />
              </p>
              <ul className={tw('list-disc ps-4 [&>li]:mt-3')}>
                <li>{i18n('icu:LinkedDevicesOnboardingDialog__bullet--1')}</li>
                <li>{i18n('icu:LinkedDevicesOnboardingDialog__bullet--2')}</li>
                <li>
                  {i18n('icu:LinkedDevicesOnboardingDialog__bullet--3--2')}
                </li>
              </ul>
            </div>
          </AxoDialog.Description>
        </AxoDialog.Body>
      </AxoDialog.Content>
    </AxoDialog.Root>
  );
}
