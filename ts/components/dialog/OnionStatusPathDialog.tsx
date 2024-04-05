import { ipcRenderer, shell } from 'electron';
import React, { useState } from 'react';

import { useDispatch } from 'react-redux';
import useHover from 'react-use/lib/useHover';
import styled from 'styled-components';

import { isEmpty, isTypedArray } from 'lodash';
import { CityResponse, Reader } from 'maxmind';
import { useMount } from 'react-use';
import { Snode } from '../../data/data';
import { onionPathModal } from '../../state/ducks/modalDialog';
import {
  useFirstOnionPath,
  useFirstOnionPathLength,
  useIsOnline,
  useOnionPathsCount,
} from '../../state/selectors/onions';
import { Flex } from '../basic/Flex';

import { SessionWrapperModal } from '../SessionWrapperModal';
import { SessionSpinner } from '../basic/SessionSpinner';
import { SessionIcon, SessionIconButton } from '../icon';

export type StatusLightType = {
  glowStartDelay: number;
  glowDuration: number;
  color?: string;
  dataTestId?: string;
};

const StyledCountry = styled.div`
  margin: var(--margins-sm);
  min-width: 150px;
`;

const StyledOnionNodeList = styled.div`
  display: flex;
  flex-direction: column;
  margin: var(--margins-sm);
  align-items: center;
  min-width: 10vw;
  position: relative;
`;

const StyledOnionDescription = styled.p`
  min-width: 400px;
  width: 0;
  line-height: 1.3333;
`;

const StyledVerticalLine = styled.div`
  background: var(--border-color);
  position: absolute;
  height: calc(100% - 2 * 15px);
  margin: 15px calc(100% / 2 - 1px);

  width: 1px;
`;

const StyledLightsContainer = styled.div`
  position: relative;
`;

const StyledGrowingIcon = styled.div`
  flex-grow: 1;
  display: flex;
  align-items: center;
`;

const OnionCountryDisplay = ({ labelText, snodeIp }: { snodeIp?: string; labelText: string }) => {
  const element = (hovered: boolean) => (
    <StyledCountry>{hovered && snodeIp ? snodeIp : labelText}</StyledCountry>
  );
  const [hoverable] = useHover(element);

  return hoverable;
};

let reader: Reader<CityResponse> | null;

const OnionPathModalInner = () => {
  const onionPath = useFirstOnionPath();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_dataLoaded, setDataLoaded] = useState(false);
  const isOnline = useIsOnline();

  const glowDuration = onionPath.length + 2;

  useMount(() => {
    ipcRenderer.once('load-maxmind-data-complete', (_event, content) => {
      const asArrayBuffer = content as Uint8Array;
      if (asArrayBuffer && isTypedArray(asArrayBuffer) && !isEmpty(asArrayBuffer)) {
        reader = new Reader<CityResponse>(Buffer.from(asArrayBuffer.buffer));
        setDataLoaded(true); // retrigger a rerender
      }
    });
    ipcRenderer.send('load-maxmind-data');
  });

  if (!isOnline || !onionPath || onionPath.length === 0) {
    return <SessionSpinner loading={true} />;
  }

  const nodes = [
    {
      label: window.i18n('device'),
    },
    ...onionPath,
    {
      label: window.i18n('destination'),
    },
  ];

  return (
    <>
      <StyledOnionDescription>
        {window.i18n('onionPathIndicatorDescription')}
      </StyledOnionDescription>
      <StyledOnionNodeList>
        <Flex container={true}>
          <StyledLightsContainer>
            <StyledVerticalLine />
            <Flex container={true} flexDirection="column" alignItems="center" height="100%">
              {nodes.map((_snode: Snode | any, index: number) => {
                return (
                  <OnionNodeStatusLight
                    glowDuration={glowDuration}
                    glowStartDelay={index}
                    key={`light-${index}`}
                  />
                );
              })}
            </Flex>
          </StyledLightsContainer>
          <Flex container={true} flexDirection="column" alignItems="flex-start">
            {nodes.map((snode: Snode | any) => {
              const country = reader?.get(snode.ip || '0.0.0.0')?.country;
              const locale = (window.i18n as any).getLocale() as string;

              // typescript complains that the [] operator cannot be used with the 'string' coming from getLocale()
              const countryNamesAsAny = country?.names as any;
              const countryName =
                snode.label || // to take care of the "Device" case
                countryNamesAsAny?.[locale] || // try to find the country name based on the user local first
                // eslint-disable-next-line dot-notation
                countryNamesAsAny?.['en'] || // if not found, fallback to the country in english
                window.i18n('unknownCountry');

              return (
                <OnionCountryDisplay
                  labelText={countryName}
                  snodeIp={snode.ip}
                  key={`country-${snode.ip}`}
                />
              );
            })}
          </Flex>
        </Flex>
      </StyledOnionNodeList>
    </>
  );
};

