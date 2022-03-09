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
  const results = emojiIndex.search(query);
  if (!results || !results.length) {
    return [];
  }
  return results
    .map(o => {
      const onlyBaseEmokji = o as BaseEmoji;
      return {
        id: onlyBaseEmokji.native,
        display: onlyBaseEmokji.colons,
      };
    })
    .slice(0, 8);
};
