import React, { useState } from 'react';
import { SessionButton, SessionButtonColor, SessionButtonType } from './session/SessionButton';
import { SessionModal } from './session/SessionModal';
import { DefaultTheme } from 'styled-components';
import electron from 'electron';
const { shell } = electron;

interface Props {
  theme: DefaultTheme;
  nodes?: Array<string>;
  onClose: any;
}

interface IPathNode {
  ip?: string;
  label: string;
}

const OnionPath = (props: { nodes: IPathNode[] }) => {
  const { nodes } = props;

  return (
    <div className='onionPath'>
      {
        nodes.map((node) => {
          return (
            <div className='dotContainer'>
              <div className='dot'></div>
              <p>
                <b>{node.label}</b>
                {node.ip && (
                  <>
                    <br />
                    {node.ip}
                  </>
                )}
              </p>
            </div>
          )
        })
      }
    </div>
  )
}

export const OnionStatusDialog = (props: Props) => {
  const { theme, onClose } = props;

  const openFAQPage = () => {
    console.log("Opening FAQ Page")
    shell.openExternal('https://getsession.org/faq/#onion-routing');
  }

  const nodes: IPathNode[] = [
    {
      label: 'You'
    },
    {
      ip: '100',
      label: 'Entry Node'
    },
    {
      ip: '100',
      label: 'Service Node'
    },
    {
      ip: '100',
      label: 'Service Node'
    },
    {
      ip: '100',
      label: 'Destination'
    },
  ]

  return (
    <SessionModal
      title={window.i18n('onionPathIndicatorTitle')}
      theme={theme}
      onClose={onClose}
    >
      <div className="spacer-sm" />
      <div className='onionDescriptionContainer'>
        <p>{window.i18n('onionPathIndicatorDescription')}</p>
      </div>

      <OnionPath nodes={nodes} />

      <SessionButton
        text={window.i18n('learnMore')}
        buttonType={SessionButtonType.BrandOutline}
        buttonColor={SessionButtonColor.Green}
        onClick={openFAQPage}
      />
    </SessionModal>
  );
}
