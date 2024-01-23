import { Navigate, Route, Routes } from 'react-router-dom';

import { LoginPage } from '../auth';
import { PrincipalRoutes } from '../app';
import { PrivateRouter } from './private';

export const AppRouter = () => {
  return (
    <>

      <Routes>

        <Route path="/motorismo/login" element={<LoginPage />} />

        <Route path="/motorismo/*" element={
          <PrivateRouter>
            <PrincipalRoutes />
          </PrivateRouter>
        } />

        <Route path="/" element={<Navigate to="/motorismo" />} />

      </Routes>

    </>
  )
}