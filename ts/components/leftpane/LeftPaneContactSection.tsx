import React from 'react';

import { MemoConversationListItemWithDetails } from './conversation-list-item/ConversationListItem';
import { AutoSizer, List } from 'react-virtualized';
import { LeftPaneSectionHeader } from './LeftPaneSectionHeader';
import { useSelector } from 'react-redux';
import { getDirectContacts } from '../../state/selectors/conversations';
import { RowRendererParamsType } from './LeftPane';

const renderRow = (props: RowRendererParamsType) => {
  const { index, key, style } = props;

  const directContacts = (props.parent as any)?.props?.directContacts || [];

  const item = directContacts?.[index];

  if (!item) {
    return null;
  }

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
  return (
    <div className="left-pane-contact-section">
      <LeftPaneSectionHeader />
      <div className="left-pane-contact-content">
        <ContactListItemSection />
      </div>
    </div>
  );
};
