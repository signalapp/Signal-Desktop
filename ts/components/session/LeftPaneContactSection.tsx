import React from 'react';

import { MemoConversationListItemWithDetails } from '../ConversationListItem';
import { RowRendererParamsType } from '../LeftPane';
import { AutoSizer, List } from 'react-virtualized';
import { LeftPaneSectionHeader } from './LeftPaneSectionHeader';
import { useSelector } from 'react-redux';
import { getDirectContacts, getLeftPaneLists } from '../../state/selectors/conversations';
import { isSearching } from '../../state/selectors/search';

const renderRow = ({ index, key, style }: RowRendererParamsType): JSX.Element | undefined => {
  const showSearch = useSelector(isSearching);

  const lists = showSearch ? undefined : useSelector(getLeftPaneLists);

  const directContacts = lists?.contacts || [];
  const item = directContacts[index];

  return <MemoConversationListItemWithDetails style={style} key={key} {...item} />;
};

const ContactListItemSection = () => {
  const directContacts = useSelector(getDirectContacts);

  if (!directContacts) {
    return null;
  }
  const length = Number(directContacts.length);

  return (
    <div className="module-left-pane__list" key={0}>
      <AutoSizer>
        {({ height, width }) => (
          <List
            className="module-left-pane__virtual-list"
            height={height}
            directContacts={directContacts} // needed for change in props refresh
            rowCount={length}
            rowHeight={64}
            rowRenderer={renderRow}
            width={width}
            autoHeight={false}
          />
        )}
      </AutoSizer>
    </div>
  );
};

export const LeftPaneContactSection = () => {
  debugger;
  return (
    <div className="left-pane-contact-section">
      <LeftPaneSectionHeader label={window.i18n('contactsHeader')} />
      <div className="left-pane-contact-content">
        <ContactListItemSection />
      </div>
    </div>
  );
};
