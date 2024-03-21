import { isString } from 'lodash';
import React from 'react';
import { useSelector } from 'react-redux';
import { AutoSizer, List } from 'react-virtualized';
import styled, { CSSProperties } from 'styled-components';

import { ConversationListItem } from '../leftpane/conversation-list-item/ConversationListItem';
import { MessageSearchResult } from './MessageSearchResults';

import {
  SearchResultsMergedListItem,
  getHasSearchResults,
  getSearchResultsList,
  getSearchTerm,
} from '../../state/selectors/search';

const StyledSeparatorSection = styled.div`
  height: 36px;
  line-height: 36px;

  margin-inline-start: 16px;

  color: var(--text-secondary-color);

  font-size: var(--font-size-sm);
  font-weight: 400;
  letter-spacing: 0;
`;

const SearchResultsContainer = styled.div`
  overflow-y: auto;
  max-height: 100%;
  color: var(--text-secondary-color);
  flex-grow: 1;
  width: -webkit-fill-available;
`;
const NoResults = styled.div`
  margin-top: 27px;
  width: 100%;
  text-align: center;
`;

const SectionHeader = ({ title, style }: { title: string; style: CSSProperties }) => {
  return <StyledSeparatorSection style={style}>{title}</StyledSeparatorSection>;
};

function isContact(item: SearchResultsMergedListItem): item is { contactConvoId: string } {
  return (item as any).contactConvoId !== undefined;
}

const VirtualizedList = () => {
  const searchResultList = useSelector(getSearchResultsList);
  return (
    <AutoSizer>
      {({ height, width }) => (
        <List
          height={height}
          rowCount={searchResultList.length}
          rowHeight={rowPos => {
            return isString(searchResultList[rowPos.index]) ? 36 : 64;
          }}
          rowRenderer={({ index, key, style }) => {
            const row = searchResultList[index];
            if (!row) {
              return null;
            }
            if (isString(row)) {
              return <SectionHeader title={row} style={style as CSSProperties} key={key} />;
            }
            if (isContact(row)) {
              return (
                <ConversationListItem conversationId={row.contactConvoId} style={style} key={key} />
              );
            }
            return <MessageSearchResult style={style as CSSProperties} key={key} {...row} />;
          }}
          width={width}
          autoHeight={false}
        />
      )}
    </AutoSizer>
  );
};

export const SearchResults = () => {
  const searchTerm = useSelector(getSearchTerm);
  const hasSearchResults = useSelector(getHasSearchResults);

  return (
    <SearchResultsContainer>
      {!hasSearchResults ? (
        <NoResults>{window.i18n('noSearchResults', [searchTerm])}</NoResults>
      ) : (
        <VirtualizedList />
      )}
    </SearchResultsContainer>
  );
};
