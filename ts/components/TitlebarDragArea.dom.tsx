// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactElement } from 'react';
import React from 'react';
import { AxoDragRegion } from '../axo/AxoDragRegion.dom.tsx';

export function TitlebarDragArea(): ReactElement {
  return (
    <AxoDragRegion.Root always>
      <div className="module-title-bar-drag-area" />
    </AxoDragRegion.Root>
  );
}
