import { isString } from 'lodash';
import React from 'react';
import { useSelector } from 'react-redux';
import { AutoSizer, Index, List, ListRowProps } from 'react-virtualized';
import styled, { CSSProperties } from 'styled-components';
import {
  DirectContactsByNameType,
  getDirectContactsByName,
  getDirectContactsCount,
} from '../../../../state/selectors/conversations';
import { leftPaneListWidth } from '../../LeftPane';
import { StyledLeftPaneList } from '../../LeftPaneList';
import { ContactRow, ContactRowBreak } from './ContactRow';
import { StyledChooseActionTitle } from './OverlayChooseAction';

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
      font-size: var(--font-size-xs);
      padding: 6px;
      height: auto;
      margin: 0px;
      line-height: 14px;
    }
  }
`;

const renderRow = (props: ListRowProps) => {
  const { index, key, style, parent } = props;

  // ugly, but it seems react-virtualized does not support very well functional components just yet
  // https://stackoverflow.com/questions/54488954/how-to-pass-prop-into-rowrender-of-react-virtualized
  const directContactsByNameWithBreaks = (parent as any).props
    .directContactsByNameWithBreaks as Array<DirectContactsByNameType | string>;
  const item = directContactsByNameWithBreaks?.[index];
  if (!item) {
    return null;
  }

  if (isString(item)) {
    return <ContactRowBreak style={style as CSSProperties} key={key} char={item} />;
  }

  return <ContactRow style={style as CSSProperties} key={key} {...item} />;
};

const unknownSection = 'unknown';

const ContactListItemSection = () => {
  const directContactsByName = useSelector(getDirectContactsByName);

  if (!directContactsByName) {
    return null;
  }

  // add a break wherever needed
  let currentChar = '';
  // if the item is a string we consider it to be a break of that string
  const directContactsByNameWithBreaks: Array<DirectContactsByNameType | string> = [];
  directContactsByName.forEach(m => {
    if (m.displayName && m.displayName[0] !== currentChar) {
      currentChar = m.displayName[0];
      directContactsByNameWithBreaks.push(currentChar.toUpperCase());
    } else if (!m.displayName && currentChar !== unknownSection) {
      currentChar = unknownSection;
      directContactsByNameWithBreaks.push(window.i18n('unknown'));
    }
    directContactsByNameWithBreaks.push(m);
  });

  const length = Number(directContactsByNameWithBreaks.length);

  return (
    <StyledLeftPaneList key={0} style={{ width: '100%' }}>
      <AutoSizer>
        {({ height }) => {
          return (
            <List
              className="module-left-pane__virtual-list"
              height={height}
              rowCount={length}
              rowHeight={
                (params: Index) =>
                  isString(directContactsByNameWithBreaks[params.index]) ? 30 : 64 // should also be changed in `ContactRowBreak`
              }
              directContactsByNameWithBreaks={directContactsByNameWithBreaks}
              rowRenderer={renderRow}
              width={leftPaneListWidth}
              autoHeight={false}
            />
          );
        }}
      </AutoSizer>
    </StyledLeftPaneList>
  );
};

const ContactsTitle = () => {
  const contactsCount = useSelector(getDirectContactsCount);
  if (contactsCount <= 0) {
    return null;
  }

  return (
    <StyledChooseActionTitle tabIndex={0}>{window.i18n('contactsHeader')}</StyledChooseActionTitle>
  );
};

export const ContactsListWithBreaks = () => {
  return (
    <StyledContactSection>
      <ContactsTitle />
      <ContactListItemSection />
    </StyledContactSection>
  );
};
