import { useDispatch, useSelector } from 'react-redux';
import { IconButton } from '@mui/material';
import { AddOutlined } from '@mui/icons-material';

import { PrincipalLayout } from '../layout/PrincipalLayout';
import { NoteView, NothingSelectedView } from '../views';
import { startNewNote } from '../../store/app/thunks';

export const PrincipalPage = () => {

  const dispatch = useDispatch();
  const { isSaving, active } = useSelector( state => state.app );

  const onClickNewNote = () => {
    // dispatch( startNewNote() );
  }

  return (
    <PrincipalLayout>
      
      


      <IconButton
        onClick={ onClickNewNote }
        size='large'
        disabled={ isSaving }
        sx={{
          color: 'white',
          backgroundColor: 'error.main',
          ':hover': { backgroundColor: 'error.main', opacity: 0.9 },
          position: 'fixed',
          right: 50,
          bottom: 50
        }}
      >
        <AddOutlined sx={{ fontSize: 30 }} />
      </IconButton>

    </PrincipalLayout>
  )
}
