import { Grid, Typography } from '@mui/material';
import logo from '../../assets/logo.png';

export const AuthLayout = ({ children, title = '' }) => {
  return (
    
    <Grid
      container
      spacing={ 0 }
      display={"flex"}
      direction="column"
      alignItems="center"
      justifyContent="center"
      sx={{ minHeight: '100vh', backgroundColor: 'primary.main', padding: 4 }}
    >

      <Grid item
        className='box-shadow'
        display={"flex"}
        direction="column"
        alignItems="center"
        justifyContent="center"
        xs={ 3 }
        sx={{ 
            width: { sm: 450 },
            backgroundColor: 'white', 
            padding: 3, 
            borderRadius: 2 
        }}>

          <img src={logo} />
          
          <Typography variant='h5' sx={{ mb: 1 }}>{ title }</Typography>

            
          { children }

        </Grid>

    </Grid>

  )
}
