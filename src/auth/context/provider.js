import { useReducer } from 'react';
import { AuthContext } from './context';
import { authReducer } from './reducer';
import { types } from '../types/types';

const init = () => {
    const email = localStorage.getItem('email');

    return {
        logged: !!email,
        user: email,
    };
};

export const AuthProvider = ({ children }) => {
    const [ authState, dispatch ] = useReducer(authReducer, {}, init);

    const login = (email = '') => {
        const action = {
            type: types.login,
            payload: email,
        };

        localStorage.setItem('email', email);

        dispatch(action)
    };

    const logout = () => {
        localStorage.removeItem('email');

        const action = {
            type: types.logout,
        };

        dispatch(action);
    }

    return (
        <AuthContext.Provider value={{ ...authState, login, logout }}>
            { children }
        </AuthContext.Provider>
    )
}