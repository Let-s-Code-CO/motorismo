import { useMemo } from 'react'
import { useDispatch } from 'react-redux'
import { Grid, ListItem, ListItemButton, ListItemIcon, ListItemText } from '@mui/material'
import { TurnedInNot } from '@mui/icons-material';
import { setActiveNote } from '../../store/app';
import { useNavigate } from 'react-router';


export const SideBarItem = ({ title = '', url, id }) => {

    const dispatch = useDispatch();
    const navigate = useNavigate();

    const onClickMenu = () => {
        console.log(url)
        navigate(url, { replace: true });
    }

    const newTitle = useMemo( () => {
        return title.length > 30
            ? title.substring(0,17) + '...'
            : title;
    },[ title ])

  return (
    <ListItem disablePadding>
        <ListItemButton onClick={ onClickMenu }>
            {/* <ListItemIcon>
                <TurnedInNot />
            </ListItemIcon> */}
            <Grid container>
                <ListItemText primary={ newTitle } />
            </Grid>
        </ListItemButton>
    </ListItem>
  )
}
