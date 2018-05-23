import React from 'react';

import classnames from 'classnames';
import is from '@sindresorhus/is';

// @ts-ignore
import EmojiConvertor from 'emoji-js';

import { AddNewLines } from './AddNewLines';

function getCountOfAllMatches(str: string, regex: RegExp) {
  let match = regex.exec(str);
  let count = 0;

  if (!regex.global) {
    return match ? 1 : 0;
  }

  while (match) {
    count += 1;
    match = regex.exec(str);
  }

  return count;
}

function hasNormalCharacters(str: string) {
  const noEmoji = str.replace(instance.rx_unified, '').trim();
  return noEmoji.length > 0;
}

export function getSizeClass(str: string) {
  if (hasNormalCharacters(str)) {
    return '';
  }

  const emojiCount = getCountOfAllMatches(str, instance.rx_unified);
  if (emojiCount > 8) {
    return '';
  } else if (emojiCount > 6) {
    return 'small';
  } else if (emojiCount > 4) {
    return 'medium';
  } else if (emojiCount > 2) {
    return 'large';
  } else {
    return 'jumbo';
  }
}

const VARIATION_LOOKUP: { [index: string]: string } = {
  '\uD83C\uDFFB': '1f3fb',
  '\uD83C\uDFFC': '1f3fc',
  '\uD83C\uDFFD': '1f3fd',
  '\uD83C\uDFFE': '1f3fe',
  '\uD83C\uDFFF': '1f3ff',
};

// Taken from emoji-js/replace_unified
function getEmojiReplacementData(
  m: string,
  p1: string | undefined,
  p2: string | undefined
) {
  const unified = instance.map.unified[p1];
  if (unified) {
    const variation = VARIATION_LOOKUP[p2 || ''];
    if (variation) {
      return {
        value: unified,
        variation,
      };
    }
    return {
      value: unified,
    };
  }

  const unifiedVars = instance.map.unified_vars[p1];
  if (unifiedVars) {
    return {
      value: unifiedVars[0],
      variation: unifiedVars[1],
    };
  }

  return m;
}

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
  const result = getEmojiReplacementData(match[0], match[1], match[2]);

  if (is.string(result)) {
    return <span key={key}>{match[0]}</span>;
  }

  const img = instance.find_image(result.value, result.variation);
  const title = instance.data[result.value][3][0];

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

const instance = new EmojiConvertor();
instance.init_unified();
instance.init_colons();
instance.img_sets.apple.path =
  'node_modules/emoji-datasource-apple/img/apple/64/';
instance.include_title = true;
instance.replace_mode = 'img';
instance.supports_css = false; // needed to avoid spans with background-image

interface Props {
  text: string;
  sizeClass?: string;
}

export class Emojify extends React.Component<Props, {}> {
  public render() {
    const { text, sizeClass } = this.props;
    const results: Array<any> = [];

    let match = instance.rx_unified.exec(text);
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

      last = instance.rx_unified.lastIndex;
      match = instance.rx_unified.exec(text);
    }

    if (last < text.length) {
      results.push(<AddNewLines key={count++} text={text.slice(last)} />);
    }

    return <span>{results}</span>;
  }
}
