// ============================================
// FIREBASE CONFIGURATION - CENTRAL SOURCE
// ============================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { 
    getAuth, 
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
    reauthenticateWithCredential,
    EmailAuthProvider,
    verifyBeforeUpdateEmail
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    doc, 
    getDoc, 
    getDocs, 
    setDoc, 
    updateDoc, 
    deleteDoc, 
    addDoc, 
    query, 
    where, 
    orderBy, 
    limit, 
    startAfter, 
    onSnapshot, 
    Timestamp, 
    increment, 
    arrayUnion, 
    arrayRemove, 
    writeBatch,
    runTransaction,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

// ============================================
// FIREBASE CONFIG
// ============================================
const firebaseConfig = {
    apiKey: "AIzaSyAfGWLLJ-bmMrbkhLkdwhxIo2QrW7mYKQA",
    authDomain: "sweet-and-sour-aa364.firebaseapp.com",
    projectId: "sweet-and-sour-aa364",
    storageBucket: "sweet-and-sour-aa364.firebasestorage.app",
    messagingSenderId: "1046434031562",
    appId: "1:1046434031562:web:b325998964afbfe4105133"
};

// ============================================
// INITIALIZE SERVICES - SINGLE INSTANCE
// ============================================
console.log('🚀 Initializing Firebase...');
const app = initializeApp(firebaseConfig);
console.log('✅ Firebase initialized successfully');

export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

// ============================================
// BUSINESS / CONTACT CONSTANTS
// ============================================
export const BUSINESS_PHONE = '76982 42215';
export const BUSINESS_PHONE_TEL = 'tel:7698242215';
export const BUSINESS_WHATSAPP = '917698242215';

// ============================================
// PRODUCTION URL DETECTION
// ============================================
export function getBaseUrl() {
    return window.location.origin;
}

export function getProductUrl(productId) {
    return `${getBaseUrl()}/product.html?id=${productId}`;
}

export function getCategoryUrl(categoryId) {
    return `${getBaseUrl()}/products.html?category=${categoryId}`;
}

// ============================================
// IMGBB API KEY - FOR IMAGE UPLOADS
// ============================================
export const IMGBB_API_KEY = "639aa842e060c291cb227393f895ff9e";

// ============================================
// SKU-AWARE PRODUCT SEARCH (SHARED UTILITY)
// ============================================
export function searchProducts(products, queryText) {
    if (!Array.isArray(products)) return [];
    if (!queryText || queryText.trim().length < 1) return [];

    const q = queryText.trim().toLowerCase();

    return products.filter(product => {
        if (!product) return false;

        if (product.name && String(product.name).toLowerCase().includes(q)) return true;
        if (product.categoryName && String(product.categoryName).toLowerCase().includes(q)) return true;
        if (product.category && String(product.category).toLowerCase().includes(q)) return true;
        if (product.description && String(product.description).toLowerCase().includes(q)) return true;
        if (product.brand && String(product.brand).toLowerCase().includes(q)) return true;

        if (Array.isArray(product.flavours)) {
            for (const flavour of product.flavours) {
                if (flavour && String(flavour).toLowerCase().includes(q)) return true;
            }
        }

        const sku = product.sku || product.SKU || product.productSku || product.productSKU || '';
        if (sku) {
            const skuLower = String(sku).toLowerCase();
            if (skuLower.includes(q)) return true;
        }

        return false;
    });
}

// ============================================
// SAFE FIRESTORE ERROR HANDLER
// ============================================
export function isPermissionError(error) {
    return error && (error.code === 'permission-denied' || 
                     (error.message && error.message.includes('permission-denied')));
}

export function isOfflineError(error) {
    return error && (error.code === 'unavailable' || 
                     (error.message && error.message.includes('unavailable')));
}

// ============================================
// SAFE PUBLIC PRODUCT QUERY HELPER
// Only queries active products — rules-compatible for public reads.
// ============================================
export function buildActiveProductsQuery(opts = {}) {
    const constraints = [where('isActive', '==', true)];
    if (opts.categoryId) {
        constraints.push(where('categoryId', '==', opts.categoryId));
    }
    return query(collection(db, 'products'), ...constraints);
}

// ============================================
// IMGBB IMAGE UPLOAD FUNCTIONS
// ============================================
export async function uploadImageToImgBB(file, onProgress = null) {
    return new Promise((resolve, reject) => {
        const formData = new FormData();
        formData.append('key', IMGBB_API_KEY);
        formData.append('image', file);

        const xhr = new XMLHttpRequest();
        
        xhr.upload.addEventListener('progress', (e) => {
            if (onProgress && e.lengthComputable) {
                const progress = (e.loaded / e.total) * 100;
                onProgress(progress);
            }
        });

        xhr.addEventListener('load', () => {
            try {
                const response = JSON.parse(xhr.responseText);
                if (response.success) {
                    resolve({
                        url: response.data.url,
                        name: file.name,
                        size: file.size,
                        type: file.type,
                        displayUrl: response.data.display_url || response.data.url
                    });
                } else {
                    reject(new Error(response.error?.message || 'ImgBB upload failed'));
                }
            } catch (error) {
                reject(new Error('Failed to parse ImgBB response: ' + error.message));
            }
        });

        xhr.addEventListener('error', () => {
            reject(new Error('Network error during image upload'));
        });

        xhr.addEventListener('abort', () => {
            reject(new Error('Upload cancelled'));
        });

        xhr.open('POST', 'https://api.imgbb.com/1/upload');
        xhr.send(formData);
    });
}

