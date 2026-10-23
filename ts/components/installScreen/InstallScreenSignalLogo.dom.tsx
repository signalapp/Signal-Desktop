// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactElement } from 'react';
import { AxoBrand } from '../../axo/AxoBrand.dom.tsx';
import { tw } from '../../axo/tw.dom.tsx';

export function InstallScreenSignalLogo(): ReactElement {
  return (
    <div
      className={tw(
        'absolute inset-s-8 top-[calc(35px+var(--title-bar-drag-area-height))]'
      )}
    >
      <AxoBrand.LogoAndWordMark maxWidth={112} />
    </div>
  );
}
