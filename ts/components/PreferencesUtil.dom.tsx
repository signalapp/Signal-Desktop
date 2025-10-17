// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import classNames from 'classnames';
import React, { type ReactNode, useMemo } from 'react';
import { v4 as uuid } from 'uuid';
import lodash from 'lodash';
import {
  CircleCheckbox,
  Variant as CircleCheckboxVariant,
} from './CircleCheckbox.dom.js';

const { noop } = lodash;

export function SettingsRow({
  children,
  title,
  className,
}: {
  children: ReactNode;
  title?: string;
  className?: string;
}): JSX.Element {
  return (
    <fieldset className={classNames('Preferences__settings-row', className)}>
      {title && <legend className="Preferences__padding">{title}</legend>}
      {children}
    </fieldset>
  );
}

export function FlowingSettingsControl({
  children,
}: {
  children: ReactNode;
}): JSX.Element {
  return <div className="Preferences__flow-control">{children}</div>;
}

export function LightIconLabel({
  icon,
  children,
}: {
  icon: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <label className="Preferences__light-icon-label">
      <div className={classNames('Preferences__control--icon', icon)} />
      <div>{children}</div>
    </label>
  );
}

export function SettingsControl({
  icon,
  left,
  onClick,
  right,
  description,
}: {
  /** A className or `true` to leave room for icon */
  icon?: string | true;
  left: ReactNode;
  onClick?: () => unknown;
  right: ReactNode;
  description?: ReactNode;
}): JSX.Element {
  const content = (
    <>
      {icon && (
        <div
          className={classNames(
            'Preferences__control--icon',
            icon === true ? null : icon
          )}
        />
      )}
      <div className="Preferences__control--key">
        {left}
        {description ? (
          <div className="Preferences__description">{description}</div>
        ) : undefined}
      </div>
      <div className="Preferences__control--value">{right}</div>
    </>
  );

  if (onClick) {
    return (
      <button
        className="Preferences__control Preferences__control--clickable"
        type="button"
        onClick={onClick}
      >
        {content}
      </button>
    );
  }

  return <div className="Preferences__control">{content}</div>;
}

type SettingsRadioOptionType<Enum> = Readonly<{
  text: string;
  value: Enum;
  readOnly?: boolean;
  onClick?: () => void;
}>;

export function SettingsRadio<Enum>({
  value,
  options,
  onChange,
}: {
  value: Enum;
  options: ReadonlyArray<SettingsRadioOptionType<Enum>>;
  onChange: (value: Enum) => void;
}): JSX.Element {
  const htmlIds = useMemo(() => {
    return Array.from({ length: options.length }, () => uuid());
  }, [options.length]);

  return (
    <div className="Preferences__padding">
      {options.map(({ text, value: optionValue, readOnly, onClick }, i) => {
        const htmlId = htmlIds[i];
        return (
          <label
            className={classNames('Preferences__settings-radio__label', {
              'Preferences__settings-radio__label--readonly': readOnly,
            })}
            key={htmlId}
            htmlFor={htmlId}
          >
            <CircleCheckbox
              isRadio
              variant={CircleCheckboxVariant.Small}
              id={htmlId}
              checked={value === optionValue}
              onClick={onClick}
              onChange={readOnly ? noop : () => onChange(optionValue)}
            />
            {text}
          </label>
        );
      })}
    </div>
  );
}
