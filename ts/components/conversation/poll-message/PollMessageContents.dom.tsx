// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { memo, useState } from 'react';
import { Checkbox } from 'radix-ui';
import { tw } from '../../../axo/tw.dom.js';
import { AxoButton } from '../../../axo/AxoButton.dom.js';
import { AxoSymbol } from '../../../axo/AxoSymbol.dom.js';
import type { DirectionType } from '../Message.dom.js';
import type { PollWithResolvedVotersType } from '../../../state/selectors/message.preload.js';
import type { LocalizerType } from '../../../types/Util.std.js';
import { PollVotesModal } from './PollVotesModal.dom.js';

function VotedCheckmark({
  isIncoming,
  i18n,
}: {
  isIncoming: boolean;
  i18n: LocalizerType;
}): JSX.Element {
  return (
    <div
      className={tw(
        'size-4 rounded-full',
        'flex items-center justify-center',
        'text-[10px]',
        isIncoming
          ? 'bg-color-fill-primary text-label-primary-on-color'
          : 'bg-label-primary-on-color text-color-fill-primary'
      )}
    >
      <AxoSymbol.InlineGlyph
        symbol="check"
        label={i18n('icu:PollMessage--YouVoted')}
      />
    </div>
  );
}

type PollCheckboxProps = {
  checked: boolean;
  onCheckedChange: (nextChecked: boolean) => void;
  isIncoming: boolean;
};

const PollCheckbox = memo((props: PollCheckboxProps) => {
  const { isIncoming } = props;

  return (
    <Checkbox.Root
      checked={props.checked}
      onCheckedChange={props.onCheckedChange}
      className={tw(
        'flex size-6 items-center justify-center rounded-full',
        'border-[1.5px]',
        'outline-0 outline-border-focused focused:outline-[2.5px]',
        'overflow-hidden',
        // Unchecked states
        'data-[state=unchecked]:bg-transparent',
        isIncoming
          ? 'data-[state=unchecked]:border-label-placeholder'
          : 'data-[state=unchecked]:border-label-primary-on-color',
        // Checked states
        isIncoming
          ? 'data-[state=checked]:border-color-fill-primary data-[state=checked]:bg-color-fill-primary'
          : 'data-[state=checked]:border-label-primary-on-color data-[state=checked]:bg-label-primary-on-color'
      )}
    >
      <Checkbox.Indicator
        className={tw(
          isIncoming ? 'text-label-primary-on-color' : 'text-color-fill-primary'
        )}
      >
        <AxoSymbol.Icon symbol="check" size={16} label={null} />
      </Checkbox.Indicator>
    </Checkbox.Root>
  );
});

PollCheckbox.displayName = 'PollCheckbox';

export type PollMessageContentsProps = {
  poll: PollWithResolvedVotersType;
  direction: DirectionType;
  i18n: LocalizerType;
  messageId: string;
  sendPollVote: (params: {
    messageId: string;
    optionIndexes: ReadonlyArray<number>;
  }) => void;
};

