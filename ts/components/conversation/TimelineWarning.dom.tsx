// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode, JSX } from 'react';

import type { LocalizerType } from '../../types/Util.std.ts';

type TimelineWarningProps = Readonly<{
  customInfo?: ReactNode;
  children: ReactNode;
  i18n: LocalizerType;
  onClose: () => void;
}>;

export function TimelineWarning(props: TimelineWarningProps): JSX.Element {
  const { i18n } = props;
  return (
    <div className="module-TimelineWarning">
      {props.customInfo}
      {props.customInfo == null && (
        <div className="module-TimelineWarning__generic-icon" />
      )}
      <div className="module-TimelineWarning__text">{props.children}</div>
      <button
        aria-label={i18n('icu:close')}
        className="module-TimelineWarning__close-button"
        onClick={props.onClose}
        type="button"
      />
    </div>
  );
}

type TimelineWarningLinkProps = Readonly<{
  children: ReactNode;
  onClick: () => void;
}>;

export function TimelineWarningLink(
  props: TimelineWarningLinkProps
): JSX.Element {
  return (
    <button
      className="module-TimelineWarning__text__link"
      onClick={props.onClick}
      type="button"
    >
      {props.children}
    </button>
  );
}

export type TimelineWarningCustomInfoProps = Readonly<{ children: ReactNode }>;

export function TimelineWarningCustomInfo(
  props: TimelineWarningCustomInfoProps
): JSX.Element {
  return (
    <div className="module-TimelineWarning__custom-info">{props.children}</div>
  );
}
