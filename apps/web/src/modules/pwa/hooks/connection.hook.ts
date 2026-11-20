'use client';

import { useSyncExternalStore } from 'react';

import {
  getConnectionSnapshot,
  getServerConnectionSnapshot,
  subscribeConnection,
} from '@web/modules/pwa/utils/connection.lib';

/** Whether the app has network right now (spec 006, HU-02). */
const useConnection = () =>
  useSyncExternalStore(subscribeConnection, getConnectionSnapshot, getServerConnectionSnapshot);

export default useConnection;
