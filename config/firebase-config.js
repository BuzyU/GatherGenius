// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCKd_iH-McAMrKI_0YDoYG0xjn2KrQpTOQ",
    authDomain: "notifyme-events.firebaseapp.com",
    projectId: "notifyme-events",
    storageBucket: "notifyme-events.appspot.com",
    messagingSenderId: "1077508634843",
    appId: "1:1077508634843:web:7ca7cb88514a456c6d7ec1",
    measurementId: "G-Y0M1ZQLJLF"
};

// Initialize Firebase
let firebaseInstance = null;

export function initializeFirebase() {
    if (!firebaseInstance) {
        firebaseInstance = firebase.initializeApp(firebaseConfig);
    }
    return firebaseInstance;
}

export function getFirebaseConfig() {
    return firebaseConfig;
}

export function getFirebaseInstance() {
    if (!firebaseInstance) {
        initializeFirebase();
    }
    return firebaseInstance;
}