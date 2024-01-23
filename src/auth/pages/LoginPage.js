import { useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/context";

export const LoginPage = () => {
    const { login } = useContext(AuthContext);

    const navigate = useNavigate();

    const onLogin = () => {
        login('cambiar@gmail.com');

        navigate('/motorismo', { replace: true })
    }

    return (
        <div>
            <h1>Login</h1>
            <hr />
            <input type="email" />
            <button onClick={onLogin}>Login</button>
        </div>
    );
};
