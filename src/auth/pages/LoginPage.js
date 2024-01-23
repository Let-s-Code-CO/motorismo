import { useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/context";
import logo from '../../assets/logo.png'

export const LoginPage = () => {
    const { login, logged } = useContext(AuthContext);

    const navigate = useNavigate();

    const onLogin = () => {
        login('cambiar@gmail.com');

        navigate('/motorismo', { replace: true });
    }

    return (
        <div className="login-container">
            <div className="card p-5">
                <img src={logo} />
                <h2 className="mb-4">Motorismo Detailing</h2>
                <form>
                    <div className="mb-3">
                        <label htmlFor="exampleInputEmail1" className="form-label">Email address</label>
                        <input type="email" className="form-control" id="exampleInputEmail1" aria-describedby="emailHelp" />
                    </div>
                    <div className="mb-3">
                        <label htmlFor="exampleInputPassword1" className="form-label">Password</label>
                        <input type="password" className="form-control" id="exampleInputPassword1" />
                    </div>
                    <button type="button" className="btn btn-primary" onClick={onLogin}>Login</button>
                </form>
            </div>
        </div>
    );
};
