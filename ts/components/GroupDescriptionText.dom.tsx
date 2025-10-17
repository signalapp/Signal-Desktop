// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import type { RenderTextCallbackType } from '../types/Util.std.js';
import { AddNewLines } from './conversation/AddNewLines.dom.js';
import { Emojify } from './conversation/Emojify.dom.js';
import { Linkify } from './conversation/Linkify.dom.js';

type PropsType = {
  text: string;
};

const renderNonLink: RenderTextCallbackType = ({ key, text }) => (
  <Emojify key={key} text={text} />
);

const renderNonNewLine: RenderTextCallbackType = ({ key, text }) => (
  <Linkify key={key} text={text} renderNonLink={renderNonLink} />
);

export function GroupDescriptionText({ text }: PropsType): JSX.Element {
  return <AddNewLines text={text} renderNonNewLine={renderNonNewLine} />;
}
