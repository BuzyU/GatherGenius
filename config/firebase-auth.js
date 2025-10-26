import { getFirebaseInstance } from './firebase-config.js';

class FirebaseAuth {
    constructor() {
        this.auth = getFirebaseInstance().auth();
        this.currentUser = null;
        this.authStateChanged = new Promise((resolve) => {
            this.auth.onAuthStateChanged((user) => {
                this.currentUser = user;
                resolve(user);
            });
        });
    }

    getCurrentUser() {
        return this.currentUser;
    }

    async waitForAuthReady() {
        return this.authStateChanged;
    }

    async signIn(email, password) {
        return this.auth.signInWithEmailAndPassword(email, password);
    }

    async signOut() {
        return this.auth.signOut();
    }

    async createUser(email, password) {
        return this.auth.createUserWithEmailAndPassword(email, password);
    }

    onAuthStateChanged(callback) {
        return this.auth.onAuthStateChanged(callback);
    }
}

// Create a singleton instance
const firebaseAuth = new FirebaseAuth();
export default firebaseAuth;