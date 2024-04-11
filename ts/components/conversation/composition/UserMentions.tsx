import React from 'react';
import { SuggestionDataItem } from 'react-mentions';
import { HTMLDirection } from '../../../util/i18n';
import { MemberListItem } from '../../MemberListItem';

const listRTLStyle = { position: 'absolute', bottom: '0px', right: '100%' };

export const styleForCompositionBoxSuggestions = (dir: HTMLDirection = 'ltr') => {
  const styles = {
    suggestions: {
      list: {
        fontSize: 14,
        boxShadow: 'var(--suggestions-shadow)',
        backgroundColor: 'var(--suggestions-background-color)',
        color: 'var(--suggestions-text-color)',
        dir,
      },
      item: {
        height: '100%',
        paddingTop: '5px',
        paddingBottom: '5px',
        backgroundColor: 'var(--suggestions-background-color)',
        color: 'var(--suggestions-text-color)',
        transition: 'var(--default-duration)',

        '&focused': {
          backgroundColor: 'var(--suggestions-background-hover-color)',
        },
      },
    },
  };

  if (dir === 'rtl') {
    styles.suggestions.list = { ...styles.suggestions.list, ...listRTLStyle };
  }

  return styles;
};

export const renderUserMentionRow = (suggestion: SuggestionDataItem) => {
  return (
    <MemberListItem
      isSelected={false}
      key={suggestion.id}
      pubkey={`${suggestion.id}`}
      inMentions={true}
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

export const mentionsRegex = /@\uFFD2[0-1]5[0-9a-f]{64}\uFFD7[^\uFFD2]+\uFFD2/gu;
