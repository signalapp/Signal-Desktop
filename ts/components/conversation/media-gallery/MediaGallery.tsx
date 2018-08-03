import React from 'react';
import classNames from 'classnames';

import moment from 'moment';

import { AttachmentSection } from './AttachmentSection';
import { AttachmentType } from './types/AttachmentType';
import { EmptyState } from './EmptyState';
import { groupMessagesByDate } from './groupMessagesByDate';
import { ItemClickEvent } from './types/ItemClickEvent';
import { Message } from './types/Message';
import { missingCaseError } from '../../../util/missingCaseError';
import { Localizer } from '../../../types/Util';

interface Props {
  documents: Array<Message>;
  i18n: Localizer;
  media: Array<Message>;
  onItemClick?: (event: ItemClickEvent) => void;
}

interface State {
  selectedTab: AttachmentType;
}

const MONTH_FORMAT = 'MMMM YYYY';

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
  const handleClick = onSelect
    ? () => {
        onSelect({ type });
      }
    : undefined;

  return (
    <div
      className={classNames(
        'module-media-gallery__tab',
        isSelected ? 'module-media-gallery__tab--active' : null
      )}
      onClick={handleClick}
      role="tab"
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
      <div className="module-media-gallery">
        <div className="module-media-gallery__tab-container">
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
        <div className="module-media-gallery__content">
          {this.renderSections()}
        </div>
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
      const label = (() => {
        switch (type) {
          case 'media':
            return i18n('mediaEmptyState');

          case 'documents':
            return i18n('documentsEmptyState');

          default:
            throw missingCaseError(type);
        }
      })();

      return <EmptyState data-test="EmptyState" label={label} />;
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

    return <div className="module-media-gallery__sections">{sections}</div>;
  }
}
