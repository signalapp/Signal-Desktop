// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ChangeEvent } from 'react';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { Iti } from 'intl-tel-input';
import intlTelInput from 'intl-tel-input';

import { strictAssert } from '../util/assert';
import { parseNumber } from '../util/libphonenumberUtil';
import { missingCaseError } from '../util/missingCaseError';
import { VerificationTransport } from '../types/VerificationTransport';

function PhoneInput({
  initialValue,
  onValidation,
  onNumberChange,
}: {
  initialValue: string | undefined;
  onValidation: (isValid: boolean) => void;
  onNumberChange: (number?: string) => void;
}): JSX.Element {
  const [isValid, setIsValid] = useState(false);
  const pluginRef = useRef<Iti | undefined>();
  const elemRef = useRef<HTMLInputElement | null>(null);

  const onRef = useCallback(
    (elem: HTMLInputElement | null) => {
      elemRef.current = elem;

      if (!elem) {
        return;
      }

      if (initialValue !== undefined) {
        // eslint-disable-next-line no-param-reassign
        elem.value = initialValue;
      }

      pluginRef.current?.destroy();

      const plugin = intlTelInput(elem);
      pluginRef.current = plugin;
    },
    [initialValue]
  );

  const validateNumber = useCallback(
    (number: string) => {
      const { current: plugin } = pluginRef;
      if (!plugin) {
        return;
      }

      const regionCode = plugin.getSelectedCountryData().iso2;

      const parsedNumber = parseNumber(number, regionCode);

      setIsValid(parsedNumber.isValidNumber);
      onValidation(parsedNumber.isValidNumber);

      onNumberChange(
        parsedNumber.isValidNumber ? parsedNumber.e164 : undefined
      );
    },
    [setIsValid, onNumberChange, onValidation]
  );

  const onChange = useCallback(
    (_: ChangeEvent<HTMLInputElement>) => {
      if (elemRef.current) {
        validateNumber(elemRef.current.value);
      }
    },
    [validateNumber]
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      // Pacify TypeScript and handle events bubbling up
      if (event.target instanceof HTMLInputElement) {
        validateNumber(event.target.value);
      }
    },
    [validateNumber]
  );

  return (
    <div className="phone-input">
      <div className="phone-input-form">
        <div className={`number-container ${isValid ? 'valid' : 'invalid'}`}>
          <input
            className="number"
            type="tel"
            ref={onRef}
            onChange={onChange}
            onKeyDown={onKeyDown}
            placeholder="Phone Number"
          />
        </div>
      </div>
    </div>
  );
}

enum Stage {
  PhoneNumber,
  VerificationCode,
  ProfileName,
}

type StageData =
  | {
      stage: Stage.PhoneNumber;
      initialNumber: string | undefined;
    }
  | {
      stage: Stage.VerificationCode;
      number: string;
      sessionId: string;
    }
  | {
      stage: Stage.ProfileName;
    };

function PhoneNumberStage({
  initialNumber,
  getCaptchaToken,
  requestVerification,
  onNext,
}: {
  initialNumber: string | undefined;
  getCaptchaToken: () => Promise<string>;
  requestVerification: (
    number: string,
    captcha: string,
    transport: VerificationTransport
  ) => Promise<{ sessionId: string }>;
  onNext: (result: { number: string; sessionId: string }) => void;
}): JSX.Element {
  const [number, setNumber] = useState<string | undefined>(initialNumber);

  const [isValidNumber, setIsValidNumber] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const onRequestCode = useCallback(
    async (transport: VerificationTransport) => {
      if (!isValidNumber) {
        return;
      }

      if (!number) {
        setIsValidNumber(false);
        setError(undefined);
        return;
      }

      try {
        const token = await getCaptchaToken();
        const result = await requestVerification(number, token, transport);
        setError(undefined);

        onNext({ number, sessionId: result.sessionId });
      } catch (err) {
        setError(err.message);
      }
    },
    [
      getCaptchaToken,
      isValidNumber,
      setIsValidNumber,
      setError,
      requestVerification,
      number,
      onNext,
    ]
  );

  const onSMSClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();

      void onRequestCode(VerificationTransport.SMS);
    },
    [onRequestCode]
  );

  const onVoiceClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();

      void onRequestCode(VerificationTransport.Voice);
    },
    [onRequestCode]
  );

  return (
    <div className="step-body">
      <div className="banner-image module-splash-screen__logo module-img--128" />
      <div className="header">Create your Signal Account</div>

      <div>
        <div className="phone-input-form">
          <PhoneInput
            initialValue={initialNumber}
            onValidation={setIsValidNumber}
            onNumberChange={setNumber}
          />
        </div>
      </div>
      <div className="StandaloneRegistration__error">{error}</div>
      <div className="clearfix">
        <button
          type="button"
          className="button"
          disabled={!isValidNumber}
          onClick={onSMSClick}
        >
          Send SMS
        </button>
        <button
          type="button"
          className="link"
          tabIndex={-1}
          disabled={!isValidNumber}
          onClick={onVoiceClick}
        >
          Call
        </button>
      </div>
    </div>
  );
}

