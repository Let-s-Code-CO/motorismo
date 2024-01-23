import { Navigate, Route, Routes } from 'react-router-dom';

import { NavBar } from '../ui/NavBar';
import { IndexPage } from './IndexPage';
import { CustomersPage } from './CustomersPage';

export const PrincipalRoutes = () => {
    return (
        <>
            <NavBar />

            <div className="container-fluid">
                <Routes>
                    <Route path="/" element={<IndexPage />} />

                    <Route path="/customers" element={<CustomersPage />} />

                    <Route path="/motorismo" element={<Navigate to="/" />} />

                </Routes>
            </div>
        </>
    );
}