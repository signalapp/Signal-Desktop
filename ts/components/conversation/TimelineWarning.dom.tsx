// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from 'react';
import React from 'react';

import type { LocalizerType } from '../../types/Util.std.js';

const CLASS_NAME = 'module-TimelineWarning';
const ICON_CONTAINER_CLASS_NAME = `${CLASS_NAME}__icon-container`;
const GENERIC_ICON_CLASS_NAME = `${CLASS_NAME}__generic-icon`;
const TEXT_CLASS_NAME = `${CLASS_NAME}__text`;
const LINK_CLASS_NAME = `${TEXT_CLASS_NAME}__link`;
const CLOSE_BUTTON_CLASS_NAME = `${CLASS_NAME}__close-button`;

type TimelineWarningProps = Readonly<{
  customInfo?: ReactNode;
  children: ReactNode;
  i18n: LocalizerType;
  onClose: () => void;
}>;

export function TimelineWarning(
  props: TimelineWarningProps
): React.JSX.Element {
  const { i18n } = props;
  return (
    <div className={CLASS_NAME}>
      {props.customInfo}
      {props.customInfo == null && (
        <div className={ICON_CONTAINER_CLASS_NAME}>
          <div className={GENERIC_ICON_CLASS_NAME} />
        </div>
      )}
      <div className={TEXT_CLASS_NAME}>{props.children}</div>
      <button
        aria-label={i18n('icu:close')}
        className={CLOSE_BUTTON_CLASS_NAME}
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
): React.JSX.Element {
  return (
    <button className={LINK_CLASS_NAME} onClick={props.onClick} type="button">
      {props.children}
    </button>
  );
}

export type TimelineWarningCustomInfoProps = Readonly<{ children: ReactNode }>;

export function TimelineWarningCustomInfo(
  props: TimelineWarningCustomInfoProps
): React.JSX.Element {
  return (
    <div className="module-TimelineWarning__custom_info">{props.children}</div>
  );
}
