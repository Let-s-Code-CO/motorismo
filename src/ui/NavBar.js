import { useContext } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';

import { AuthContext } from '../auth/context/context';

export const NavBar = () => {
    const { user, logout } = useContext(AuthContext);

    const navigate = useNavigate();

    const onLogout = () => {
        logout();

        navigate('/motorismo/login', {
            replace: true
        });
    }

    return (
        <nav className="navbar navbar-expand-sm navbar-dark bg-dark p-2">

            <Link
                className="navbar-brand"
                to="/motorismo"
            >
                Home
            </Link>

            <div className="navbar-collapse">
                <div className="navbar-nav">
                    <NavLink
                        className={({ isActive }) => `nav-item nav-link  ${isActive ? 'active' : ''}`}
                        to="/motorismo/customers"
                    >
                        Clientes
                    </NavLink>
                </div>
            </div>

            <div className="navbar-collapse collapse w-100 order-3 dual-collapse2 d-flex justify-content-end">
                <ul className="navbar-nav ml-auto">

                    <li className="nav-item dropdown">
                        <a className="nav-link dropdown-toggle" href="#" id="navbarDropdown" role="button" data-bs-toggle="dropdown" aria-expanded="false">
                            {user}
                        </a>
                        <ul className="dropdown-menu" aria-labelledby="navbarDropdown">
                            <li><a class="dropdown-item" href="" onClick={onLogout}>Logout</a></li>
                        </ul>
                    </li>

                </ul>
            </div>
        </nav>
    );
}