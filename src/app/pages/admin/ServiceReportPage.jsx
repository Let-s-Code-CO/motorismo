import { useDispatch, useSelector } from 'react-redux';
import { IconButton } from '@mui/material';
import { AddOutlined } from '@mui/icons-material';

import { PrincipalLayout } from '../../layout/PrincipalLayout';
import { startNewNote } from '../../../store/app/thunks';

export const ServiceReportPage = () => {
  const dispatch = useDispatch();
  const { isSaving, active } = useSelector( state => state.app );

  const onClickNewNote = () => {
    dispatch( startNewNote() );
  }

  return (
    <PrincipalLayout>
      
      {'Acá estará el reporte de servicios'}

    </PrincipalLayout>
  )
}
