import React from 'react';

import { getSizeClass, SizeClassType } from '../../util/emoji';
import { Emojify } from './Emojify';
import { AddNewLines } from './AddNewLines';
import { AddMentions } from './AddMentions';
import { Linkify } from './Linkify';

import { LocalizerType, RenderTextCallbackType } from '../../types/Util';

interface Props {
  text: string;
  isRss?: boolean;
  textPending?: boolean;
  /** If set, all emoji will be the same size. Otherwise, just one emoji will be large. */
  disableJumbomoji?: boolean;
  /** If set, links will be left alone instead of turned into clickable `<a>` tags. */
  disableLinks?: boolean;
  isGroup?: boolean;
  i18n: LocalizerType;
  convoId: string;
}

const renderMentions: RenderTextCallbackType = ({ text, key, convoId }) => (
  <AddMentions key={key} text={text} convoId={convoId} />
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
  i18n,
  text,
  key,
  sizeClass,
  renderNonEmoji,
  isGroup,
  convoId,
}: {
  i18n: LocalizerType;
  text: string;
  key: number;
  sizeClass?: SizeClassType;
  renderNonEmoji: RenderTextCallbackType;
  isGroup?: boolean;
  convoId?: string;
}) => (
  <Emojify
    i18n={i18n}
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

  public addDownloading(jsx: JSX.Element): JSX.Element {
    const { i18n, textPending } = this.props;

    return (
      <span className="text-selectable">
        {jsx}
        {textPending ? (
          <span className="module-message-body__highlight">
            {' '}
            {i18n('downloading')}
          </span>
        ) : null}
      </span>
    );
  }

  public render() {
    const {
      text,
      textPending,
      disableJumbomoji,
      disableLinks,
      isRss,
      i18n,
      isGroup,
      convoId,
    } = this.props;
    const sizeClass = disableJumbomoji ? undefined : getSizeClass(text);
    const textWithPending = textPending ? `${text}...` : text;

    if (disableLinks) {
      return this.addDownloading(
        renderEmoji({
          i18n,
          text: textWithPending,
          sizeClass,
          key: 0,
          renderNonEmoji: renderNewLines,
          isGroup,
          convoId,
        })
      );
    }

    return this.addDownloading(
      <Linkify
        text={textWithPending}
        isRss={isRss}
        renderNonLink={({ key, text: nonLinkText }) => {
          return renderEmoji({
            i18n,
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
