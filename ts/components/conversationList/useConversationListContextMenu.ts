// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import type { RefObject } from 'react';
import type { ContextMenuTriggerType } from 'react-contextmenu';

export function useConversationListContextMenu(
  menuTriggerRef: RefObject<ContextMenuTriggerType>
): ContextMenuTriggerType['handleContextClick'] {
  return React.useCallback(
    (event: React.MouseEvent<HTMLDivElement> | MouseEvent): void => {
      if (menuTriggerRef.current) {
        menuTriggerRef.current.handleContextClick(
          event ?? new MouseEvent('click')
        );
      }
    },
    [menuTriggerRef]
  );
}
