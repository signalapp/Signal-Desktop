// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { ChangeEvent } from 'react';
import classNames from 'classnames';

export type Option = Readonly<{
  text: string;
  value: string | number;
}>;

export type PropsType = Readonly<{
  moduleClassName?: string;
  options: ReadonlyArray<Option>;
  onChange(value: string): void;
  value: string | number;
}>;

export function Select(props: PropsType): JSX.Element {
  const { moduleClassName, value, options, onChange } = props;

  const onSelectChange = (event: ChangeEvent<HTMLSelectElement>) => {
    onChange(event.target.value);
  };

  return (
    <div className={classNames(['module-select', moduleClassName])}>
      <select value={value} onChange={onSelectChange}>
        {options.map(({ text, value: optionValue }) => {
          return (
            <option value={optionValue} key={optionValue} aria-label={text}>
              {text}
            </option>
          );
        })}
      </select>
    </div>
  );
}
