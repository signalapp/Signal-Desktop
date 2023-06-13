import { GetNetworkTime } from '../session/apis/snode_api/getNetworkTime';
import { ConfigurationSync } from '../session/utils/job_runners/jobs/ConfigurationSyncJob';
import { assertUnreachable } from '../types/sqlSharedTypes';
import { Storage } from './storage';
import { FEATURE_RELEASE_TIMESTAMPS } from '../session/constants';

let isDisappearingMessageFeatureReleased: boolean | undefined;
let isUserConfigLibsessionFeatureReleased: boolean | undefined;
type FeatureNameTracked = 'disappearing_messages' | 'user_config_libsession';

/**
 * This is only intended for testing. Do not call this in production.
 */
export function resetFeatureReleasedCachedValue() {
  isDisappearingMessageFeatureReleased = undefined;
  isUserConfigLibsessionFeatureReleased = undefined;
}

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
    (GetNetworkTime.getNowWithNetworkOffset() >= getFeatureReleaseTimestamp(featureName) ||
      featureName === 'user_config_libsession') // we want to make a build which has user config enabled by default for internal testing // TODO to remove for official build
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
  return checkIsFeatureReleased('disappearing_messages');
}

function isUserConfigFeatureReleasedCached(): boolean {
  return !!isUserConfigLibsessionFeatureReleased;
}

export const ReleasedFeatures = {
  checkIsUserConfigFeatureReleased,
  checkIsDisappearMessageV2FeatureReleased,
  isUserConfigFeatureReleasedCached,
};
