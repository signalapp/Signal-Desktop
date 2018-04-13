/**
 * @prettier
 */
import React from 'react';

import moment from 'moment';

import { AttachmentListSection } from './AttachmentListSection';
import { groupMessagesByDate } from './groupMessagesByDate';
import { Message } from './propTypes/Message';

type AttachmentType = 'media' | 'documents';

interface Props {
  documents: Array<Message>;
  i18n: (key: string, values?: Array<string>) => string;
  media: Array<Message>;
}

interface State {
  selectedTab: AttachmentType;
}

const MONTH_FORMAT = 'MMMM YYYY';
const COLOR_GREY = '#f3f3f3';

const tabStyle = {
  width: '100%',
  backgroundColor: COLOR_GREY,
  padding: 20,
  textAlign: 'center',
};

const styles = {
  tabContainer: {
    cursor: 'pointer',
    display: 'flex',
    width: '100%',
  },
  tab: {
    default: tabStyle,
    active: {
      ...tabStyle,
      borderBottom: '2px solid #08f',
    },
  },
  attachmentsContainer: {
    padding: 20,
  },
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
      <div>
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
        <div style={styles.attachmentsContainer}>{this.renderSections()}</div>
      </div>
    );
  }

  private handleTabSelect = (event: TabSelectEvent): void => {
    this.setState({ selectedTab: event.type });
  };

  private renderSections() {
    const { i18n, media, documents } = this.props;
    const { selectedTab } = this.state;

    const messages = selectedTab === 'media' ? media : documents;
    const type = selectedTab;

    if (!messages || messages.length === 0) {
      // return <LoadingIndicator />;
      return null;
    }

    const now = Date.now();
    const sections = groupMessagesByDate(now, messages);
    return sections.map(section => {
      const first = section.messages[0];
      const date = moment(first.received_at);
      const header =
        section.type === 'yearMonth'
          ? date.format(MONTH_FORMAT)
          : i18n(section.type);
      return (
        <AttachmentListSection
          key={header}
          header={header}
          i18n={i18n}
          type={type}
          messages={section.messages}
        />
      );
    });
  }
}
