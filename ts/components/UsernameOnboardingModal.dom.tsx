// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { JSX } from 'react';
import type { LocalizerType } from '../types/Util.std.ts';
import { AxoDialog } from '../axo/AxoDialog.dom.tsx';
import { tw } from '../axo/tw.dom.tsx';

export type PropsType = Readonly<{
  i18n: LocalizerType;
  onNext: () => void;
  onSkip: () => void;
  onClose: () => void;
}>;

export function UsernameOnboardingModal({
  i18n,
  onNext,
  onSkip,
  onClose,
}: PropsType): JSX.Element {
  return (
    <AxoDialog.Root open onOpenChange={onClose}>
      <AxoDialog.Content size="sm" escape="cancel-is-noop">
        <AxoDialog.Header>
          <AxoDialog.Title>
            {i18n('icu:UsernameOnboardingModalBody__title')}
          </AxoDialog.Title>
          <AxoDialog.Close />
        </AxoDialog.Header>
        <AxoDialog.Body>
          <div className={tw('mb-2 flex flex-col gap-4')}>
            <UsernameOnboardingModalItem
              label={i18n(
                'icu:UsernameOnboardingModalBody__row__number__title'
              )}
              description={i18n(
                'icu:UsernameOnboardingModalBody__row__number__body'
              )}
              imageLight="../images/phone_40_color.svg"
              imageDark="../images/phone_40_color_dark.svg"
            />
            <UsernameOnboardingModalItem
              label={i18n(
                'icu:UsernameOnboardingModalBody__row__username__title'
              )}
              description={i18n(
                'icu:UsernameOnboardingModalBody__row__username__body'
              )}
              imageLight="../images/usernames_40_color.svg"
              imageDark="../images/usernames_40_color_dark.svg"
            />
            <UsernameOnboardingModalItem
              label={i18n('icu:UsernameOnboardingModalBody__row__qr__title')}
              description={i18n(
                'icu:UsernameOnboardingModalBody__row__qr__body'
              )}
              imageLight="../images/qr_codes_40_color.svg"
              imageDark="../images/qr_codes_40_color_dark.svg"
            />
          </div>
        </AxoDialog.Body>
        <AxoDialog.Footer>
          <AxoDialog.Actions>
            <AxoDialog.Action variant="secondary" onClick={onSkip}>
              {i18n('icu:UsernameOnboardingModalBody__skip')}
            </AxoDialog.Action>
            <AxoDialog.Action variant="primary" onClick={onNext}>
              {i18n('icu:UsernameOnboardingModalBody__continue')}
            </AxoDialog.Action>
          </AxoDialog.Actions>
        </AxoDialog.Footer>
      </AxoDialog.Content>
    </AxoDialog.Root>
  );
}

function UsernameOnboardingModalItem(props: {
  label: string;
  description: string;
  imageLight: string;
  imageDark: string;
}) {
  return (
    <div className={tw('flex gap-6')}>
      <div>
        <img
          width={40}
          height={40}
          src={props.imageDark}
          alt=""
          className={tw('not-dark:hidden')}
        />
        <img
          width={40}
          height={40}
          src={props.imageLight}
          alt=""
          className={tw('dark:hidden')}
        />
      </div>
      <div className={tw('flex-1')}>
        <h3 className={tw('type-body-large text-label-primary')}>
          {props.label}
        </h3>
        <p className={tw('type-body-medium text-label-secondary')}>
          {props.description}
        </p>
      </div>
    </div>
  );
}
