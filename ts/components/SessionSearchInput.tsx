import { debounce } from 'lodash';
import React, { Dispatch, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import styled from 'styled-components';
import { clearSearch, search, updateSearchTerm } from '../state/ducks/search';
import { getConversationsCount } from '../state/selectors/conversations';
import { getOverlayMode } from '../state/selectors/section';
import { cleanSearchTerm } from '../util/cleanSearchTerm';
import { SessionIconButton } from './icon';

const StyledSearchInput = styled.div`
  height: var(--search-input-height);
  width: 100%;
  margin-inline-end: 1px;
  margin-bottom: 10px;
  display: inline-flex;
  flex-shrink: 0;

  .session-icon-button {
    margin: auto 10px;
  }
`;

const StyledInput = styled.input`
  width: inherit;
  height: inherit;
  border: none;
  flex-grow: 1;
  font-size: var(--font-size-sm);
  font-family: var(--font-default);
  text-overflow: ellipsis;
  background: none;
  color: var(--color-text);

  &:focus {
    outline: none !important;
  }
`;

const doTheSearch = (dispatch: Dispatch<any>, cleanedTerm: string) => {
  dispatch(search(cleanedTerm));
};

const debouncedSearch = debounce(doTheSearch, 50);

function updateSearch(dispatch: Dispatch<any>, searchTerm: string) {
  if (!searchTerm) {
    dispatch(clearSearch());
    return;
  }

  // this updates our current state and text field.
  dispatch(updateSearchTerm(searchTerm));

  if (searchTerm.length < 2) {
    return;
  }
  // this effectively trigger a search
  const cleanedTerm = cleanSearchTerm(searchTerm);
  if (!cleanedTerm) {
    return;
  }

  debouncedSearch(dispatch, searchTerm);
}
export const SessionSearchInput = () => {
  const [currentSearchTerm, setCurrentSearchTerm] = useState('');
  const dispatch = useDispatch();
  const isGroupCreationSearch = useSelector(getOverlayMode) === 'closed-group';
  const convoCount = useSelector(getConversationsCount);

  // just after onboard we only have a conversation with ourself
  if (convoCount <= 1) {
    return null;
  }

  const placeholder = isGroupCreationSearch
    ? window.i18n('searchForContactsOnly')
    : window.i18n('searchFor...');

  return (
    <StyledSearchInput>
      <SessionIconButton iconSize="medium" iconType="search" />
      <StyledInput
        value={currentSearchTerm}
        onChange={e => {
          const inputValue = e.target.value;
          setCurrentSearchTerm(inputValue);
          updateSearch(dispatch, inputValue);
        }}
        placeholder={placeholder}
      />
      {Boolean(currentSearchTerm.length) && (
        <SessionIconButton
          iconSize="tiny"
          iconType="exit"
          onClick={() => {
            setCurrentSearchTerm('');
            dispatch(clearSearch());
          }}
        />
      )}
    </StyledSearchInput>
  );
};
