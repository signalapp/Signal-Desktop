import * as React from 'react';
import classNames from 'classnames';
import { LocalizerType } from '../../types/Util';

export type OwnProps = {
  readonly installed: boolean;
  readonly i18n: LocalizerType;
  readonly blue?: boolean;
};

export type Props = OwnProps & React.HTMLProps<HTMLButtonElement>;

export const StickerPackInstallButton = React.forwardRef<
  HTMLButtonElement,
  Props
>(({ i18n, installed, blue, ...props }: Props, ref) => (
  <button
    ref={ref}
    className={classNames({
      'module-sticker-manager__install-button': true,
      'module-sticker-manager__install-button--blue': blue,
    })}
    {...props}
  >
    {installed
      ? i18n('stickers--StickerManager--Uninstall')
      : i18n('stickers--StickerManager--Install')}
  </button>
));
