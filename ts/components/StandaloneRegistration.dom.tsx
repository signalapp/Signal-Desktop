// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useState, useEffect, useCallback, useRef } from 'react';
import intlTelInput from 'intl-tel-input';

import type { ChangeEvent } from 'react';
import type { Iti } from 'intl-tel-input';

import { strictAssert } from '../util/assert.std.ts';
import { parseNumber } from '../util/libphonenumberUtil.std.ts';
import { missingCaseError } from '../util/missingCaseError.std.ts';
import { VerificationTransport } from '../types/VerificationTransport.std.ts';
import { normalizeProfileName } from '../util/normalizeProfileName.std.ts';
import { TitlebarDragArea } from './TitlebarDragArea.dom.tsx';
import { AvatarPreview } from './AvatarPreview.dom.tsx';
import { AvatarColors } from '../types/Colors.std.ts';
import { AvatarEditor } from './AvatarEditor.dom.tsx';

import type { LocalizerType } from '../types/I18N.std.ts';
import type {
  AvatarDataType,
  DeleteAvatarFromDiskActionType,
  ReplaceAvatarActionType,
  SaveAvatarToDiskActionType,
} from '../types/Avatar.std.ts';

function PhoneInput({
  initialValue,
  onValidation,
  onNumberChange,
}: {
  initialValue: string | undefined;
  onValidation: (isValid: boolean) => void;
  onNumberChange: (number?: string) => void;
}): React.JSX.Element {
  const [isValid, setIsValid] = useState(false);
  const pluginRef = useRef<Iti | null>(null);
  const elemRef = useRef<HTMLInputElement | null>(null);

  const onRef = useCallback(
    (elem: HTMLInputElement | null) => {
      elemRef.current = elem;

      if (!elem) {
        return;
      }

      if (initialValue !== undefined) {
        // oxlint-disable-next-line no-param-reassign
        elem.value = initialValue;
      }

      pluginRef.current?.destroy();

      const plugin = intlTelInput(elem, { formatAsYouType: true });
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

  // We don't always get change events when expected because of int-tel-input
  const onChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      validateNumber(event.target.value);
    },
    [validateNumber]
  );

  // We validate in more scenarios to make things more responsive
  const validate = useCallback(() => {
    if (elemRef.current) {
      validateNumber(elemRef.current.value);
    }
  }, [validateNumber]);

  return (
    <div className="phone-input">
      <div className="phone-input-form">
        <div className={`number-container ${isValid ? 'valid' : 'invalid'}`}>
          <input
            className="number"
            type="tel"
            ref={onRef}
            onChange={onChange}
            onBlur={validate}
            onKeyUp={validate}
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
}): React.JSX.Element {
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

function VerificationCodeStage({
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
}): React.JSX.Element {
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

function ProfileNameStage({
  conversationId,
  deleteAvatarFromDisk,
  i18n,
  onNext,
  replaceAvatar,
  saveAvatarToDisk,
  uploadInitialProfile,
  userAvatarData,
}: {
  conversationId?: string;
  deleteAvatarFromDisk: DeleteAvatarFromDiskActionType;
  i18n: LocalizerType;
  onNext: () => void;
  replaceAvatar: ReplaceAvatarActionType;
  saveAvatarToDisk: SaveAvatarToDiskActionType;
  uploadInitialProfile: (opts: {
    firstName: string;
    lastName: string;
    avatarData: Uint8Array<ArrayBuffer>;
  }) => Promise<void>;
  userAvatarData: ReadonlyArray<AvatarDataType>;
}): React.JSX.Element {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);
  const [isEditingAvatar, setIsEditingAvatar] = useState(false);

  const [avatarData, setAvatarData] = useState<
    Uint8Array<ArrayBuffer> | undefined
  >(undefined);

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
      if (!avatarData) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      try {
        await uploadInitialProfile({
          firstName,
          lastName,
          avatarData,
        });
        onNext();
      } catch (err) {
        setError(err.message);
      }
    },
    [onNext, firstName, lastName, avatarData, uploadInitialProfile]
  );

  const fullName = `${firstName} ${lastName}`;

  if (isEditingAvatar) {
    return (
      <div className="step-body">
        <div className="banner-image module-splash-screen__logo module-img--128" />
        <div className="header">Set up profile avatar</div>
        <AvatarEditor
          avatarColor={AvatarColors[0]}
          avatarUrl={undefined}
          avatarValue={avatarData}
          conversationId={conversationId}
          conversationTitle={fullName}
          deleteAvatarFromDisk={deleteAvatarFromDisk}
          i18n={i18n}
          onCancel={() => {
            setIsEditingAvatar(false);
          }}
          onSave={(avatar: Uint8Array<ArrayBuffer> | undefined) => {
            setAvatarData(avatar);
            setIsEditingAvatar(false);
          }}
          userAvatarData={userAvatarData}
          replaceAvatar={replaceAvatar}
          saveAvatarToDisk={saveAvatarToDisk}
        />
      </div>
    );
  }

  return (
    <>
      <div className="step-body">
        <div className="banner-image module-splash-screen__logo module-img--128" />
        <div className="header">Set up profile</div>
        <AvatarPreview
          avatarColor={AvatarColors[0]}
          avatarUrl={undefined}
          avatarValue={avatarData}
          conversationTitle={fullName}
          i18n={i18n}
          onAvatarLoaded={avatar => {
            setAvatarData(avatar);
          }}
          onClick={() => {
            setIsEditingAvatar(true);
          }}
          style={{
            height: 80,
            width: 80,
          }}
        />
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
        &nbsp;
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
        <div className="StandaloneRegistration__error">{error}</div>
      </div>
      <div className="nav">
        <button
          type="button"
          className="button"
          disabled={!normalizeProfileName(firstName) || !avatarData}
          onClick={onNextClick}
        >
          Finish
        </button>
      </div>
    </>
  );
}

export type PropsType = Readonly<{
  conversationId?: string;
  deleteAvatarFromDisk: DeleteAvatarFromDiskActionType;
  i18n: LocalizerType;
  getCaptchaToken: () => Promise<string>;
  onComplete: () => void;
  readyForUpdates: () => void;
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
  replaceAvatar: ReplaceAvatarActionType;
  saveAvatarToDisk: SaveAvatarToDiskActionType;
  uploadInitialProfile: (opts: {
    firstName: string;
    lastName: string;
    avatarData: Uint8Array<ArrayBuffer>;
  }) => Promise<void>;
  userAvatarData: ReadonlyArray<AvatarDataType>;
}>;

export function StandaloneRegistration({
  conversationId,
  deleteAvatarFromDisk,
  getCaptchaToken,
  i18n,
  onComplete,
  readyForUpdates,
  registerSingleDevice,
  replaceAvatar,
  requestVerification,
  saveAvatarToDisk,
  uploadInitialProfile,
  userAvatarData,
}: PropsType): React.JSX.Element {
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

  let body: React.JSX.Element;
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
        conversationId={conversationId}
        deleteAvatarFromDisk={deleteAvatarFromDisk}
        i18n={i18n}
        onNext={onComplete}
        replaceAvatar={replaceAvatar}
        saveAvatarToDisk={saveAvatarToDisk}
        uploadInitialProfile={uploadInitialProfile}
        userAvatarData={userAvatarData}
      />
    );
  } else {
    throw missingCaseError(stageData);
  }

  return (
    <div className="full-screen-flow">
      <TitlebarDragArea />

      <div className="step">
        <div className="inner">{body}</div>
      </div>
    </div>
  );
}
