import { useSelector } from "react-redux";
import { Navigate, Route, Routes } from "react-router-dom";
import { PrincipalPage } from "../pages/PrincipalPage";
import { OrderPage } from "../pages/OrderPage";
import menus from "../menus/menus";

export const PrincipalRoutes = () => {
  const { role } = useSelector(state => state.auth);

  return (
    <Routes>
      <Route path="/" element={<PrincipalPage />} />

      {menus.filter(({ admin }) => !admin || (admin && role === 'admin')).map(menu => {
        const Component = menu.component;

        return <Route key={menu.id} path={menu.url} element={<Component />} />
      })}

      <Route path="/*" element={<Navigate to="/" />} />
    </Routes>
  )
}
