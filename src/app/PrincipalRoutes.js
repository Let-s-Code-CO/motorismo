import { Navigate, Route, Routes } from 'react-router-dom';

import { NavBar } from '../ui/NavBar';
import { IndexPage } from './IndexPage';

export const PrincipalRoutes = () => {
    return (
        <>
            <NavBar />

            <div className="container">
                <Routes>
                    <Route path="index" element={<IndexPage />} />


                    <Route path="/" element={<Navigate to="/index" />} />

                </Routes>
            </div>
        </>
    );
}