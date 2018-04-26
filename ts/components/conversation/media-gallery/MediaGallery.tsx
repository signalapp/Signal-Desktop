/**
 * @prettier
 */
import React from 'react';

import moment from 'moment';

import { AttachmentSection } from './AttachmentSection';
import { AttachmentType } from './types/AttachmentType';
import { groupMessagesByDate } from './groupMessagesByDate';
import { ItemClickEvent } from './types/ItemClickEvent';
import { Message } from './types/Message';

interface Props {
  documents: Array<Message>;
  i18n: (key: string, values?: Array<string>) => string;
  media: Array<Message>;
  onItemClick?: (event: ItemClickEvent) => void;
}

interface State {
  selectedTab: AttachmentType;
}

const MONTH_FORMAT = 'MMMM YYYY';
const COLOR_GRAY = '#f3f3f3';

const tabStyle = {
  width: '100%',
  backgroundColor: COLOR_GRAY,
  padding: 20,
  textAlign: 'center',
};

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    flexGrow: 1,
    width: '100%',
    height: '100%',
  } as React.CSSProperties,
  tabContainer: {
    display: 'flex',
    flexGrow: 0,
    flexShrink: 0,
    cursor: 'pointer',
    width: '100%',
  },
  tab: {
    default: tabStyle,
    active: {
      ...tabStyle,
      borderBottom: '2px solid #08f',
    },
  },
  contentContainer: {
    display: 'flex',
    flexGrow: 1,
    overflowY: 'auto',
    padding: 20,
  } as React.CSSProperties,
  sectionContainer: {
    display: 'flex',
    flexGrow: 1,
    flexDirection: 'column',
  } as React.CSSProperties,
};

interface TabSelectEvent {
  type: AttachmentType;
}

const Tab = ({
  isSelected,
  label,
  onSelect,
  type,
}: {
  isSelected: boolean;
  label: string;
  onSelect?: (event: TabSelectEvent) => void;
  type: AttachmentType;
}) => {
  const handleClick = onSelect ? () => onSelect({ type }) : undefined;

  return (
    <div
      style={isSelected ? styles.tab.active : styles.tab.default}
      onClick={handleClick}
    >
      {label}
    </div>
  );
};

export class MediaGallery extends React.Component<Props, State> {
  public state: State = {
    selectedTab: 'media',
  };

  public render() {
    const { selectedTab } = this.state;

    return (
      <div style={styles.container}>
        <div style={styles.tabContainer}>
          <Tab
            label="Media"
            type="media"
            isSelected={selectedTab === 'media'}
            onSelect={this.handleTabSelect}
          />
          <Tab
            label="Documents"
            type="documents"
            isSelected={selectedTab === 'documents'}
            onSelect={this.handleTabSelect}
          />
        </div>
        <div style={styles.contentContainer}>{this.renderSections()}</div>
      </div>
    );
  }

  private handleTabSelect = (event: TabSelectEvent): void => {
    this.setState({ selectedTab: event.type });
  };

  private renderSections() {
    const { i18n, media, documents, onItemClick } = this.props;
    const { selectedTab } = this.state;

    const messages = selectedTab === 'media' ? media : documents;
    const type = selectedTab;

    if (!messages || messages.length === 0) {
      return null;
    }

    const now = Date.now();
    const sections = groupMessagesByDate(now, messages).map(section => {
      const first = section.messages[0];
      const date = moment(first.received_at);
      const header =
        section.type === 'yearMonth'
          ? date.format(MONTH_FORMAT)
          : i18n(section.type);
      return (
        <AttachmentSection
          key={header}
          header={header}
          i18n={i18n}
          type={type}
          messages={section.messages}
          onItemClick={onItemClick}
        />
      );
    });

    return <div style={styles.sectionContainer}>{sections}</div>;
  }
}
