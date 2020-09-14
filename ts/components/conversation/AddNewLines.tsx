import React from 'react';

import { RenderTextCallbackType } from '../../types/Util';

export interface Props {
  text: string;
  /** Allows you to customize now non-newlines are rendered. Simplest is just a <span>. */
  renderNonNewLine?: RenderTextCallbackType;
}

export class AddNewLines extends React.Component<Props> {
  public static defaultProps: Partial<Props> = {
    renderNonNewLine: ({ text }) => text,
  };

  public render():
    | JSX.Element
    | string
    | null
    | Array<JSX.Element | string | null> {
    const { text, renderNonNewLine } = this.props;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results: Array<any> = [];
    const FIND_NEWLINES = /\n/g;

    // We have to do this, because renderNonNewLine is not required in our Props object,
    //  but it is always provided via defaultProps.
    if (!renderNonNewLine) {
      return null;
    }

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
