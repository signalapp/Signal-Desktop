// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import classNames from 'classnames';
import { Manager, Reference } from 'react-popper';
import type { LocalizerType } from '../types/Util';
import { useRefMerger } from '../hooks/useRefMerger';

export type PropsType = {
  i18n: LocalizerType;
  isViewOnceToggled: boolean;
  onViewOnceButtonToggle: (isVO: boolean) => unknown;
};

export function ViewOnceSettingButton({
  i18n,
  isViewOnceToggled,
  onViewOnceButtonToggle,
}: PropsType): JSX.Element {
  const buttonRef = React.useRef<HTMLButtonElement | null>(null);
  const refMerger = useRefMerger();

  const handleClick = () => {
    onViewOnceButtonToggle(!isViewOnceToggled);
  };

  return (
    <Manager>
      <Reference>
        {({ ref }) => (
          <button
            className={classNames({
              ViewOnceSettingButton__button: true,
              'ViewOnceSettingButton__button--toggled': isViewOnceToggled,
            })}
            onClick={handleClick}
            ref={refMerger(buttonRef, ref)}
            type="button"
          />
        )}
      </Reference>
    </Manager>
  );
}
