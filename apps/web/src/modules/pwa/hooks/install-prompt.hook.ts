'use client';

import { useSyncExternalStore } from 'react';

import {
  getInstallOption,
  getServerInstallOption,
  subscribeInstallOption,
} from '@web/modules/pwa/utils/install-prompt.lib';

/** How the app can be installed on this device right now (spec 006, HU-03). */
const useInstallPrompt = () =>
  useSyncExternalStore(subscribeInstallOption, getInstallOption, getServerInstallOption);

export default useInstallPrompt;
