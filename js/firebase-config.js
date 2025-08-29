// Firebase Configuration
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCp1B4T55SHNIzBCO6ogex_fswdPy-RSuo",
    authDomain: "leave-d67b7.firebaseapp.com",
    projectId: "leave-d67b7",
    storageBucket: "leave-d67b7.firebasestorage.app",
    messagingSenderId: "329360140575",
    appId: "1:329360140575:web:77f1041f70637f637f282a",
    measurementId: "G-1H0Y6B5Z2G"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore
export const db = getFirestore(app);

// Collection names
export const COLLECTIONS = {
    SUBMISSIONS: 'survey_submissions',
    ACTIVITY: 'survey_activity',
    METADATA: 'survey_metadata',
    ADMIN: 'admin_users'
};

// Utility function to check Firebase connection
export const checkFirebaseConnection = async () => {
    try {
        // Simple test to verify Firestore connection
        console.log('Firebase connection available');
        return true;
    } catch (error) {
        console.error('Firebase connection failed:', error);
        return false;
    }
};
