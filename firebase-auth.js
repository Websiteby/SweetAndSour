// ============================================
// FIREBASE AUTH - SHARED SAFE AUTH HELPERS
// ============================================
import {
    auth,
    db,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    sendPasswordResetEmail,
    sendEmailVerification,
    GoogleAuthProvider,
    signInWithPopup,
    updateEmail,
    updatePassword,
    updateProfile,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    Timestamp,
    isPermissionError
} from './firebase-config.js';

// ============================================
// LOAD USER PROFILE SAFELY
// Never throws. Falls back to guest-like data if read denied.
// ============================================
export async function loadUserProfile(user) {
    if (!user) return null;
    try {
        const ref = doc(db, 'users', user.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
            return snap.data();
        }
        // Auto-create minimal profile
        const newProfile = {
            uid: user.uid,
            name: user.displayName || user.email?.split('@')[0] || 'User',
            email: user.email || '',
            phone: '',
            role: 'customer',
            status: 'active',
            profileComplete: false,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
        };
        await setDoc(ref, newProfile);
        return newProfile;
    } catch (error) {
        if (isPermissionError(error)) {
            console.warn('🔒 loadUserProfile: read denied — using fallback');
        } else {
            console.warn('⚠️ loadUserProfile error:', error.message);
        }
        return {
            uid: user.uid,
            name: user.displayName || user.email?.split('@')[0] || 'User',
            email: user.email || '',
            role: 'customer',
            status: 'active'
        };
    }
}

// ============================================
// CHECK IF USER IS ADMIN (SAFE)
// ============================================
export async function checkIsAdmin(user) {
    if (!user) return false;
    try {
        const ref = doc(db, 'users', user.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
            const data = snap.data();
            return data.role === 'admin' && data.status === 'active';
        }
        return false;
    } catch (error) {
        if (isPermissionError(error)) {
            console.warn('🔒 checkIsAdmin: read denied');
        } else {
            console.warn('⚠️ checkIsAdmin error:', error.message);
        }
        return false;
    }
}

// ============================================
// RE-EXPORT AUTH PRIMITIVES
// ============================================
export {
    auth,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    sendPasswordResetEmail,
    sendEmailVerification,
    GoogleAuthProvider,
    signInWithPopup,
    updateEmail,
    updatePassword,
    updateProfile,
    updateDoc
};