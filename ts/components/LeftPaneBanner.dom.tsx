// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from 'react';
import React, { useCallback } from 'react';

const BASE_CLASS_NAME = 'LeftPaneBanner';

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
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      onClick?.();
    },
    [onClick]
  );

  return (
    <div className={BASE_CLASS_NAME}>
      <div className={`${BASE_CLASS_NAME}__content`}>{children}</div>

      <div className={`${BASE_CLASS_NAME}__footer`}>
        <button
          title={actionText}
          aria-label={actionText}
          className={`${BASE_CLASS_NAME}__footer__action-button`}
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
