// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode, JSX, MouseEvent } from 'react';
import { useCallback } from 'react';

export type PropsType = Readonly<{
  children?: ReactNode;
  actionText: string;
  onClick: () => void;
}>;

export function LeftPaneBanner({
  children,
  actionText,
  onClick,
}: PropsType): JSX.Element {
  const onClickWrap = useCallback(
    (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      onClick?.();
    },
    [onClick]
  );

  return (
    <div className="LeftPaneBanner">
      <div className="LeftPaneBanner__content">{children}</div>

      <div className="LeftPaneBanner__footer">
        <button
          title={actionText}
          aria-label={actionText}
          className="LeftPaneBanner__footer__action-button"
          onClick={onClickWrap}
          tabIndex={0}
          type="button"
        >
          {actionText}
        </button>
      </div>
    </div>
  );
}
