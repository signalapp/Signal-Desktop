// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ReactNode } from 'react';
import { tw } from '../../axo/tw.dom.tsx';
import type { LocalizerType } from '../../types/I18N.std.ts';
import { AxoDialog } from '../../axo/AxoDialog.dom.tsx';
import { I18n } from '../I18n.dom.tsx';

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
        <AxoDialog.Header>
          <AxoDialog.Close />
        </AxoDialog.Header>
        <AxoDialog.Body>
          <div
            className={tw(
              'mx-auto flex items-center justify-center',
              'mb-5 h-12 w-17',
              'bg-accent-tint',
              'rounded-full'
            )}
          >
            <div
              className={tw(
                'size-8',
                'mask-[url(../images/devices.svg)] mask-contain',
                'bg-(--axo-color-label-accent)'
              )}
            />
          </div>
          <div className={tw('flex flex-col items-center')}>
            <p className={tw('type-body-medium')}>
              <I18n
                i18n={i18n}
                id="icu:LinkedDevicesOnboardingDialog__description"
                components={{
                  bold: children => <b>{children}</b>,
                }}
              />
            </p>
            <ul className={tw('mb-10 list-disc ps-4 [&>li]:mt-3')}>
              <li>{i18n('icu:LinkedDevicesOnboardingDialog__bullet--1')}</li>
              <li>{i18n('icu:LinkedDevicesOnboardingDialog__bullet--2')}</li>
              <li>{i18n('icu:LinkedDevicesOnboardingDialog__bullet--3')}</li>
            </ul>
          </div>
        </AxoDialog.Body>
      </AxoDialog.Content>
    </AxoDialog.Root>
  );
}
