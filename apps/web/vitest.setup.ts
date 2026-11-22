import '@testing-library/jest-dom/vitest';

import { resetToasts } from '@web/modules/core/lib/toast.lib';

// The floating notices live in memory for the whole run: each test starts with none (spec 013).
beforeEach(() => resetToasts());
