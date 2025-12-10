// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { useCallback, useId, useMemo, useState } from 'react';
import type { LocalizerType } from '../types/I18N.std.js';
import { AxoSymbol } from '../axo/AxoSymbol.dom.js';
import { AxoButton } from '../axo/AxoButton.dom.js';
import { AxoDialog } from '../axo/AxoDialog.dom.js';
import { CallQualitySurvey } from '../types/CallQualitySurvey.std.js';
import { tw } from '../axo/tw.dom.js';
import { missingCaseError } from '../util/missingCaseError.std.js';
import { AxoCheckbox } from '../axo/AxoCheckbox.dom.js';
import { strictAssert } from '../util/assert.std.js';
import { Tooltip, TooltipPlacement } from './Tooltip.dom.js';

import Issue = CallQualitySurvey.Issue;

enum Page {
  HOW_WAS_YOUR_CALL,
  WHAT_ISSUES_DID_YOU_HAVE,
  CONFIRM_SUBMISSION,
}

export type CallQualitySurveyDialogProps = Readonly<{
  i18n: LocalizerType;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (form: CallQualitySurvey.Form) => void;
  onViewDebugLog?: () => void;
  isSubmitting?: boolean;
}>;

export function CallQualitySurveyDialog(
  props: CallQualitySurveyDialogProps
): JSX.Element {
  const { i18n, onSubmit, onViewDebugLog, isSubmitting } = props;

  const [page, setPage] = useState(Page.HOW_WAS_YOUR_CALL);
  const [userSatisfied, setUserSatisfied] = useState<boolean | null>(null);
  const [callQualityIssues, setCallQualityIssues] = useState<
    ReadonlySet<Issue>
  >(() => new Set());
  const [additionalIssuesDescription, setAdditionalIssuesDescription] =
    useState('');
  const [userHasSeenOtherForm, setUserHasSeenOtherForm] = useState(false);
  const debugLogCheckboxId = useId();
  const otherTextareaErrorId = useId();
  const [shareDebugLog, setShareDebugLog] = useState(false);

  // Validation for the issues page
  const hasOtherIssue = callQualityIssues.has(Issue.OTHER);
  const isOtherInputValid = useMemo(() => {
    if (!hasOtherIssue) {
      return true;
    }
    return additionalIssuesDescription.trim() !== '';
  }, [hasOtherIssue, additionalIssuesDescription]);
  const canContinueFromIssuesPage =
    callQualityIssues.size > 0 && isOtherInputValid;
  const showOtherInputError = userHasSeenOtherForm && !isOtherInputValid;

  const handleSubmit = useCallback(() => {
    strictAssert(userSatisfied != null, 'userSatisfied cannot be null');

    const form: CallQualitySurvey.Form = {
      userSatisfied,
      // TODO: Only include if `!userSatisfied`
      callQualityIssues,
      // TODO: Only include if `callQualityIssues.has(Issue.OTHER)`
      additionalIssuesDescription,
      shareDebugLog,
    };

    onSubmit(form);
  }, [
    onSubmit,
    userSatisfied,
    callQualityIssues,
    additionalIssuesDescription,
    shareDebugLog,
  ]);

  return (
    <AxoDialog.Root open={props.open} onOpenChange={props.onOpenChange}>
      <AxoDialog.Content escape="cancel-is-destructive" size="md">
        {page === Page.HOW_WAS_YOUR_CALL && (
          <>
            <AxoDialog.Header>
              <AxoDialog.Title>
                {i18n('icu:CallQualitySurvey__HowWasYourCall__PageTitle')}
              </AxoDialog.Title>
              <AxoDialog.Close
                aria-label={i18n(
                  'icu:CallQualitySurvey__CloseButton__AccessibilityLabel'
                )}
              />
            </AxoDialog.Header>
            <AxoDialog.Body>
              <p className={tw('mb-3 type-body-medium text-label-primary')}>
                <AxoDialog.Description>
                  {i18n(
                    'icu:CallQualitySurvey__HowWasYourCall__PageDescription'
                  )}
                </AxoDialog.Description>
              </p>
              <div className={tw('mb-6 flex justify-center gap-10')}>
                <BigCircleButton
                  symbol="thumbsdown"
                  className={tw(
                    'bg-color-fill-destructive/10 text-color-fill-destructive group-hovered:bg-color-fill-destructive/15'
                  )}
                  onClick={() => {
                    setUserSatisfied(false);
                    setPage(Page.WHAT_ISSUES_DID_YOU_HAVE);
                  }}
                  label={i18n(
                    'icu:CallQualitySurvey__HowWasYourCall__Response__HadIssues'
                  )}
                />

                <BigCircleButton
                  symbol="thumbsup"
                  className={tw(
                    'bg-color-fill-primary/10 text-color-fill-primary group-hovered:bg-color-fill-primary/15'
                  )}
                  onClick={() => {
                    setUserSatisfied(true);
                    setPage(Page.CONFIRM_SUBMISSION);
                  }}
                  label={i18n(
                    'icu:CallQualitySurvey__HowWasYourCall__Response__Great'
                  )}
                />
              </div>
            </AxoDialog.Body>
          </>
        )}
        {page === Page.WHAT_ISSUES_DID_YOU_HAVE && (
          <>
            <AxoDialog.Header>
              <AxoDialog.Back
                aria-label={i18n(
                  'icu:CallQualitySurvey__BackButton__AccessibilityLabel'
                )}
                onClick={() => {
                  setPage(Page.HOW_WAS_YOUR_CALL);
                }}
              />
              <AxoDialog.Title>
                {i18n('icu:CallQualitySurvey__WhatIssuesDidYouHave__PageTitle')}
              </AxoDialog.Title>
              <AxoDialog.Close
                aria-label={i18n(
                  'icu:CallQualitySurvey__CloseButton__AccessibilityLabel'
                )}
              />
            </AxoDialog.Header>
            <AxoDialog.Body>
              <p className={tw('mb-3 type-body-medium text-label-primary')}>
                <AxoDialog.Description>
                  {i18n(
                    'icu:CallQualitySurvey__WhatIssuesDidYouHave__IssuesList__Heading'
                  )}
                </AxoDialog.Description>
              </p>
              <div className={tw('mb-3')}>
                <IssueSelector
                  i18n={i18n}
                  issues={callQualityIssues}
                  onIssuesChange={newIssues => {
                    if (!newIssues.has(Issue.OTHER)) {
                      setUserHasSeenOtherForm(false);
                    }
                    setCallQualityIssues(newIssues);
                  }}
                />
              </div>
              {hasOtherIssue && (
                <div className={tw('mb-3')}>
                  <textarea
                    aria-label={i18n(
                      'icu:CallQualitySurvey__WhatIssuesDidYouHave__SomethingElse__TextArea__AccessibilityLabel'
                    )}
                    aria-describedby={
                      showOtherInputError ? otherTextareaErrorId : undefined
                    }
                    aria-invalid={showOtherInputError}
                    value={additionalIssuesDescription}
                    onChange={event => {
                      setAdditionalIssuesDescription(event.currentTarget.value);
                    }}
                    onBlur={() => {
                      setUserHasSeenOtherForm(true);
                    }}
                    placeholder="Describe your issue"
                    className={tw(
                      'field-sizing-content max-h-50 min-h-20 w-full resize-none',
                      'rounded-lg border-[0.5px] px-3 py-2 shadow-elevation-1',
                      'text-label-primary placeholder:text-label-placeholder disabled:text-label-disabled',
                      'outline-offset-[-2.5px] not-forced-colors:outline-0 not-forced-colors:focused:outline-[2.5px]',
                      showOtherInputError
                        ? 'border-border-error outline-[2.5px] outline-border-error'
                        : 'border-border-primary outline-border-focused'
                    )}
                  />
                  {showOtherInputError && (
                    <p
                      id={otherTextareaErrorId}
                      className={tw(
                        'mt-1 mb-3 type-body-small text-color-label-destructive'
                      )}
                    >
                      {i18n(
                        'icu:CallQualitySurvey__WhatIssuesDidYouHave__SomethingElse__TextArea__ErrorText'
                      )}
                    </p>
                  )}
                  <p
                    className={tw('mt-3 type-body-small text-label-secondary')}
                  >
                    {i18n(
                      'icu:CallQualitySurvey__WhatIssuesDidYouHave__SomethingElse__TextArea__HelpText'
                    )}
                  </p>
                </div>
              )}
            </AxoDialog.Body>
            <AxoDialog.Footer>
              <AxoDialog.Actions>
                {canContinueFromIssuesPage ? (
                  <AxoButton.Root
                    variant="primary"
                    size="md"
                    width="grow"
                    onClick={() => {
                      setPage(Page.CONFIRM_SUBMISSION);
                    }}
                  >
                    {i18n(
                      'icu:CallQualitySurvey__WhatIssuesDidYouHave__ContinueButton'
                    )}
                  </AxoButton.Root>
                ) : (
                  <Tooltip
                    content={i18n(
                      !isOtherInputValid
                        ? 'icu:CallQualitySurvey__WhatIssuesDidYouHave__SomethingElse__TextArea__ErrorText'
                        : 'icu:CallQualitySurvey__WhatIssuesDidYouHave__ContinueButton__DisabledTooltip'
                    )}
                    direction={TooltipPlacement.Top}
                  >
                    <AxoButton.Root
                      variant="primary"
                      size="md"
                      width="grow"
                      disabled
                    >
                      {i18n(
                        'icu:CallQualitySurvey__WhatIssuesDidYouHave__ContinueButton'
                      )}
                    </AxoButton.Root>
                  </Tooltip>
                )}
              </AxoDialog.Actions>
            </AxoDialog.Footer>
          </>
        )}
        {page === Page.CONFIRM_SUBMISSION && (
          <>
            <AxoDialog.Header>
              <AxoDialog.Back
                aria-label={i18n(
                  'icu:CallQualitySurvey__BackButton__AccessibilityLabel'
                )}
                onClick={() => {
                  if (!userSatisfied) {
                    setPage(Page.WHAT_ISSUES_DID_YOU_HAVE);
                  } else {
                    setPage(Page.HOW_WAS_YOUR_CALL);
                  }
                }}
              />
              <AxoDialog.Title>
                {i18n('icu:CallQualitySurvey__ConfirmSubmission__PageTitle')}
              </AxoDialog.Title>
              <AxoDialog.Close
                aria-label={i18n(
                  'icu:CallQualitySurvey__CloseButton__AccessibilityLabel'
                )}
              />
            </AxoDialog.Header>
            <AxoDialog.Body>
              <p className={tw('mb-3 type-body-medium text-label-primary')}>
                <AxoDialog.Description>
                  {i18n(
                    'icu:CallQualitySurvey__ConfirmSubmission__PageDescription'
                  )}
                </AxoDialog.Description>
              </p>
              <div className={tw('my-1.5 flex items-center gap-3')}>
                <AxoCheckbox.Root
                  variant="square"
                  id={debugLogCheckboxId}
                  checked={shareDebugLog}
                  onCheckedChange={setShareDebugLog}
                />
                <label
                  htmlFor={debugLogCheckboxId}
                  className={tw('grow truncate')}
                >
                  {i18n(
                    'icu:CallQualitySurvey__ConfirmSubmission__ShareDebugLog__Label'
                  )}
                </label>
                <AxoButton.Root
                  variant="subtle-primary"
                  size="sm"
                  onClick={() => {
                    onViewDebugLog?.();
                  }}
                >
                  {i18n(
                    'icu:CallQualitySurvey__ConfirmSubmission__ShareDebugLog__ViewButton'
                  )}
                </AxoButton.Root>
              </div>
              <p className={tw('mt-3 type-body-small text-label-secondary')}>
                {i18n(
                  'icu:CallQualitySurvey__ConfirmSubmission__ShareDebugLog__HelpText'
                )}
              </p>
            </AxoDialog.Body>
            <AxoDialog.Footer>
              <AxoDialog.Actions>
                <AxoDialog.Action
                  variant="primary"
                  onClick={handleSubmit}
                  experimentalSpinner={
                    isSubmitting
                      ? {
                          'aria-label': i18n(
                            'icu:CallQualitySurvey__ConfirmSubmission__Submitting'
                          ),
                        }
                      : null
                  }
                >
                  {i18n(
                    'icu:CallQualitySurvey__ConfirmSubmission__SubmitButton'
                  )}
                </AxoDialog.Action>
              </AxoDialog.Actions>
            </AxoDialog.Footer>
          </>
        )}
      </AxoDialog.Content>
    </AxoDialog.Root>
  );
}

