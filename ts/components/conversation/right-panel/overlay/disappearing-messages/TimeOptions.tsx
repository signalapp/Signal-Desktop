import { isEmpty } from 'lodash';

import { TimerOptionsArray } from '../../../../../session/disappearing_messages/timerOptions';
import { PanelButtonGroup, PanelLabel } from '../../../../buttons/PanelButton';
import { PanelRadioButton } from '../../../../buttons/PanelRadioButton';

type TimerOptionsProps = {
  options: TimerOptionsArray | null;
  selected: number;
  setSelected: (value: number) => void;
  hasOnlyOneMode?: boolean;
  disabled?: boolean;
};

export const TimeOptions = (props: TimerOptionsProps) => {
  const { options, selected, setSelected, hasOnlyOneMode, disabled } = props;

  if (!options || isEmpty(options)) {
    return null;
  }

  return (
    <>
      {!hasOnlyOneMode && <PanelLabel>{window.i18n('timer')}</PanelLabel>}
      <PanelButtonGroup>
        {options.map(option => {
          return (
            <PanelRadioButton
              key={option.name}
              text={option.name}
              value={option.name}
              isSelected={selected === option.value}
              onSelect={() => {
                setSelected(option.value);
              }}
              disabled={disabled}
              dataTestId={`time-option-${option.name.replace(' ', '-')}`} // we want  "time-option-1-minute", etc as accessibility id
            />
          );
        })}
      </PanelButtonGroup>
    </>
  );
};
