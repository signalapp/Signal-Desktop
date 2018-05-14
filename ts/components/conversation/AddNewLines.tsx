import React from 'react';

interface Props {
  text: string;
}

export class AddNewLines extends React.Component<Props, {}> {
  public render() {
    const { text } = this.props;
    const results: Array<any> = [];
    const FIND_NEWLINES = /\n/g;

    let match = FIND_NEWLINES.exec(text);
    let last = 0;
    let count = 1;

    if (!match) {
      return <span>{text}</span>;
    }

    while (match) {
      if (last < match.index) {
        const textWithNoNewline = text.slice(last, match.index);
        results.push(<span key={count++}>{textWithNoNewline}</span>);
      }

      results.push(<br key={count++} />);

      // @ts-ignore
      last = FIND_NEWLINES.lastIndex;
      match = FIND_NEWLINES.exec(text);
    }

    if (last < text.length) {
      results.push(<span key={count++}>{text.slice(last)}</span>);
    }

    return <span>{results}</span>;
  }
}
