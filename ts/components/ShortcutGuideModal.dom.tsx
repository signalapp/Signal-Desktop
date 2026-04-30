// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { memo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { LocalizerType } from '../types/Util.std.ts';
import { ShortcutGuide } from './ShortcutGuide.dom.tsx';

export type PropsType = {
  platform: string;
  readonly closeShortcutGuideModal: () => unknown;
  readonly i18n: LocalizerType;
};

export const ShortcutGuideModal = memo(function ShortcutGuideModalInner(
  props: PropsType
) {
  const { i18n, closeShortcutGuideModal, platform } = props;
  const [root, setRoot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const div = document.createElement('div');
    document.body.appendChild(div);
    setRoot(div);

    return () => {
      document.body.removeChild(div);
    };
  }, []);

  return root
    ? createPortal(
        <div className="module-shortcut-guide-modal">
          <div className="module-shortcut-guide-container">
            <ShortcutGuide
              close={closeShortcutGuideModal}
              i18n={i18n}
              platform={platform}
            />
          </div>
        </div>,
        root
      )
    : null;
});
