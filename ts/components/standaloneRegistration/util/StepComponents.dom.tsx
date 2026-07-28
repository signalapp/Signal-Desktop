// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { JSX, ReactNode } from 'react';
import classNames from 'classnames';

import { tw } from '../../../axo/tw.dom.tsx';

import type { LocalizerType } from '../../../types/I18N.std.ts';
import { AxoIconButton } from '../../../axo/AxoIconButton.dom.tsx';

export const PIN_ARTICLE_ON_SUPPORT =
  'https://support.signal.org/hc/articles/360007059792-Signal-PIN';

export function Container({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}): JSX.Element {
  return (
    <div
      className={classNames(
        tw('flex h-88 min-h-0 grow flex-col items-center text-center'),
        className
      )}
    >
      {children}
    </div>
  );
}

export function TopMatter({
  i18n,
  onBackClick,
  rightContent,
}: {
  i18n: LocalizerType;
  onBackClick?: () => void;
  rightContent?: ReactNode;
}): JSX.Element {
  return (
    <div className={tw('flex w-full items-center')}>
      {onBackClick ? (
        <AxoIconButton.Root
          variant="implied-secondary"
          size="sm"
          symbol="chevron-[start]"
          onClick={onBackClick}
          label={i18n('icu:StandaloneRegistration--back')}
        />
      ) : undefined}
      <Spacer className={tw('grow')} />
      {rightContent}
    </div>
  );
}

export function InputContainer({
  children,
  className,
  helperElement,
}: {
  children: ReactNode;
  className?: string;
  helperElement?: ReactNode;
}): JSX.Element {
  return (
    <div
      className={classNames(
        tw('flex min-h-fit max-w-full flex-col items-center'),
        className
      )}
    >
      {children}
      {helperElement}
    </div>
  );
}

export function Spacer({ className }: { className?: string }): JSX.Element {
  return (
    <div className={classNames(tw('min-h-2 min-w-2 shrink'), className)} />
  );
}

export function Title({ text }: { text: string }): JSX.Element {
  return <div className={tw('mb-2 type-title-medium')}>{text}</div>;
}

export function Description({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}): JSX.Element {
  return (
    <div
      className={classNames(
        tw('w-90.5 max-w-full type-body-large text-secondary'),
        className
      )}
    >
      {children}
    </div>
  );
}

export function Buttons({
  children,
  leftSideContent,
}: {
  children: ReactNode;
  leftSideContent?: ReactNode;
}): JSX.Element {
  return (
    <div className={tw('flex w-full items-end')}>
      {leftSideContent}
      <Spacer className={tw('grow')} />
      {children}
    </div>
  );
}
