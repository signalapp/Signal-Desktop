import { isString } from 'lodash';

import { useSelector } from 'react-redux';
import { AutoSizer, Index, List, ListRowProps } from 'react-virtualized';
import styled, { CSSProperties } from 'styled-components';
import {
  DirectContactsByNameType,
  getContactsCount,
  getSortedContactsWithBreaks,
} from '../../../../state/selectors/conversations';
import { leftPaneListWidth } from '../../LeftPane';
import { StyledLeftPaneList } from '../../LeftPaneList';
import { StyledChooseActionTitle } from './ActionRow';
import { ContactRow, ContactRowBreak } from './ContactRow';
import { getThemeValue, pxValueToNumber } from '../../../../themes/globals';
import { SearchResultsMergedListItem } from '../../../../state/selectors/search';

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

const StyledContactsTitle = styled(StyledChooseActionTitle)`
  padding: var(--margins-xs) var(--margins-lg);
`;

const StyledContactsEmpty = styled.div`
  color: var(--text-secondary-color);
  padding: var(--margins-xs) var(--margins-lg);
`;

const renderRow = (props: ListRowProps) => {
  const { index, key, style, parent } = props;

  // ugly, but it seems react-virtualized does not support very well functional components just yet
  // https://stackoverflow.com/questions/54488954/how-to-pass-prop-into-rowrender-of-react-virtualized
  const contactsByNameWithBreaks = (parent as any).props.contactsByNameWithBreaks as Array<
    DirectContactsByNameType | string
  >;
  const item = contactsByNameWithBreaks?.[index];
  if (!item) {
    return null;
  }

  if (isString(item)) {
    return <ContactRowBreak style={style as CSSProperties} key={key} char={item} />;
  }

  return <ContactRow style={style as CSSProperties} key={key} {...item} />;
};

export function calcContactRowHeight(
  items: Array<SearchResultsMergedListItem | string | DirectContactsByNameType>,
  params: Index,
  overrides?: {
    rowHeight?: number;
    breakRowHeight?: number;
  }
) {
  return isString(items[params.index])
    ? overrides?.breakRowHeight || pxValueToNumber(getThemeValue('--contact-row-break-height'))
    : overrides?.rowHeight || pxValueToNumber(getThemeValue('--contact-row-height'));
}

const ContactListItemSection = () => {
  const contactsByNameWithBreaks = useSelector(getSortedContactsWithBreaks);

  if (!contactsByNameWithBreaks) {
    return null;
  }

  const length = Number(contactsByNameWithBreaks.length);

  return (
    <StyledLeftPaneList key={0} style={{ width: '100%' }}>
      <AutoSizer>
        {({ height }) => {
          return (
            <List
              className="module-left-pane__virtual-list"
              height={height}
              rowCount={length}
              rowHeight={params => calcContactRowHeight(contactsByNameWithBreaks, params)}
              contactsByNameWithBreaks={contactsByNameWithBreaks}
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

export const ContactsListWithBreaks = () => {
  const contactsCount = useSelector(getContactsCount);

  return (
    <StyledContactSection>
      <StyledContactsTitle tabIndex={0}>{window.i18n('contactsHeader')}</StyledContactsTitle>
      {contactsCount > 0 ? (
        <ContactListItemSection />
      ) : (
        <StyledContactsEmpty>{window.i18n('contactsNone')}</StyledContactsEmpty>
      )}
    </StyledContactSection>
  );
};