export function VerificationCodeStage({
  number,
  sessionId,
  registerSingleDevice,
  onNext,
  onBack,
}: {
  number: string;
  sessionId: string;
  registerSingleDevice: (
    number: string,
    code: string,
    sessionId: string
  ) => Promise<void>;
  onNext: () => void;
  onBack: () => void;
}): JSX.Element {
  const [code, setCode] = useState('');
  const [isValidCode, setIsValidCode] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const onChangeCode = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const { value } = event.target;

      setIsValidCode(value.length === 6);
      setCode(value);
    },
    [setIsValidCode, setCode]
  );

  const onBackClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      onBack();
    },
    [onBack]
  );

  const onVerifyCode = useCallback(
    async (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();

      if (!isValidCode || !sessionId) {
        return;
      }

      strictAssert(number != null && code.length > 0, 'Missing number or code');

      try {
        await registerSingleDevice(number, code, sessionId);
        onNext();
      } catch (err) {
        setError(err.message);
      }
    },
    [
      registerSingleDevice,
      onNext,
      number,
      code,
      sessionId,
      setError,
      isValidCode,
    ]
  );

  return (
    <>
      <div className="step-body">
        <div className="banner-image module-splash-screen__logo module-img--128" />
        <div className="header">Create your Signal Account</div>

        <input
          className={`form-control ${isValidCode ? 'valid' : 'invalid'}`}
          type="text"
          dir="auto"
          pattern="\s*[0-9]{3}-?[0-9]{3}\s*"
          title="Enter your 6-digit verification code. If you did not receive a code, click Call or Send SMS to request a new one"
          placeholder="Verification Code"
          autoComplete="off"
          value={code}
          onChange={onChangeCode}
        />
        <div className="StandaloneRegistration__error">{error}</div>
      </div>
      <div className="nav">
        <button type="button" className="button" onClick={onBackClick}>
          Back
        </button>
        <button
          type="button"
          className="button"
          disabled={!isValidCode}
          onClick={onVerifyCode}
        >
          Register
        </button>
      </div>
    </>
  );
}

export function ProfileNameStage({
  uploadProfile,
  onNext,
}: {
  uploadProfile: (opts: {
    firstName: string;
    lastName: string;
  }) => Promise<void>;
  onNext: () => void;
}): JSX.Element {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);

  const onChangeFirstName = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setFirstName(event.target.value),
    []
  );

  const onChangeLastName = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setLastName(event.target.value),
    []
  );

  const onNextClick = useCallback(
    async (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      try {
        await uploadProfile({ firstName, lastName });
        onNext();
      } catch (err) {
        setError(err.message);
      }
    },
    [onNext, firstName, lastName, uploadProfile]
  );

  return (
    <>
      <div className="step-body">
        <div className="banner-image module-splash-screen__logo module-img--128" />
        <div className="header">Select Profile Name</div>

        <input
          className={`form-control ${firstName ? 'valid' : 'invalid'}`}
          type="text"
          dir="auto"
          pattern="\s*[0-9]{3}-?[0-9]{3}\s*"
          title="Enter your first name"
          placeholder="First Name (Required)"
          autoComplete="off"
          value={firstName}
          onChange={onChangeFirstName}
        />
        <input
          className="form-control"
          type="text"
          dir="auto"
          pattern="\s*[0-9]{3}-?[0-9]{3}\s*"
          title="Enter your last name"
          placeholder="Last Name (Optional)"
          autoComplete="off"
          value={lastName}
          onChange={onChangeLastName}
        />

        {/* TODO(indutny): highlight error */}
        <div>{error}</div>
      </div>
      <div className="nav">
        <button
          type="button"
          className="button"
          disabled={!firstName}
          onClick={onNextClick}
        >
          Finish
        </button>
      </div>
    </>
  );
}

export type PropsType = Readonly<{
  onComplete: () => void;
  getCaptchaToken: () => Promise<string>;
  requestVerification: (
    number: string,
    captcha: string,
    transport: VerificationTransport
  ) => Promise<{ sessionId: string }>;
  registerSingleDevice: (
    number: string,
    code: string,
    sessionId: string
  ) => Promise<void>;
  uploadProfile: (opts: {
    firstName: string;
    lastName: string;
  }) => Promise<void>;
  readyForUpdates: () => void;
}>;

export function StandaloneRegistration({
  onComplete,
  getCaptchaToken,
  requestVerification,
  registerSingleDevice,
  uploadProfile,
  readyForUpdates,
}: PropsType): JSX.Element {
  useEffect(() => {
    readyForUpdates();
  }, [readyForUpdates]);

  const [stageData, setStageData] = useState<StageData>({
    stage: Stage.PhoneNumber,
    initialNumber: undefined,
  });

  const onPhoneNumber = useCallback(
    ({ number, sessionId }: { number: string; sessionId: string }) => {
      setStageData({
        stage: Stage.VerificationCode,
        number,
        sessionId,
      });
    },
    []
  );

  const onBackToPhoneNumber = useCallback(() => {
    setStageData(data => {
      if (data.stage !== Stage.VerificationCode) {
        return data;
      }

      return {
        stage: Stage.PhoneNumber,
        initialNumber: data.number,
      };
    });
  }, []);

  const onRegistered = useCallback(() => {
    setStageData({
      stage: Stage.ProfileName,
    });
  }, []);

  let body: JSX.Element;
  if (stageData.stage === Stage.PhoneNumber) {
    body = (
      <PhoneNumberStage
        {...stageData}
        getCaptchaToken={getCaptchaToken}
        requestVerification={requestVerification}
        onNext={onPhoneNumber}
      />
    );
  } else if (stageData.stage === Stage.VerificationCode) {
    body = (
      <VerificationCodeStage
        {...stageData}
        registerSingleDevice={registerSingleDevice}
        onNext={onRegistered}
        onBack={onBackToPhoneNumber}
      />
    );
  } else if (stageData.stage === Stage.ProfileName) {
    body = (
      <ProfileNameStage
        {...stageData}
        uploadProfile={uploadProfile}
        onNext={onComplete}
      />
    );
  } else {
    throw missingCaseError(stageData);
  }

  return (
    <div className="full-screen-flow">
      <div className="module-title-bar-drag-area" />

      <div className="step">
        <div className="inner">{body}</div>
      </div>
    </div>
  );
}
