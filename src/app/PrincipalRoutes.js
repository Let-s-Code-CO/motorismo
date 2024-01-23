import { Navigate, Route, Routes } from 'react-router-dom';

import { NavBar } from '../ui/NavBar';
import { IndexPage } from './IndexPage';

export const PrincipalRoutes = () => {
    return (
        <>
            <NavBar />

            <div className="container">
                <Routes>
                    <Route path="/motorismo/index" element={<IndexPage />} />


                    <Route path="/motorismo/" element={<Navigate to="/motorismo/index" />} />

                </Routes>
            </div>
        </>
    );
}