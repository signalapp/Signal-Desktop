import React from 'react';

import classnames from 'classnames';
import is from '@sindresorhus/is';

import {
  findImage,
  getRegex,
  getReplacementData,
  getTitle,
} from '../../util/emoji';
import { AddNewLines } from './AddNewLines';

// Some of this logic taken from emoji-js/replacement
function getImageTag({
  match,
  sizeClass,
  key,
}: {
  match: any;
  sizeClass: string | undefined;
  key: string | number;
}) {
  const result = getReplacementData(match[0], match[1], match[2]);

  if (is.string(result)) {
    return <span key={key}>{match[0]}</span>;
  }

  const img = findImage(result.value, result.variation);
  const title = getTitle(result.value);

  return (
    <img
      key={key}
      src={img.path}
      className={classnames('emoji', sizeClass)}
      data-codepoints={img.full_idx}
      title={`:${title}:`}
    />
  );
}

interface Props {
  text: string;
  sizeClass?: string;
}

export class Emojify extends React.Component<Props, {}> {
  public render() {
    const { text, sizeClass } = this.props;
    const results: Array<any> = [];
    const regex = getRegex();

    let match = regex.exec(text);
    let last = 0;
    let count = 1;

    if (!match) {
      return <AddNewLines text={text} />;
    }

    while (match) {
      if (last < match.index) {
        const textWithNoEmoji = text.slice(last, match.index);
        results.push(<AddNewLines key={count++} text={textWithNoEmoji} />);
      }

      results.push(getImageTag({ match, sizeClass, key: count++ }));

      last = regex.lastIndex;
      match = regex.exec(text);
    }

    if (last < text.length) {
      results.push(<AddNewLines key={count++} text={text.slice(last)} />);
    }

    return <span>{results}</span>;
  }
}
