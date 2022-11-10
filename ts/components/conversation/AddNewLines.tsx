// Copyright 2018-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import type { RenderTextCallbackType } from '../../types/Util';

export type Props = {
  text: string;
  /** Allows you to customize now non-newlines are rendered. Simplest is just a <span>. */
  renderNonNewLine?: RenderTextCallbackType;
};

const defaultRenderNonNewLine: RenderTextCallbackType = ({ text }) => text;

export class AddNewLines extends React.Component<Props> {
  public override render():
    | JSX.Element
    | string
    | null
    | Array<JSX.Element | string | null> {
    const { text, renderNonNewLine = defaultRenderNonNewLine } = this.props;
    const results: Array<JSX.Element | string> = [];
    const FIND_NEWLINES = /\n/g;

    let match = FIND_NEWLINES.exec(text);
    let last = 0;
    let count = 1;

    if (!match) {
      return renderNonNewLine({ text, key: 0 });
    }

    while (match) {
      if (last < match.index) {
        const textWithNoNewline = text.slice(last, match.index);
        count += 1;
        results.push(renderNonNewLine({ text: textWithNoNewline, key: count }));
      }

      count += 1;
      results.push(<br key={count} />);

      last = FIND_NEWLINES.lastIndex;
      match = FIND_NEWLINES.exec(text);
    }

    if (last < text.length) {
      count += 1;
      results.push(renderNonNewLine({ text: text.slice(last), key: count }));
    }

    return results;
  }
}
