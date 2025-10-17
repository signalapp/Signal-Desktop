// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ButtonHTMLAttributes } from 'react';
import * as React from 'react';
import classNames from 'classnames';
import type { LocalizerType } from '../../types/Util.std.js';

export type OwnProps = {
  readonly installed: boolean;
  readonly i18n: LocalizerType;
  readonly blue?: boolean;
};

export type Props = OwnProps & ButtonHTMLAttributes<HTMLButtonElement>;

export const StickerPackInstallButton = React.forwardRef<
  HTMLButtonElement,
  Props
>(function StickerPackInstallButtonInner(
  { i18n, installed, blue, ...props }: Props,
  ref
) {
  return (
    <button
      type="button"
      ref={ref}
      className={classNames({
        'module-sticker-manager__install-button': true,
        'module-sticker-manager__install-button--blue': blue,
      })}
      aria-label={i18n('icu:stickers--StickerManager--Install')}
      {...props}
    >
      {installed
        ? i18n('icu:stickers--StickerManager--Uninstall')
        : i18n('icu:stickers--StickerManager--Install')}
    </button>
  );
});
