import React from 'react';
import { RenderTextCallbackType } from '../../../../types/Util';
import { getEmojiSizeClass, SizeClassType } from '../../../../util/emoji';
import { AddMentions } from '../../AddMentions';
import { AddNewLines } from '../../AddNewLines';
import { Emojify } from '../../Emojify';
import { Linkify } from '../../Linkify';

type Props = {
  text: string;
  /** If set, all emoji will be the same size. Otherwise, just one emoji will be large. */
  disableJumbomoji: boolean;
  /** If set, links will be left alone instead of turned into clickable `<a>` tags. */
  disableLinks: boolean;
};

const renderMentions: RenderTextCallbackType = ({ text, key }) => (
  <AddMentions key={key} text={text} />
);

export const renderTextDefault: RenderTextCallbackType = ({ text }) => text;

const renderNewLines: RenderTextCallbackType = ({ text: textWithNewLines, key, isGroup }) => {
  const renderOther = isGroup ? renderMentions : renderTextDefault;

  return <AddNewLines key={key} text={textWithNewLines} renderNonNewLine={renderOther} />;
};

const renderEmoji = ({
  text,
  key,
  sizeClass,
  renderNonEmoji,
}: {
  text: string;
  key: number;
  sizeClass: SizeClassType;
  renderNonEmoji: RenderTextCallbackType;
}) => <Emojify key={key} text={text} sizeClass={sizeClass} renderNonEmoji={renderNonEmoji} />;

/**
 * This component makes it very easy to use all three of our message formatting
 * components: `Emojify`, `Linkify`, and `AddNewLines`. Because each of them is fully
 * configurable with their `renderXXX` props, this component will assemble all three of
 * them for you.
 */

const JsxSelectable = (jsx: JSX.Element): JSX.Element => {
  return (
    <span
      className="text-selectable"
      onDragStart={(e: any) => {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }}
    >
      {jsx}
    </span>
  );
};
export const MessageBody = (props: Props) => {
  const { text, disableJumbomoji, disableLinks } = props;
  const sizeClass: SizeClassType = disableJumbomoji ? 'default' : getEmojiSizeClass(text);

  if (disableLinks) {
    return JsxSelectable(
      renderEmoji({
        text,
        sizeClass,
        key: 0,
        renderNonEmoji: renderNewLines,
      })
    );
  }

  if (text && text.startsWith('```') && text.endsWith('```')) {
    const length = text.length;
    return <pre className="text-selectable">{text.substring(4, length - 3)}</pre>;
  }

  return JsxSelectable(
    <Linkify
      text={text}
      renderNonLink={({ key, text: nonLinkText }) => {
        return renderEmoji({
          text: nonLinkText,
          sizeClass,
          key,
          renderNonEmoji: renderNewLines,
        });
      }}
    />
  );
};
