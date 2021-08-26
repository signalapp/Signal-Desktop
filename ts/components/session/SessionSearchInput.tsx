import React from 'react';
import { useSelector } from 'react-redux';
import { getConversationsCount } from '../../state/selectors/conversations';
import { SessionIconButton, SessionIconSize, SessionIconType } from './icon';

interface Props {
  searchString: string;
  onChange: any;
  placeholder: string;
}

export const SessionSearchInput = (props: Props) => {
  const { searchString, onChange, placeholder } = props;

  const convoCount = useSelector(getConversationsCount);

  // just after onboard we only have a conversation with ourself
  if (convoCount <= 1) {
    return null;
  }

  return (
    <div className="session-search-input">
      <SessionIconButton iconSize={SessionIconSize.Medium} iconType={SessionIconType.Search} />
      <input
        value={searchString}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
};
