// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { createPortal } from 'react-dom';
import type { LocalizerType } from '../types/Util.js';
import { ShortcutGuide } from './ShortcutGuide.js';

export type PropsType = {
  platform: string;
  readonly closeShortcutGuideModal: () => unknown;
  readonly i18n: LocalizerType;
};

export const ShortcutGuideModal = React.memo(function ShortcutGuideModalInner(
  props: PropsType
) {
  const { i18n, closeShortcutGuideModal, platform } = props;
  const [root, setRoot] = React.useState<HTMLElement | null>(null);

  React.useEffect(() => {
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
