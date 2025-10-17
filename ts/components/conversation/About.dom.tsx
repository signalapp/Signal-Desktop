// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { Emojify } from './Emojify.dom.js';

export type PropsType = {
  className?: string;
  text?: string;
};

export function About({
  className = 'module-about__text',
  text,
}: PropsType): JSX.Element | null {
  if (!text) {
    return null;
  }

  return (
    <span className={className} dir="auto">
      <Emojify text={text || ''} />
    </span>
  );
}
