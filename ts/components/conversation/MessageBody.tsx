import React from 'react';

import { getSizeClass, SizeClassType } from '../../util/emoji';
import { Emojify } from './Emojify';
import { AddNewLines } from './AddNewLines';
import { AddMentions } from './AddMentions';
import { Linkify } from './Linkify';

import { RenderTextCallbackType } from '../../types/Util';

interface Props {
  text: string;
  /** If set, all emoji will be the same size. Otherwise, just one emoji will be large. */
  disableJumbomoji?: boolean;
  /** If set, links will be left alone instead of turned into clickable `<a>` tags. */
  disableLinks?: boolean;
  isGroup?: boolean;
  convoId: string;
}

const renderMentions: RenderTextCallbackType = ({ text, key, convoId }) => (
  <AddMentions key={key} text={text} convoId={convoId || ''} />
);

const renderDefault: RenderTextCallbackType = ({ text }) => text;

const renderNewLines: RenderTextCallbackType = ({
  text: textWithNewLines,
  key,
  isGroup,
  convoId,
}) => {
  const renderOther = isGroup ? renderMentions : renderDefault;

  return (
    <AddNewLines
      key={key}
      text={textWithNewLines}
      renderNonNewLine={renderOther}
      convoId={convoId}
    />
  );
};

const renderEmoji = ({
  text,
  key,
  sizeClass,
  renderNonEmoji,
  isGroup,
  convoId,
}: {
  text: string;
  key: number;
  sizeClass?: SizeClassType;
  renderNonEmoji: RenderTextCallbackType;
  isGroup?: boolean;
  convoId?: string;
}) => (
  <Emojify
    key={key}
    text={text}
    sizeClass={sizeClass}
    renderNonEmoji={renderNonEmoji}
    isGroup={isGroup}
    convoId={convoId}
  />
);

/**
 * This component makes it very easy to use all three of our message formatting
 * components: `Emojify`, `Linkify`, and `AddNewLines`. Because each of them is fully
 * configurable with their `renderXXX` props, this component will assemble all three of
 * them for you.
 */
export class MessageBody extends React.Component<Props> {
  public static defaultProps: Partial<Props> = {
    isGroup: false,
  };

  public renderJsxSelectable(jsx: JSX.Element): JSX.Element {
    return <span className="text-selectable">{jsx}</span>;
  }

  public render() {
    const { text, disableJumbomoji, disableLinks, isGroup, convoId } = this.props;
    const sizeClass = disableJumbomoji ? undefined : getSizeClass(text);

    if (disableLinks) {
      return this.renderJsxSelectable(
        renderEmoji({
          text,
          sizeClass,
          key: 0,
          renderNonEmoji: renderNewLines,
          isGroup,
          convoId,
        })
      );
    }

    return this.renderJsxSelectable(
      <Linkify
        text={text}
        renderNonLink={({ key, text: nonLinkText }) => {
          return renderEmoji({
            text: nonLinkText,
            sizeClass,
            key,
            renderNonEmoji: renderNewLines,
            isGroup,
            convoId,
          });
        }}
      />
    );
  }
}
