// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { FunctionComponent } from 'react';
import React from 'react';
import type { RenderTextCallbackType } from '../types/Util';
import { AddNewLines } from './conversation/AddNewLines';
import { Emojify } from './conversation/Emojify';
import { Linkify } from './conversation/Linkify';

type PropsType = {
  text: string;
};

const renderNonLink: RenderTextCallbackType = ({ key, text }) => (
  <Emojify key={key} text={text} />
);

const renderNonNewLine: RenderTextCallbackType = ({ key, text }) => (
  <Linkify key={key} text={text} renderNonLink={renderNonLink} />
);

export const GroupDescriptionText: FunctionComponent<PropsType> = ({
  text,
}) => <AddNewLines text={text} renderNonNewLine={renderNonNewLine} />;
