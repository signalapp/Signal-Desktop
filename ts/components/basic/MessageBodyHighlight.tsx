import styled from 'styled-components';
import { RenderTextCallbackType } from '../../types/Util';
import { SizeClassType } from '../../util/emoji';
import { AddNewLines } from '../conversation/AddNewLines';
import { Emojify } from '../conversation/Emojify';
import {
  MessageBody,
  renderTextDefault,
} from '../conversation/message/message-content/MessageBody';

const renderNewLines: RenderTextCallbackType = ({ text, key, isGroup }) => (
  <AddNewLines key={key} text={text} renderNonNewLine={renderTextDefault} isGroup={isGroup} />
);

const SnippetHighlight = styled.span`
  font-weight: bold;
  color: var(--text-primary-color);
`;

const renderEmoji = ({
  text,
  key,
  sizeClass,
  renderNonEmoji,
  isGroup,
}: {
  text: string;
  key: number;
  isGroup: boolean;
  sizeClass: SizeClassType;
  renderNonEmoji: RenderTextCallbackType;
}) => (
  <Emojify
    key={key}
    text={text}
    sizeClass={sizeClass}
    renderNonEmoji={renderNonEmoji}
    isGroup={isGroup}
  />
);

export const MessageBodyHighlight = (props: { text: string; isGroup: boolean }) => {
  const { text, isGroup } = props;
  const results: Array<JSX.Element> = [];
  // this is matching what sqlite fts5 is giving us back
  const FIND_BEGIN_END = /<<left>>(.+?)<<right>>/g;

  let match = FIND_BEGIN_END.exec(text);
  let last = 0;
  let count = 1;

  if (!match) {
    return (
      <MessageBody disableJumbomoji={true} disableLinks={true} text={text} isGroup={isGroup} />
    );
  }

  const sizeClass = 'default';

  while (match) {
    if (last < match.index) {
      const beforeText = text.slice(last, match.index);
      results.push(
        renderEmoji({
          text: beforeText,
          sizeClass,
          key: count++,
          renderNonEmoji: renderNewLines,
          isGroup,
        })
      );
    }

    const [, toHighlight] = match;
    results.push(
      <SnippetHighlight key={count++}>
        {renderEmoji({
          text: toHighlight,
          sizeClass,
          key: count++,
          renderNonEmoji: renderNewLines,
          isGroup,
        })}
      </SnippetHighlight>
    );

    last = FIND_BEGIN_END.lastIndex;
    match = FIND_BEGIN_END.exec(text);
  }

  if (last < text.length) {
    results.push(
      renderEmoji({
        text: text.slice(last),
        sizeClass,
        key: count++,
        renderNonEmoji: renderNewLines,
        isGroup,
      })
    );
  }

  return <>{results}</>;
};
