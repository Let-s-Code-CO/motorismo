import { Box, Divider, Drawer, Grid, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Toolbar, Typography } from '@mui/material'
import { TurnedInNot } from '@mui/icons-material';
import { useSelector } from 'react-redux';
import { SideBarItem } from './';
import { useNavigate } from 'react-router';

import menus from "../menus/menus";

export const SideBar = ({ drawerWidth = 240 }) => {

    const { displayName, role } = useSelector( state => state.auth );

    const navigate = useNavigate();

    /*
    Nice to have 

 

•⁠  ⁠[ ] Registro de clientes (nombre, placa, #cel, correo, y tipo de moto) 
•⁠  ⁠[ ] Si ya está registrado (mostrar datos de registro, número de lavadas totales y 2 últimas lavadas hechas) 
•⁠  ⁠[ ] Lista de servicios disponible para elegir con (otros) para ahí poner un servicio que no esté pre cargado y tenga un valor diferente 
•⁠  ⁠[ ] Lista de empleados para asociarlos al servicio 
•⁠  ⁠[ ] (Solo si es posible) envío de mensaje al WhatsApp para confirmar el servicio con el cliente y vea el valor del servicio 

Interface de admin 

•⁠  ⁠[ ] Listado de clientes 
•⁠  ⁠[ ] Listado de servicios con filtro por fecha, empleados y placa  
•⁠  ⁠[ ] Posibilidad de exportar listado de servicios hechos por un empleado en cierta fecha con la suma al final de todos los servicios hechos
    */

    const onClickName = () => {
        navigate('/', { replace: true });
    };

    return (
        <Box
            component='nav'
            sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
        >
            <Drawer
                variant='permanent' // temporary
                open
                sx={{ 
                    display: { xs: 'block' },
                    '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth }
                }}
            >
                <Toolbar style={{cursor: 'pointer'}}>
                    <Typography variant='h6' noWrap component='div' onClick={onClickName}>
                        { displayName }{ role ? ` - ${role}` : '' }
                    </Typography>
                </Toolbar>
                <Divider />

                <List>
                    {
                        menus.filter(({ admin }) => !admin || (admin && role === 'admin')).map( menu => (
                            <SideBarItem key={ menu.id } { ...menu } />
                        ))
                    }
                </List>

            </Drawer>

        </Box>
    )
}