function BigCircleButton(props: {
  symbol: AxoSymbol.IconName;
  className: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={tw(
        'group flex w-24 flex-col items-center gap-3 rounded-lg p-3',
        'outline-border-focused not-forced-colors:outline-0 not-forced-colors:focused:outline-[2.5px]'
      )}
      onClick={props.onClick}
    >
      <span
        className={tw(
          'flex size-10 items-center justify-center rounded-full',
          props.className
        )}
      >
        <AxoSymbol.Icon size={24} symbol={props.symbol} label={null} />
      </span>
      <span className={tw('type-body-medium text-label-primary')}>
        {props.label}
      </span>
    </button>
  );
}

const ISSUE_ICONS: Record<Issue, AxoSymbol.InlineGlyphName> = {
  [Issue.AUDIO]: 'speaker',
  [Issue.AUDIO_STUTTERING]: 'speaker',
  [Issue.AUDIO_LOCAL_ECHO]: 'speaker',
  [Issue.AUDIO_REMOTE_ECHO]: 'speaker',
  [Issue.AUDIO_DROP]: 'speaker',
  [Issue.VIDEO]: 'videocamera',
  [Issue.VIDEO_NO_CAMERA]: 'videocamera',
  [Issue.VIDEO_LOW_QUALITY]: 'videocamera',
  [Issue.VIDEO_LOW_RESOLUTION]: 'videocamera',
  [Issue.CALL_DROPPED]: 'x-circle',
  [Issue.OTHER]: 'error',
};

