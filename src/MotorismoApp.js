import React from 'react';
import { AuthProvider } from './auth';

import { BabyShowerApp } from './components/BabyShowerApp';
import { store } from './store/store';
import { AppRouter } from './router/router';

export const MotorismoApp = () => {
    return (
        <AuthProvider>
            <AppRouter />
        </AuthProvider>
    )
}
