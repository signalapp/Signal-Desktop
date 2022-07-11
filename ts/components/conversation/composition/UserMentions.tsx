import React from 'react';
import { SuggestionDataItem } from 'react-mentions';
import { MemberListItem } from '../../MemberListItem';

export const styleForCompositionBoxSuggestions = {
  suggestions: {
    list: {
      fontSize: 14,
      boxShadow: 'rgba(0, 0, 0, 0.24) 0px 3px 8px',
      backgroundColor: 'var(--color-cell-background)',
    },
    item: {
      height: '100%',
      paddingTop: '5px',
      paddingBottom: '5px',
      backgroundColor: 'var(--color-cell-background)',
      transition: '0.25s',

      '&focused': {
        backgroundColor: 'var(--color-clickable-hovered)',
      },
    },
  },
};

export const renderUserMentionRow = (suggestion: SuggestionDataItem) => {
  return (
    <MemberListItem
      isSelected={false}
      key={suggestion.id}
      pubkey={`${suggestion.id}`}
      disableBg={true}
      dataTestId="mentions-popup-row"
    />
  );
};

// this is dirty but we have to replace all @(xxx) by @xxx manually here
export function cleanMentions(text: string): string {
  const matches = text.match(mentionsRegex);
  let replacedMentions = text;
  (matches || []).forEach(match => {
    const replacedMention = match.substring(2, match.indexOf('\uFFD7'));
    replacedMentions = replacedMentions.replace(match, `@${replacedMention}`);
  });

  return replacedMentions;
}

export const mentionsRegex = /@\uFFD205[0-9a-f]{64}\uFFD7[^\uFFD2]+\uFFD2/gu;