function getIssueLabel(i18n: LocalizerType, issue: Issue): string {
  switch (issue) {
    case Issue.AUDIO:
      return i18n('icu:CallQualitySurvey__Issue--AUDIO');
    case Issue.AUDIO_STUTTERING:
      return i18n('icu:CallQualitySurvey__Issue--AUDIO_STUTTERING');
    case Issue.AUDIO_LOCAL_ECHO:
      return i18n('icu:CallQualitySurvey__Issue--AUDIO_LOCAL_ECHO');
    case Issue.AUDIO_REMOTE_ECHO:
      return i18n('icu:CallQualitySurvey__Issue--AUDIO_REMOTE_ECHO');
    case Issue.AUDIO_DROP:
      return i18n('icu:CallQualitySurvey__Issue--AUDIO_DROP');
    case Issue.VIDEO:
      return i18n('icu:CallQualitySurvey__Issue--VIDEO');
    case Issue.VIDEO_NO_CAMERA:
      return i18n('icu:CallQualitySurvey__Issue--VIDEO_NO_CAMERA');
    case Issue.VIDEO_LOW_QUALITY:
      return i18n('icu:CallQualitySurvey__Issue--VIDEO_LOW_QUALITY');
    case Issue.VIDEO_LOW_RESOLUTION:
      return i18n('icu:CallQualitySurvey__Issue--VIDEO_LOW_RESOLUTION');
    case Issue.CALL_DROPPED:
      return i18n('icu:CallQualitySurvey__Issue--CALL_DROPPED');
    case Issue.OTHER:
      return i18n('icu:CallQualitySurvey__Issue--OTHER');
    default:
      throw missingCaseError(issue);
  }
}

