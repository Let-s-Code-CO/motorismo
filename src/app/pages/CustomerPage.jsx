import { useDispatch, useSelector } from 'react-redux';
import { IconButton } from '@mui/material';
import { AddOutlined } from '@mui/icons-material';

import { PrincipalLayout } from '../layout/PrincipalLayout';
import { startNewNote } from '../../store/app/thunks';

export const CustomerPage = () => {
  const dispatch = useDispatch();
  const { isSaving, active } = useSelector( state => state.app );

  const onClickNewNote = () => {
    dispatch( startNewNote() );
  }

  return (
    <PrincipalLayout>
      
      {'Acá estará la creación de clientes'}

    </PrincipalLayout>
  )
}
