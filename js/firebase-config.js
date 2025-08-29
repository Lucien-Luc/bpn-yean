// Firebase Configuration
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// Firebase configuration - these will be provided via environment variables
const firebaseConfig = {
    apiKey: "AIzaSyC_example_key_will_be_replaced",
    authDomain: "project-id.firebaseapp.com",
    projectId: "project-id",
    storageBucket: "project-id.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:example"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore
export const db = getFirestore(app);

// Collection names
export const COLLECTIONS = {
    SUBMISSIONS: 'survey_submissions',
    ACTIVITY: 'survey_activity',
    METADATA: 'survey_metadata'
};

// Utility function to check Firebase connection
export const checkFirebaseConnection = async () => {
    try {
        // Simple test to verify Firestore connection
        const testDoc = await getFirestore().doc('test/connection').get();
        console.log('Firebase connection successful');
        return true;
    } catch (error) {
        console.error('Firebase connection failed:', error);
        return false;
    }
};
