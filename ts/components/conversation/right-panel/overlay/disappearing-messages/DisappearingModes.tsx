import React from 'react';
import { DisappearingMessageConversationType } from '../../../../../util/expiringMessages';
import { PanelButtonGroup, PanelLabel } from '../../../../buttons/PanelButton';
import { PanelRadioButton } from '../../../../buttons/PanelRadioButton';

type DisappearingModesProps = {
  options: Record<DisappearingMessageConversationType, boolean>;
  selected?: DisappearingMessageConversationType;
  setSelected: (value: string) => void;
  hasOnlyOneMode?: boolean;
};

export const DisappearingModes = (props: DisappearingModesProps) => {
  const { options, selected, setSelected, hasOnlyOneMode } = props;

  if (hasOnlyOneMode) {
    return null;
  }

  return (
    <>
      <PanelLabel>{window.i18n('disappearingMessagesModeLabel')}</PanelLabel>
      <PanelButtonGroup>
        {Object.keys(options).map((mode: DisappearingMessageConversationType) => {
          const optionI18n =
            mode === 'legacy'
              ? window.i18n('disappearingMessagesModeLegacy')
              : mode === 'deleteAfterRead'
              ? window.i18n('disappearingMessagesModeAfterRead')
              : mode === 'deleteAfterSend'
              ? window.i18n('disappearingMessagesModeAfterSend')
              : window.i18n('disappearingMessagesModeOff');

          const subtitleI18n =
            mode === 'legacy'
              ? window.i18n('disappearingMessagesModeLegacySubtitle')
              : mode === 'deleteAfterRead'
              ? window.i18n('disappearingMessagesModeAfterReadSubtitle')
              : mode === 'deleteAfterSend'
              ? window.i18n('disappearingMessagesModeAfterSendSubtitle')
              : undefined;

          return (
            <PanelRadioButton
              key={mode}
              text={optionI18n}
              subtitle={subtitleI18n}
              value={mode}
              isSelected={selected === mode}
              onSelect={() => {
                setSelected(mode);
              }}
              disabled={options[mode]}
              noBackgroundColor={true}
            />
          );
        })}
      </PanelButtonGroup>
    </>
  );
};
