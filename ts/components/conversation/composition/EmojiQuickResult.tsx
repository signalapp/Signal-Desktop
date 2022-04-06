import React from 'react';
import { SuggestionDataItem } from 'react-mentions';
import styled from 'styled-components';
import { BaseEmoji, emojiIndex } from 'emoji-mart';

const EmojiQuickResult = styled.span`
  width: 100%;
  padding-inline-end: 20px;
  padding-inline-start: 10px;
`;
const EmojiQuickResultIcon = styled.span`
  padding-inline-end: 20px;
  padding-inline-start: 10px;
  font-size: 1.4em;
`;
const EmojiQuickResultText = styled.span``;

export const renderEmojiQuickResultRow = (suggestion: SuggestionDataItem) => {
  return (
    <EmojiQuickResult>
      <EmojiQuickResultIcon>{suggestion.id}</EmojiQuickResultIcon>
      <EmojiQuickResultText>{suggestion.display}</EmojiQuickResultText>
    </EmojiQuickResult>
  );
};

export const searchEmojiForQuery = (query: string): Array<SuggestionDataItem> => {
  if (query.length === 0 || !emojiIndex) {
    return [];
  }
  const results1 = emojiIndex.search(`:${query}`) || [];
  const results2 = emojiIndex.search(query) || [];
  const results = [...new Set(results1.concat(results2))];
  if (!results || !results.length) {
    return [];
  }
  return results
    .map(o => {
      const onlyBaseEmoji = o as BaseEmoji;
      return {
        id: onlyBaseEmoji.native,
        display: onlyBaseEmoji.colons,
      };
    })
    .slice(0, 8);
};