export async function uploadMultipleImagesToImgBB(files, onProgress = null) {
    const results = [];
    let completed = 0;
    const total = files.length;

    for (const file of files) {
        try {
            const result = await uploadImageToImgBB(file, (progress) => {
                if (onProgress) {
                    const overallProgress = ((completed + (progress / 100)) / total) * 100;
                    onProgress(overallProgress);
                }
            });
            results.push({ success: true, ...result });
            completed++;
            if (onProgress) onProgress((completed / total) * 100);
        } catch (error) {
            console.error('📸 ImgBB upload error:', error);
            results.push({ success: false, error: error.message, name: file.name });
            completed++;
            if (onProgress) onProgress((completed / total) * 100);
        }
    }

    return results;
}

export function validateImageFile(file) {
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    const maxSize = 5 * 1024 * 1024;
    
    if (!validTypes.includes(file.type)) {
        return { valid: false, error: 'Please select a valid image file (JPG, PNG, WEBP, GIF)' };
    }
    
    if (file.size > maxSize) {
        return { valid: false, error: 'Image size must be less than 5MB' };
    }
    
    if (file.size === 0) {
        return { valid: false, error: 'File is empty' };
    }
    
    return { valid: true, error: null };
}

// ============================================
// USER ACCOUNT SETUP FUNCTIONS
// ============================================
export function isProfileComplete(userData) {
    if (!userData) return false;
    return userData.profileComplete === true;
}

export function needsAccountSetup(userData) {
    if (!userData) return false;
    return userData.profileComplete !== true;
}

export async function updateUserPhone(uid, phone) {
    try {
        const docRef = doc(db, 'users', uid);
        await updateDoc(docRef, { phone, updatedAt: Timestamp.now() });
        return { success: true, error: null };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

export async function updateUserEmailInFirestore(uid, email) {
    try {
        const docRef = doc(db, 'users', uid);
        await updateDoc(docRef, { email, updatedAt: Timestamp.now() });
        return { success: true, error: null };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

export async function completeAccountSetup(uid, data) {
    try {
        const docRef = doc(db, 'users', uid);
        const updateData = {
            profileComplete: true,
            phone: data.phone || '',
            updatedAt: Timestamp.now()
        };
        if (data.email) updateData.email = data.email;
        await updateDoc(docRef, updateData);
        return { success: true, error: null };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

export async function getUserData(uid) {
    try {
        const docRef = doc(db, 'users', uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) return { id: docSnap.id, ...docSnap.data() };
        return null;
    } catch (error) {
        return null;
    }
}

export async function createOrUpdateUser(uid, data) {
    try {
        const docRef = doc(db, 'users', uid);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            await updateDoc(docRef, { ...data, updatedAt: Timestamp.now() });
        } else {
            await setDoc(docRef, {
                uid, ...data,
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now()
            });
        }
        return { success: true, error: null };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// ============================================
// REVIEWS - PUBLIC READ HELPERS
// ============================================
export async function getApprovedReviews(productId) {
    if (!productId) {
        return { success: true, reviews: [], averageRating: 0, totalCount: 0 };
    }
    try {
        const q = query(
            collection(db, 'reviews'),
            where('productId', '==', productId),
            where('status', '==', 'approved')
        );
        const snap = await getDocs(q);
        const reviews = [];
        snap.forEach(docSnap => {
            reviews.push({ id: docSnap.id, ...docSnap.data() });
        });
        reviews.sort((a, b) => {
            const da = a.createdAt?.toDate?.() || 0;
            const db_ = b.createdAt?.toDate?.() || 0;
            return new Date(db_) - new Date(da);
        });
        
        const totalCount = reviews.length;
        const averageRating = totalCount > 0 
            ? reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / totalCount 
            : 0;
        
        return { success: true, reviews, averageRating, totalCount };
    } catch (error) {
        if (isPermissionError(error)) {
            console.warn('⚠️ Reviews read permission denied for product', productId);
        } else {
            console.warn('⚠️ Reviews temporarily unavailable:', error.message);
        }
        return { success: false, reviews: [], averageRating: 0, totalCount: 0, error: error.message };
    }
}

export async function getReviewCountsForProducts(productIds) {
    if (!productIds || productIds.length === 0) {
        return { success: true, counts: {} };
    }
    try {
        const counts = {};
        const batches = [];
        const batchSize = 30;
        for (let i = 0; i < productIds.length; i += batchSize) {
            batches.push(productIds.slice(i, i + batchSize));
        }
        
        for (const batch of batches) {
            const q = query(
                collection(db, 'reviews'),
                where('productId', 'in', batch),
                where('status', '==', 'approved')
            );
            const snap = await getDocs(q);
            snap.forEach(docSnap => {
                const data = docSnap.data();
                const pid = data.productId;
                if (!counts[pid]) counts[pid] = { count: 0, totalRating: 0 };
                counts[pid].count++;
                counts[pid].totalRating += (data.rating || 0);
            });
        }
        
        const result = {};
        for (const pid in counts) {
            result[pid] = {
                count: counts[pid].count,
                averageRating: counts[pid].count > 0 ? counts[pid].totalRating / counts[pid].count : 0
            };
        }
        
        return { success: true, counts: result };
    } catch (error) {
        console.warn('⚠️ Review counts unavailable:', error.message);
        return { success: false, counts: {} };
    }
}

// ============================================
// EXPORT ALL FUNCTIONS
// ============================================
export {
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
    reauthenticateWithCredential,
    EmailAuthProvider,
    verifyBeforeUpdateEmail,
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    deleteDoc,
    addDoc,
    query,
    where,
    orderBy,
    limit,
    startAfter,
    onSnapshot,
    Timestamp,
    increment,
    arrayUnion,
    arrayRemove,
    writeBatch,
    runTransaction,
    serverTimestamp
};

console.log('✅ Firebase services exported successfully');