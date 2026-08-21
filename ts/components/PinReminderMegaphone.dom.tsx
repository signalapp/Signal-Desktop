// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { JSX } from 'react';
import type { LocalizerType } from '../types/Util.std.ts';
import type { PinReminderActionableMegaphoneType } from '../types/Megaphone.std.ts';
import { Megaphone } from './Megaphone.dom.tsx';

export type PropsType = {
  i18n: LocalizerType;
  isFullSize: boolean;
  onClickNarrowMegaphone: () => void;
} & Pick<PinReminderActionableMegaphoneType, 'onDismiss' | 'onShowModal'>;

export function PinReminderMegaphone({
  i18n,
  isFullSize,
  onClickNarrowMegaphone,
  onDismiss,
  onShowModal,
}: PropsType): JSX.Element {
  return (
    <Megaphone
      i18n={i18n}
      title={i18n('icu:PinReminderMegaphone__title')}
      body={i18n('icu:PinReminderMegaphone__body')}
      imagePath="images/pin-reminder.svg"
      isFullSize={isFullSize}
      primaryCtaText={i18n('icu:PinReminderMegaphone__verify')}
      secondaryCtaText={i18n('icu:PinReminderMegaphone__not-now')}
      testId="PinReminderMegaphone"
      onClickNarrowMegaphone={onClickNarrowMegaphone}
      onClickPrimaryCta={onShowModal}
      onClickSecondaryCta={onDismiss}
    />
  );
}
