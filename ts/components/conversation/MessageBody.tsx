import React from 'react';

import { getSizeClass } from '../../util/emoji';
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

const renderLinks: RenderTextCallback = ({ text: textWithLinks, key }) => (
  <Linkify key={key} text={textWithLinks} renderNonLink={renderNewLines} />
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
    const sizeClass = disableJumbomoji ? '' : getSizeClass(text);

    return (
      <Emojify
        text={text}
        sizeClass={sizeClass}
        renderNonEmoji={disableLinks ? renderNewLines : renderLinks}
        i18n={i18n}
      />
    );
  }
}
