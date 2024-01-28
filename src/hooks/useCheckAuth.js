import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { onAuthStateChanged } from 'firebase/auth';

import { FirebaseAuth } from '../firebase/config';
import { login, logout } from '../store/auth';
import { startLoadingNotes } from '../store/app';



export const useCheckAuth = () => {
  
    const { status } = useSelector( state => state.auth );
    const dispatch = useDispatch();

    useEffect(() => {
        
        onAuthStateChanged( FirebaseAuth, async( user ) => {
            if ( !user ) return dispatch( logout() );

            let { uid, email, displayName, photoURL, role } = user;
            
            try {
                const data = JSON.parse(displayName);

                displayName = data.displayName;
                role = data.role;
            } catch (e) {
                //NOTHING
            }

            dispatch( login({ uid, email, displayName, photoURL, role }) );
            dispatch( startLoadingNotes() );
        })
    }, []);

    return status;
}
