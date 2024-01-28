import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthRoutes } from '../auth/routes/AuthRoutes';

import { PrincipalRoutes } from '../app/routes/PrincipalRoutes';
import { CheckingAuth } from '../ui/';
import { useCheckAuth } from '../hooks';

export const AppRouter = () => {
  const status = useCheckAuth();

  const base = import.meta.env.REACT_BASE_URL;

  if ( status === 'checking' ) {
    return <CheckingAuth />
  }

  return (
    <Routes>
        {
          (status === 'authenticated')
           ? <Route path={`${base}/*`} element={ <PrincipalRoutes /> } />
           : <Route path={`${base}/auth/*`} element={ <AuthRoutes /> } />
        }

        <Route path={`${base}/*`} element={ <Navigate to={`${base}/auth/login`} />  } />
        <Route path="/" element={ <Navigate to={`${base}/`} />  } />

    </Routes>
  )
}