type IssueGroup = Readonly<{
  parent: Issue;
  children: ReadonlyArray<Issue>;
}>;

const IssueGroups: ReadonlyArray<IssueGroup> = [
  {
    parent: Issue.AUDIO,
    children: [
      Issue.AUDIO_STUTTERING,
      Issue.AUDIO_LOCAL_ECHO,
      Issue.AUDIO_REMOTE_ECHO,
      Issue.AUDIO_DROP,
    ],
  },
  {
    parent: Issue.VIDEO,
    children: [
      Issue.VIDEO_NO_CAMERA,
      Issue.VIDEO_LOW_QUALITY,
      Issue.VIDEO_LOW_RESOLUTION,
    ],
  },
  {
    parent: Issue.CALL_DROPPED,
    children: [],
  },
  {
    parent: Issue.OTHER,
    children: [],
  },
];

function IssueSelector(props: {
  i18n: LocalizerType;
  issues: ReadonlySet<Issue>;
  onIssuesChange: (issues: ReadonlySet<Issue>) => void;
}): JSX.Element {
  const { i18n, issues, onIssuesChange } = props;

  return (
    <div className={tw('flex flex-wrap justify-center-safe gap-2 px-4')}>
      {IssueGroups.map(group => {
        return (
          <IssueToggleGroup
            key={group.parent}
            i18n={i18n}
            group={group}
            issues={issues}
            onIssuesChange={onIssuesChange}
          />
        );
      })}
    </div>
  );
}

