'use client';

import { createContext, useContext } from 'react';

/** Whether a new version is live, checked once for the whole app by PwaProvider (spec 006). */
export const NewVersionContext = createContext(false);

/** Read by the notices that share the bottom of the screen (CA-15, CA-20). */
const useHasNewVersion = () => useContext(NewVersionContext);

export default useHasNewVersion;
