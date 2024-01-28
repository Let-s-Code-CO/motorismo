import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    GoogleAuthProvider,
    signInWithPopup,
    updateProfile,
} from 'firebase/auth';
import { FirebaseAuth } from './config';

const googleProvider = new GoogleAuthProvider();

export const singInWithGoogle = async () => {

    try {

        const result = await signInWithPopup(FirebaseAuth, googleProvider);
        // const credentials = GoogleAuthProvider.credentialFromResult( result );
        const { displayName, email, photoURL, uid, role } = result.user;

        return {
            ok: true,
            // User info
            displayName, email, photoURL, uid, role
        }


    } catch (error) {

        const errorCode = error.code;
        const errorMessage = error.message;

        return {
            ok: false,
            errorMessage,
        }
    }

}

export const registerUserWithEmailPassword = async ({ email, password, displayName, role = 'admin' }) => {

    try {
        const resp = await createUserWithEmailAndPassword(FirebaseAuth, email, password);
        const { uid, photoURL } = resp.user;

        // displayName = JSON.stringify({displayName, role});

        await updateProfile(FirebaseAuth.currentUser, { displayName });

        return {
            ok: true,
            uid, photoURL, email, displayName, role
        }

    } catch (error) {
        console.log(error);
        return { ok: false, errorMessage: error.message }
    }

}

export const loginWithEmailPassword = async ({ email, password }) => {

    try {
        const resp = await signInWithEmailAndPassword(FirebaseAuth, email, password);
        let { uid, photoURL, displayName, role = '' } = resp.user;

        try {
            const { displayName: name, role: roleName } = JSON.parse(displayName);

            displayName = name;
            role = roleName;
        } catch (e) {
            // NOTHING
        }

        return {
            ok: true,
            uid, photoURL, displayName, role
        }

    } catch (error) {
        return { ok: false, errorMessage: error.message }
    }
}

export const logoutFirebase = async () => {
    return await FirebaseAuth.signOut();
}
