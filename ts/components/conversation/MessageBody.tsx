import React from 'react';

import { getSizeClass, SizeClassType } from '../../util/emoji';
import { Emojify } from './Emojify';
import { AddNewLines } from './AddNewLines';
import { Linkify } from './Linkify';

import { Localizer, RenderTextCallback } from '../../types/Util';

interface Props {
  text: string;
  /** If set, all emoji will be the same size. Otherwise, just one emoji will be large. */
  disableJumbomoji?: boolean;
  /** If set, links will be left alone instead of turned into clickable `<a>` tags. */
  disableLinks?: boolean;
  i18n: Localizer;
}

const renderNewLines: RenderTextCallback = ({
  text: textWithNewLines,
  key,
}) => <AddNewLines key={key} text={textWithNewLines} />;

const renderEmoji = ({
  i18n,
  text,
  key,
  sizeClass,
  renderNonEmoji,
}: {
  i18n: Localizer;
  text: string;
  key: number;
  sizeClass?: SizeClassType;
  renderNonEmoji: RenderTextCallback;
}) => (
  <Emojify
    i18n={i18n}
    key={key}
    text={text}
    sizeClass={sizeClass}
    renderNonEmoji={renderNonEmoji}
  />
);

/**
 * This component makes it very easy to use all three of our message formatting
 * components: `Emojify`, `Linkify`, and `AddNewLines`. Because each of them is fully
 * configurable with their `renderXXX` props, this component will assemble all three of
 * them for you.
 */
export class MessageBody extends React.Component<Props> {
  public render() {
    const { text, disableJumbomoji, disableLinks, i18n } = this.props;
    const sizeClass = disableJumbomoji ? undefined : getSizeClass(text);

    if (disableLinks) {
      return renderEmoji({
        i18n,
        text,
        sizeClass,
        key: 0,
        renderNonEmoji: renderNewLines,
      });
    }

    return (
      <Linkify
        text={text}
        renderNonLink={({ key, text: nonLinkText }) => {
          return renderEmoji({
            i18n,
            text: nonLinkText,
            sizeClass,
            key,
            renderNonEmoji: renderNewLines,
          });
        }}
      />
    );
  }
}
