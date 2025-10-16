// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useRef, useState, type ReactNode } from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { useLayoutEffect } from '@react-aria/utils';
import { strictAssert } from '../../../util/assert.std.js';

export type FunTooltipProps = Readonly<{
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  disableHoverableContent?: boolean;
  side?: Tooltip.TooltipContentProps['side'];
  align?: Tooltip.TooltipContentProps['align'];
  collisionBoundarySelector?: string;
  collisionPadding?: number;
  content: ReactNode;
  children: ReactNode;
}>;

export function FunTooltip(props: FunTooltipProps): JSX.Element {
  const ref = useRef<HTMLButtonElement>(null);
  const [collisionBoundary, setCollisionBoundary] = useState<Element | null>(
    null
  );
  useLayoutEffect(() => {
    if (props.collisionBoundarySelector == null) {
      return;
    }
    strictAssert(ref.current, 'missing ref');
    const trigger = ref.current;
    setCollisionBoundary(trigger.closest(props.collisionBoundarySelector));
  }, [props.collisionBoundarySelector]);

  return (
    <Tooltip.Root
      open={props.open}
      onOpenChange={props.onOpenChange}
      disableHoverableContent={props.disableHoverableContent}
    >
      <Tooltip.Trigger ref={ref} asChild>
        {props.children}
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side={props.side}
          align={props.align}
          className="FunTooltip"
          collisionBoundary={collisionBoundary}
          collisionPadding={props.collisionPadding}
        >
          <span className="FunTooltip__Text">{props.content}</span>
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