export function PollMessageContents({
  poll,
  direction,
  i18n,
  messageId,
  sendPollVote,
}: PollMessageContentsProps): JSX.Element {
  const [showVotesModal, setShowVotesModal] = useState(false);
  const isIncoming = direction === 'incoming';

  const totalVotes = poll.totalNumVotes;

  let pollStatusText: string;
  if (poll.terminatedAt) {
    pollStatusText = i18n('icu:PollMessage--FinalResults');
  } else if (poll.allowMultiple) {
    pollStatusText = i18n('icu:PollMessage--SelectMultiple');
  } else {
    pollStatusText = i18n('icu:PollMessage--SelectOne');
  }

  async function handlePollOptionClicked(
    index: number,
    nextChecked: boolean
  ): Promise<void> {
    const existingSelections = Array.from(
      poll.votesByOption
        .entries()
        .filter(([_, voters]) => (voters ?? []).some(v => v.isMe))
        .map(([optionIndex]) => optionIndex)
    );
    const optionIndexes = new Set<number>(existingSelections);

    if (nextChecked) {
      if (!poll.allowMultiple) {
        // Single-select: clear existing selections first
        optionIndexes.clear();
      }
      optionIndexes.add(index);
    } else {
      // Removing a selection - same for both modes
      optionIndexes.delete(index);
    }

    sendPollVote({
      messageId,
      optionIndexes: [...optionIndexes],
    });
  }

  return (
    <div
      className={tw(
        'text-start break-words whitespace-pre-wrap',
        'type-body-large',
        isIncoming ? 'text-label-primary' : 'text-label-primary-on-color',
        'min-w-[275px]',
        'mt-1'
      )}
    >
      <div className={tw('mb-1 font-semibold')}>{poll.question}</div>

      <div
        className={tw(
          'mb-4 type-body-medium font-medium',
          isIncoming ? 'text-label-secondary' : 'text-label-secondary-on-color'
        )}
      >
        {pollStatusText}
      </div>

      {/* Poll Options */}
      <div className={tw('space-y-3')}>
        {poll.options.map((option, index) => {
          const pollVoteEntries = poll.votesByOption.get(index);
          const optionVotes = pollVoteEntries?.length ?? 0;
          const percentage =
            totalVotes > 0 ? (optionVotes / totalVotes) * 100 : 0;

          const weVotedForThis = (pollVoteEntries ?? []).some(v => v.isMe);

          return (
            // eslint-disable-next-line react/no-array-index-key
            <div key={`option-${index}`} className={tw('flex gap-3')}>
              {poll.terminatedAt == null && (
                // 3px offset: type-body-large has 14px font-size and 20px line-height,
                // creating 3px space above text. This aligns checkbox with text baseline.
                <div className={tw('mt-[3px] self-start')}>
                  <PollCheckbox
                    checked={weVotedForThis}
                    onCheckedChange={next =>
                      handlePollOptionClicked(index, Boolean(next))
                    }
                    isIncoming={isIncoming}
                  />
                </div>
              )}

              <div className={tw('flex flex-1 flex-col gap-1')}>
                <div className={tw('flex items-start justify-between gap-3')}>
                  <span className={tw('type-body-large')}>{option}</span>
                  {totalVotes > 0 && (
                    <div className={tw('flex shrink-0 items-center gap-1')}>
                      {poll.terminatedAt != null && weVotedForThis && (
                        <VotedCheckmark isIncoming={isIncoming} i18n={i18n} />
                      )}
                      <span
                        className={tw(
                          'type-body-medium',
                          isIncoming
                            ? 'text-label-secondary'
                            : 'text-label-secondary-on-color'
                        )}
                        data-testid={`poll-option-${index}-votes-${optionVotes}`}
                      >
                        {optionVotes}
                      </span>
                    </div>
                  )}
                </div>

                <div
                  className={tw(
                    'relative h-2 w-full overflow-hidden rounded-full'
                  )}
                >
                  <div
                    className={tw(
                      'absolute inset-0',
                      isIncoming
                        ? 'bg-fill-secondary'
                        : 'bg-message-fill-outgoing-tertiary'
                    )}
                  />
                  {percentage > 0 && (
                    <div
                      className={tw(
                        'absolute inset-y-0 start-0 rounded-s-full',
                        isIncoming
                          ? 'bg-color-fill-primary'
                          : 'bg-label-primary-on-color'
                      )}
                      style={{ width: `${percentage}%` }}
                    />
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {totalVotes > 0 ? (
        <div className={tw('mt-4 flex justify-center scheme-light')}>
          <AxoButton.Root
            size="medium"
            variant="floating-secondary"
            onClick={() => setShowVotesModal(true)}
          >
            {i18n('icu:PollMessage__ViewVotesButton')}
          </AxoButton.Root>
        </div>
      ) : (
        <div
          className={tw(
            'mt-4 text-center type-body-medium',
            isIncoming ? 'text-label-primary' : 'text-label-primary-on-color'
          )}
        >
          {i18n('icu:PollVotesModal__noVotes')}
        </div>
      )}

      {showVotesModal && (
        <PollVotesModal
          i18n={i18n}
          poll={poll}
          onClose={() => setShowVotesModal(false)}
        />
      )}
    </div>
  );
}
