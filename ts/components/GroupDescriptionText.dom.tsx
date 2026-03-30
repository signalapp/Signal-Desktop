// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import type { RenderTextCallbackType } from '../types/Util.std.ts';
import { AddNewLines } from './conversation/AddNewLines.dom.tsx';
import { Emojify } from './conversation/Emojify.dom.tsx';
import { Linkify } from './conversation/Linkify.dom.tsx';

type PropsType = {
  text: string;
};

const renderNonLink: RenderTextCallbackType = ({ key, text }) => (
  <Emojify key={key} text={text} />
);

const renderNonNewLine: RenderTextCallbackType = ({ key, text }) => (
  <Linkify key={key} text={text} renderNonLink={renderNonLink} />
);

export function GroupDescriptionText({ text }: PropsType): React.JSX.Element {
  return (
    <div className="GroupDescriptionText">
      <AddNewLines text={text} renderNonNewLine={renderNonNewLine} />
    </div>
  );
}
