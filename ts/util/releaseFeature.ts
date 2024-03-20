import { GetNetworkTime } from '../session/apis/snode_api/getNetworkTime';
import { FEATURE_RELEASE_TIMESTAMPS } from '../session/constants';
import { ConfigurationSync } from '../session/utils/job_runners/jobs/ConfigurationSyncJob';
import { assertUnreachable } from '../types/sqlSharedTypes';
import { Storage } from './storage';

let isDisappearingMessageFeatureReleased: boolean | undefined;
let isUserConfigLibsessionFeatureReleased: boolean | undefined;
// TODO DO NOT MERGE Remove export after QA
export type FeatureNameTracked = 'disappearing_messages' | 'user_config_libsession';

/**
 * This is only intended for testing. Do not call this in production.
 */
export function resetFeatureReleasedCachedValue() {
  isDisappearingMessageFeatureReleased = undefined;
  isUserConfigLibsessionFeatureReleased = undefined;
}

// eslint-disable-next-line consistent-return
function getIsFeatureReleasedCached(featureName: FeatureNameTracked) {
  switch (featureName) {
    case 'disappearing_messages':
      return isDisappearingMessageFeatureReleased;
    case 'user_config_libsession':
      return isUserConfigLibsessionFeatureReleased;
    default:
      assertUnreachable(featureName, 'case not handled for getIsFeatureReleasedCached');
  }
}

function setIsFeatureReleasedCached(featureName: FeatureNameTracked, value: boolean) {
  switch (featureName) {
    case 'disappearing_messages':
      isDisappearingMessageFeatureReleased = value;
      break;
    case 'user_config_libsession':
      isUserConfigLibsessionFeatureReleased = value;
      break;
    default:
      assertUnreachable(featureName, 'case not handled for setIsFeatureReleasedCached');
  }
}

// eslint-disable-next-line consistent-return
function getFeatureReleaseTimestamp(featureName: FeatureNameTracked) {
  switch (featureName) {
    case 'disappearing_messages':
      return FEATURE_RELEASE_TIMESTAMPS.DISAPPEARING_MESSAGES_V2;
    case 'user_config_libsession':
      return FEATURE_RELEASE_TIMESTAMPS.USER_CONFIG;
    default:
      assertUnreachable(featureName, 'case not handled for getFeatureReleaseTimestamp');
  }
}

function featureStorageItemId(featureName: FeatureNameTracked) {
  return `featureReleased-${featureName}`;
}

export async function getIsFeatureReleased(featureName: FeatureNameTracked): Promise<boolean> {
  if (getIsFeatureReleasedCached(featureName) === undefined) {
    // read values from db and cache them as it looks like we did not
    const oldIsFeatureReleased = Boolean(Storage.get(featureStorageItemId(featureName)));
    // values do not exist in the db yet. Let's store false for now in the db and update our cached value.
    if (oldIsFeatureReleased === undefined) {
      await Storage.put(featureStorageItemId(featureName), false);
      setIsFeatureReleasedCached(featureName, false);
    } else {
      setIsFeatureReleasedCached(featureName, oldIsFeatureReleased);
    }
  }
  return Boolean(getIsFeatureReleasedCached(featureName));
}

async function checkIsFeatureReleased(featureName: FeatureNameTracked): Promise<boolean> {
  const featureAlreadyReleased = await getIsFeatureReleased(featureName);

  // Is it time to release the feature based on the network timestamp?
  if (
    !featureAlreadyReleased &&
    GetNetworkTime.getNowWithNetworkOffset() >= getFeatureReleaseTimestamp(featureName)
  ) {
    window.log.info(`[releaseFeature]: It is time to release ${featureName}. Releasing it now`);
    await Storage.put(featureStorageItemId(featureName), true);
    setIsFeatureReleasedCached(featureName, true);
    // trigger a sync right away so our user data is online
    await ConfigurationSync.queueNewJobIfNeeded();
  }

  const isReleased = Boolean(getIsFeatureReleasedCached(featureName));
  // window.log.debug(
  //   `[releaseFeature]: "${featureName}" ${isReleased ? 'is released' : 'has not been released yet'}`
  // );
  return isReleased;
}

async function checkIsUserConfigFeatureReleased() {
  return checkIsFeatureReleased('user_config_libsession');
}

async function checkIsDisappearMessageV2FeatureReleased() {
  return (
    (await checkIsFeatureReleased('disappearing_messages')) ||
    !!process.env.MULTI?.toLocaleLowerCase().includes('disappear_v2')
  ); // FIXME to remove after QA
}

function isUserConfigFeatureReleasedCached(): boolean {
  return !!isUserConfigLibsessionFeatureReleased;
}

// NOTE Make sure to call checkIsDisappearMessageV2FeatureReleased at least once and then use this. It's mostly used in components that are rendered where we don't want to do async calls
function isDisappearMessageV2FeatureReleasedCached(): boolean {
  return (
    !!isDisappearingMessageFeatureReleased ||
    !!process.env.MULTI?.toLocaleLowerCase().includes('disappear_v2') // FIXME to remove after QA
  );
}

export const ReleasedFeatures = {
  checkIsUserConfigFeatureReleased,
  checkIsDisappearMessageV2FeatureReleased,
  isUserConfigFeatureReleasedCached,
  isDisappearMessageV2FeatureReleasedCached,
};
