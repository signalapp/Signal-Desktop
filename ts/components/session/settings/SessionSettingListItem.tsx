import React, { useState } from 'react';
import classNames from 'classnames';

import Slider from 'rc-slider';

import { SessionToggle } from '../SessionToggle';
import { SessionButton } from '../SessionButton';
import { SessionSettingType } from './SessionSettings';
import { SessionRadioGroup } from '../SessionRadioGroup';
import { SessionConfirmDialogProps } from '../../dialog/SessionConfirm';

type Props = {
  title?: string;
  description?: string;
  type: SessionSettingType | undefined;
  value: any;
  options?: Array<any>;
  onClick?: any;
  onSliderChange?: any;
  content: any;
  confirmationDialogParams?: SessionConfirmDialogProps;
};

export const SessionSettingListItem = (props: Props) => {
  const handleSlider = (valueToForward: any) => {
    if (props.onSliderChange) {
      props.onSliderChange(valueToForward);
    }

    setSliderValue(valueToForward);
  };

  const [sliderValue, setSliderValue] = useState(null);

  const { title, description, type, value, content } = props;
  const inline = !!type && ![SessionSettingType.Options, SessionSettingType.Slider].includes(type);

  const currentSliderValue = type === SessionSettingType.Slider && (sliderValue || value);

  return (
    <div className={classNames('session-settings-item', inline && 'inline')}>
      <div className="session-settings-item__info">
        <div className="session-settings-item__title">{title}</div>

        {description && <div className="session-settings-item__description">{description}</div>}
      </div>

      <div className="session-settings-item__content">
        {type === SessionSettingType.Toggle && (
          <div className="session-settings-item__selection">
            <SessionToggle
              active={Boolean(value)}
              onClick={() => props.onClick?.()}
              confirmationDialogParams={props.confirmationDialogParams}
            />
          </div>
        )}

        {type === SessionSettingType.Button && (
          <SessionButton
            text={content.buttonText}
            buttonColor={content.buttonColor}
            onClick={() => props.onClick?.()}
          />
        )}

        {type === SessionSettingType.Options && (
          <SessionRadioGroup
            initialItem={content.options.initialItem}
            group={content.options.group}
            items={content.options.items}
            onClick={(selectedRadioValue: string) => {
              props.onClick(selectedRadioValue);
            }}
          />
        )}

        {type === SessionSettingType.Slider && (
          <div className="slider-wrapper">
            <Slider
              dots={true}
              step={content.step}
              min={content.min}
              max={content.max}
              defaultValue={currentSliderValue}
              onAfterChange={handleSlider}
            />

            <div className="slider-info">
              <p>{content.info(currentSliderValue)}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
