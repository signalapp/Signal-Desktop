// Copyright 2018-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { Emojify } from './Emojify';

export type PropsType = {
  text?: string;
};

export const About = ({ text }: PropsType): JSX.Element | null => {
  if (!text) {
    return null;
  }

  return (
    <span className="module-about__text" dir="auto">
      <Emojify text={text || ''} />
    </span>
  );
};