function IssueToggleGroup(props: {
  i18n: LocalizerType;
  group: IssueGroup;
  issues: ReadonlySet<Issue>;
  onIssuesChange: (issues: ReadonlySet<Issue>) => void;
}) {
  const { i18n, group, issues, onIssuesChange } = props;

  const selected = issues.has(group.parent);
  const [stored, setStored] = useState<ReadonlySet<Issue>>(() => new Set());

  const handleParentToggle = useCallback(
    (_issue: Issue, toggle: boolean) => {
      const newIssues = new Set(issues);
      if (toggle) {
        newIssues.add(group.parent);
        for (const child of stored) {
          newIssues.add(child);
        }
      } else {
        newIssues.delete(group.parent);
        for (const child of group.children) {
          newIssues.delete(child);
        }
      }

      onIssuesChange(newIssues);
    },
    [issues, stored, group, onIssuesChange]
  );

  const handleChildToggle = useCallback(
    (issue: Issue, toggle: boolean) => {
      const newIssues = new Set(issues);
      const newStored = new Set(stored);
      if (toggle) {
        newIssues.add(issue);
        newStored.add(issue);
      } else {
        newIssues.delete(issue);
        newStored.delete(issue);
      }
      setStored(newStored);
      onIssuesChange(newIssues);
    },
    [issues, stored, onIssuesChange]
  );

  return (
    <>
      <IssueToggle
        i18n={i18n}
        issue={group.parent}
        isParent
        isSelected={selected}
        onToggle={handleParentToggle}
      />
      {selected && (
        <>
          {group.children.map(child => {
            return (
              <IssueToggle
                key={child}
                i18n={i18n}
                issue={child}
                isParent={false}
                isSelected={issues.has(child)}
                onToggle={handleChildToggle}
              />
            );
          })}
        </>
      )}
    </>
  );
}

function IssueToggle(props: {
  i18n: LocalizerType;
  issue: Issue;
  isParent: boolean;
  isSelected: boolean;
  onToggle: (issue: Issue, toggle: boolean) => void;
}) {
  const { i18n, issue, isSelected, onToggle } = props;

  const handleClick = useCallback(() => {
    onToggle(issue, !isSelected);
  }, [issue, isSelected, onToggle]);

  return (
    <AxoButton.Root
      variant={props.isSelected ? 'primary' : 'secondary'}
      size="md"
      symbol={isSelected ? 'check' : ISSUE_ICONS[issue]}
      aria-pressed={props.isSelected}
      onClick={handleClick}
    >
      {getIssueLabel(i18n, issue)}
    </AxoButton.Root>
  );
}
