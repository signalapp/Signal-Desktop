// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useCallback, type JSX } from 'react';

import type { RemoteActionableMegaphoneType } from '../types/Megaphone.std.ts';
import type { LocalizerType } from '../types/Util.std.ts';
import { Megaphone } from './Megaphone.dom.tsx';

export type PropsType = Omit<RemoteActionableMegaphoneType, 'type'> & {
  isFullSize: boolean;
  i18n: LocalizerType;
  onClickNarrowMegaphone: () => void;
};

export function RemoteMegaphone({
  i18n,
  title,
  body,
  imagePath,
  primaryCtaId,
  secondaryCtaId,
  primaryCtaText,
  secondaryCtaText,
  remoteMegaphoneId,
  isFullSize,
  onClickNarrowMegaphone,
  onInteractWithMegaphone,
}: PropsType): JSX.Element {
  const onClickPrimaryCta = useCallback(() => {
    if (primaryCtaId) {
      onInteractWithMegaphone(remoteMegaphoneId, primaryCtaId);
    }
  }, [primaryCtaId, remoteMegaphoneId, onInteractWithMegaphone]);

  const onClickSecondaryCta = useCallback(() => {
    if (secondaryCtaId) {
      onInteractWithMegaphone(remoteMegaphoneId, secondaryCtaId);
    }
    return null;
  }, [remoteMegaphoneId, secondaryCtaId, onInteractWithMegaphone]);

  return (
    <Megaphone
      i18n={i18n}
      title={title}
      body={body}
      imagePath={imagePath}
      isFullSize={isFullSize}
      primaryCtaText={primaryCtaText}
      secondaryCtaText={secondaryCtaText}
      testId="RemoteMegaphone"
      onClickNarrowMegaphone={onClickNarrowMegaphone}
      onClickPrimaryCta={primaryCtaId ? onClickPrimaryCta : null}
      onClickSecondaryCta={secondaryCtaId ? onClickSecondaryCta : null}
    />
  );
}