export type OnionNodeStatusLightType = {
  glowStartDelay: number;
  glowDuration: number;
  dataTestId?: string;
};

/**
 * Component containing a coloured status light.
 */
export const OnionNodeStatusLight = (props: OnionNodeStatusLightType): JSX.Element => {
  const { glowStartDelay, glowDuration, dataTestId } = props;

  return (
    <ModalStatusLight
      glowDuration={glowDuration}
      glowStartDelay={glowStartDelay}
      color={'var(--button-path-default-color)'}
      dataTestId={dataTestId}
    />
  );
};

/**
 * An icon with a pulsating glow emission.
 */
export const ModalStatusLight = (props: StatusLightType) => {
  const { glowStartDelay, glowDuration, color } = props;

  return (
    <StyledGrowingIcon>
      <SessionIcon
        borderRadius={'50px'}
        iconColor={color}
        glowDuration={glowDuration}
        glowStartDelay={glowStartDelay}
        iconType="circle"
        iconSize={'tiny'}
      />
    </StyledGrowingIcon>
  );
};

/**
 * A status light specifically for the action panel. Color is based on aggregate node states instead of individual onion node state
 */
export const ActionPanelOnionStatusLight = (props: {
  isSelected: boolean;
  handleClick: () => void;
  id: string;
}) => {
  const { isSelected, handleClick, id } = props;

  const onionPathsCount = useOnionPathsCount();
  const firstPathLength = useFirstOnionPathLength();
  const isOnline = useIsOnline();

  // Set icon color based on result
  const errorColor = 'var(--button-path-error-color)';
  const defaultColor = 'var(--button-path-default-color)';
  const connectingColor = 'var(--button-path-connecting-color)';

  // start with red
  let iconColor = errorColor;
  // if we are not online or the first path is not valid, we keep red as color
  if (isOnline && firstPathLength > 1) {
    iconColor =
      onionPathsCount >= 2 ? defaultColor : onionPathsCount >= 1 ? connectingColor : errorColor;
  }

  return (
    <SessionIconButton
      iconSize={'small'}
      iconType="circle"
      iconColor={iconColor}
      onClick={handleClick}
      glowDuration={10}
      glowStartDelay={0}
      noScale={true}
      isSelected={isSelected}
      dataTestId={'path-light-container'}
      dataTestIdIcon={'path-light-svg'}
      id={id}
    />
  );
};

export const OnionPathModal = () => {
  const onConfirm = () => {
    void shell.openExternal('https://getsession.org/faq/#onion-routing');
  };
  const dispatch = useDispatch();
  return (
    <SessionWrapperModal
      title={window.i18n('onionPathIndicatorTitle')}
      confirmText={window.i18n('learnMore')}
      cancelText={window.i18n('cancel')}
      onConfirm={onConfirm}
      onClose={() => dispatch(onionPathModal(null))}
      showExitIcon={true}
    >
      <OnionPathModalInner />
    </SessionWrapperModal>
  );
};
