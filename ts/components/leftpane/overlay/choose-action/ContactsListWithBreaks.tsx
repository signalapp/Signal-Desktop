import React from 'react';
import { useSelector } from 'react-redux';
import { AutoSizer, List, ListRowProps } from 'react-virtualized';
import styled from 'styled-components';
import {
  getDirectContacts,
  getDirectContactsCount,
} from '../../../../state/selectors/conversations';
import { MemoConversationListItemWithDetails } from '../../conversation-list-item/ConversationListItem';
import { StyledLeftPaneList } from '../../LeftPaneList';
import { StyledChooseActionTitle } from './OverlayChooseAction';
// tslint:disable: use-simple-attributes no-submodule-imports

const renderRow = (props: ListRowProps) => {
  const { index, key, style, parent } = props;

  // ugly, but it seems react-viurtualized do not support very well functional components just yet
  // https://stackoverflow.com/questions/54488954/how-to-pass-prop-into-rowrender-of-react-virtualized
  const directContacts = (parent as any).props.directContacts;
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
    <StyledLeftPaneList key={0} style={{ width: '100%' }}>
      <AutoSizer>
        {({ height }) => {
          return (
            <List
              className="module-left-pane__virtual-list"
              height={height}
              rowCount={length}
              rowHeight={64}
              directContacts={directContacts}
              rowRenderer={renderRow}
              width={300} // the same as session-left-pane-width
              autoHeight={false}
            />
          );
        }}
      </AutoSizer>
    </StyledLeftPaneList>
  );
};

const StyledContactSection = styled.div`
  display: flex;
  flex-direction: column;
  overflow: hidden;
  flex: 1;
  width: 100%;

  .module-conversation-list-item __header__date,
  .module-conversation-list-item __message {
    display: none;
  }

  .module-conversation-list-item __buttons {
    display: flex;

    .session-button {
      font-size: 11px;
      padding: 6px;
      height: auto;
      margin: 0px;
      line-height: 14px;
    }
  }
`;

const ContactsTitle = () => {
  const contactsCount = useSelector(getDirectContactsCount);
  if (contactsCount <= 0) {
    return null;
  }

  return <StyledChooseActionTitle>{window.i18n('contactsHeader')}</StyledChooseActionTitle>;
};

export const ContactsListWithBreaks = () => {
  return (
    <StyledContactSection>
      <ContactsTitle />
      <ContactListItemSection />
    </StyledContactSection>
  );
};
