import { Route, Routes } from 'react-router-dom';

import { LoginPage } from '../auth';
import { PrincipalRoutes } from '../app';
import { PrivateRouter } from './private';

export const AppRouter = () => {
  return (
    <>

      <Routes>

        <Route path="/login" element={<LoginPage />} />

        <Route path="/*" element={
          <PrivateRouter>
            <PrincipalRoutes />
          </PrivateRouter>
        } />

      </Routes>

    </>
  )
}