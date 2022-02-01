import { debounce } from 'lodash';
import React, { Dispatch, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { clearSearch, search, updateSearchTerm } from '../state/ducks/search';
import { getConversationsCount } from '../state/selectors/conversations';
import { cleanSearchTerm } from '../util/cleanSearchTerm';
import { SessionIconButton } from './icon';

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

  const convoCount = useSelector(getConversationsCount);

  // just after onboard we only have a conversation with ourself
  if (convoCount <= 1) {
    return null;
  }

  return (
    <div className="session-search-input">
      <SessionIconButton iconSize="medium" iconType="search" />
      <input
        value={currentSearchTerm}
        onChange={e => {
          const inputValue = e.target.value;
          setCurrentSearchTerm(inputValue);
          updateSearch(dispatch, inputValue);
        }}
        placeholder={window.i18n('searchFor...')}
      />
      {!!currentSearchTerm.length && (
        <SessionIconButton
          iconSize="tiny"
          iconType="exit"
          onClick={() => {
            setCurrentSearchTerm('');
            dispatch(clearSearch());
          }}
        />
      )}
    </div>
  );
};
