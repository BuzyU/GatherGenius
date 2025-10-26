// Example usage of the centralized Firebase configuration

import { initializeFirebase } from '../config/firebase-config.js';
import firebaseAuth from '../config/firebase-auth.js';

// Initialize Firebase once
initializeFirebase();

// Example authentication usage
async function handleLogin(email, password) {
    try {
        await firebaseAuth.signIn(email, password);
        // Handle successful login
    } catch (error) {
        // Handle login error
        console.error('Login failed:', error);
    }
}

// Example of listening to auth state changes
firebaseAuth.onAuthStateChanged((user) => {
    if (user) {
        // User is signed in
        console.log('User signed in:', user.email);
    } else {
        // User is signed out
        console.log('User signed out');
    }
});