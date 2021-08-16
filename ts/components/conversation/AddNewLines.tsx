import React from 'react';

import { RenderTextCallbackType } from '../../types/Util';

interface Props {
  text: string;
  /** Allows you to customize now non-newlines are rendered. Simplest is just a <span>. */
  renderNonNewLine?: RenderTextCallbackType;
  convoId: string;
}

export class AddNewLines extends React.Component<Props> {
  public static defaultProps: Partial<Props> = {
    renderNonNewLine: ({ text }) => text,
  };

  public render() {
    const { text, renderNonNewLine, convoId } = this.props;

    // We have to do this, because renderNonNewLine is not required in our Props object,
    //  but it is always provided via defaultProps.
    if (!renderNonNewLine) {
      return;
    }

    return renderNonNewLine({ text, key: 0, convoId });
  }
}
