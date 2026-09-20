// ============================================
// MAIN APPLICATION - GLOBAL STATE & INIT
// ============================================
import { 
    auth, db,
    onAuthStateChanged, signOut,
    collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc,
    query, where, orderBy, limit, startAfter, onSnapshot, Timestamp, increment,
    serverTimestamp, arrayUnion, arrayRemove, writeBatch, runTransaction,
    BUSINESS_PHONE, BUSINESS_PHONE_TEL, BUSINESS_WHATSAPP
} from './firebase-config.js';

// ============================================
// GLOBAL STATE
// ============================================
export const state = {
    currentUser: null,
    userData: null,
    userRole: 'guest',
    isAdmin: false,
    products: [],
    categories: [],
    banners: [],
    orders: [],
    users: [],
    cart: [],
    wishlist: [],
    cartCount: 0,
    wishlistCount: 0,
    isLoading: false,
    isInitialized: false,
    listeners: {
        products: null,
        categories: null,
        banners: null,
        orders: null,
        users: null
    },
    isOnline: navigator.onLine,
    connectionStatus: 'online'
};

// ============================================
// NETWORK STATUS HANDLING
// ============================================
window.addEventListener('online', () => {
    state.isOnline = true;
    state.connectionStatus = 'online';
    console.log('📶 Network: Online');
});

window.addEventListener('offline', () => {
    state.isOnline = false;
    state.connectionStatus = 'offline';
    console.log('📶 Network: Offline');
});

// ============================================
// CART HELPERS (LocalStorage)
// ============================================
const CART_KEY = 'ss_cart_v1';
const WISHLIST_KEY = 'ss_wishlist_v1';
const ORDERS_KEY = 'ss_orders_v1';

export function getCart() {
    try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; } catch { return []; }
}

export function saveCart(cart) {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    updateCartCount();
}

export function getWishlist() {
    try { return JSON.parse(localStorage.getItem(WISHLIST_KEY)) || []; } catch { return []; }
}

export function saveWishlist(wishlist) {
    localStorage.setItem(WISHLIST_KEY, JSON.stringify(wishlist));
    updateWishlistCount();
}

export function getOrders() {
    try { return JSON.parse(localStorage.getItem(ORDERS_KEY)) || []; } catch { return []; }
}

export function saveOrders(orders) {
    localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
}

export function addToCart(productId, quantity = 1, product = null) {
    const cart = getCart();
    const existing = cart.find(item => item.id === productId);
    if (existing) {
        existing.qty = (existing.qty || 1) + quantity;
    } else if (product) {
        cart.push({
            id: productId,
            qty: quantity,
            price: product.price || 0,
            name: product.name || 'Product',
            image: product.thumbnail || product.images?.[0]?.url || '',
            oldPrice: product.oldPrice || product.salePrice || 0,
            category: product.categoryName || product.category || '',
            sku: product.sku || product.SKU || product.productSku || ''
        });
    } else {
        cart.push({ id: productId, qty: quantity, price: 0, name: 'Product', image: '' });
    }
    saveCart(cart);
    return cart;
}

export function removeFromCart(productId) {
    const cart = getCart();
    const newCart = cart.filter(item => item.id !== productId);
    saveCart(newCart);
    return newCart;
}

export function updateCartQuantity(productId, quantity) {
    if (quantity <= 0) return removeFromCart(productId);
    const cart = getCart();
    const item = cart.find(i => i.id === productId);
    if (item) { item.qty = quantity; saveCart(cart); }
    return cart;
}

export function clearCart() { saveCart([]); }

export function getCartCount() {
    const cart = getCart();
    return cart.reduce((sum, item) => sum + (item.qty || 1), 0);
}

export function getCartTotal() {
    const cart = getCart();
    let subtotal = 0;
    let discount = 0;
    cart.forEach(item => {
        const price = item.price || 0;
        const qty = item.qty || 1;
        const oldPrice = item.oldPrice || price;
        subtotal += price * qty;
        discount += Math.max(0, (oldPrice - price) * qty);
    });
    const delivery = subtotal >= 499 ? 0 : 49;
    return { subtotal, discount, delivery, total: subtotal - discount + delivery };
}

export function toggleWishlist(productId) {
    const wishlist = getWishlist();
    const idx = wishlist.indexOf(productId);
    if (idx > -1) {
        wishlist.splice(idx, 1);
        saveWishlist(wishlist);
        return { action: 'removed', wishlist };
    } else {
        wishlist.push(productId);
        saveWishlist(wishlist);
        return { action: 'added', wishlist };
    }
}

export function isInWishlist(productId) {
    return getWishlist().includes(productId);
}

function updateCartCount() {
    const count = getCartCount();
    state.cartCount = count;
    const badges = document.querySelectorAll('#cartBadge, #bottomCartBadge');
    badges.forEach(badge => {
        if (badge) {
            if (count > 0) {
                badge.textContent = count;
                badge.style.display = 'block';
            } else {
                badge.style.display = 'none';
            }
        }
    });
}

function updateWishlistCount() {
    const wishlist = getWishlist();
    const count = wishlist.length;
    state.wishlistCount = count;
    const badges = document.querySelectorAll('#wishlistBadge, #bottomWishlistBadge');
    badges.forEach(badge => {
        if (badge) {
            if (count > 0) {
                badge.textContent = count;
                badge.style.display = 'block';
            } else {
                badge.style.display = 'none';
            }
        }
    });
}

// ============================================
// SKU-AWARE SEARCH HELPER
// ============================================
export function searchProducts(products, queryText) {
    if (!queryText || queryText.trim().length < 1) return [];
    const q = queryText.trim().toLowerCase();

    return products.filter(product => {
        if (product.name && product.name.toLowerCase().includes(q)) return true;
        if (product.categoryName && product.categoryName.toLowerCase().includes(q)) return true;
        if (product.category && product.category.toLowerCase().includes(q)) return true;
        if (product.description && product.description.toLowerCase().includes(q)) return true;
        if (product.brand && product.brand.toLowerCase().includes(q)) return true;
        if (product.flavours && Array.isArray(product.flavours)) {
            for (const flavour of product.flavours) {
                if (flavour.toLowerCase().includes(q)) return true;
            }
        }
        const sku = product.sku || product.SKU || product.productSku || product.productSKU || '';
        if (sku) {
            const skuLower = sku.toLowerCase();
            if (skuLower.includes(q)) return true;
            if (skuLower === q) return true;
        }
        return false;
    });
}

// ============================================
// CENTRAL ADMIN CHECK FUNCTION
// ============================================
export async function checkAdminStatus(user) {
    if (!user) return false;
    try {
        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            return data.role === 'admin';
        }
        return false;
    } catch (error) {
        if (error.code === 'permission-denied') {
            console.warn('🔒 Admin check: permission denied (user doc may not be readable)');
        } else {
            console.warn('🔒 Admin check error:', error.message);
        }
        return false;
    }
}

// ============================================
// AUTH LISTENERS
// ============================================
let authUnsubscribe = null;
let authResolve = null;
const authReady = new Promise(resolve => { authResolve = resolve; });

export function initApp() {
    console.log('🚀 Initializing Sweet & Sour App...');
    
    if (authUnsubscribe) authUnsubscribe();
    
    authUnsubscribe = onAuthStateChanged(auth, async (user) => {
        console.log('🔐 Auth state changed:', user ? 'User logged in' : 'No user');
        state.currentUser = user;
        
        if (user) {
            await loadUserData(user.uid);
        } else {
            state.userData = null;
            state.userRole = 'guest';
            state.isAdmin = false;
        }
        
        state.isInitialized = true;
        if (authResolve) { authResolve(); authResolve = null; }
        updateUI();
        updateCartCount();
        updateWishlistCount();
    });
}

export async function waitForAuth() {
    if (state.isInitialized) return;
    await authReady;
}

// ============================================
// USER DATA
// ============================================
export async function loadUserData(uid) {
    try {
        const docRef = doc(db, 'users', uid);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            state.userData = docSnap.data();
            state.userRole = state.userData.role || 'customer';
            state.isAdmin = state.userRole === 'admin';
            console.log('👤 User data loaded:', state.userData.name, 'Role:', state.userRole);
        } else {
            const newUser = {
                uid: uid,
                name: state.currentUser.displayName || state.currentUser.email?.split('@')[0] || 'User',
                email: state.currentUser.email,
                phone: '',
                role: 'customer',
                status: 'active',
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now()
            };
            await setDoc(doc(db, 'users', uid), newUser);
            state.userData = newUser;
            state.userRole = 'customer';
            state.isAdmin = false;
            console.log('✅ New user document created');
        }
        updateUI();
    } catch (error) {
        // Gracefully handle permission denied — treat as guest
        if (error.code === 'permission-denied') {
            console.warn('🔒 User doc read denied — treating as guest');
        } else {
            console.warn('⚠️ Error loading user data:', error.message);
        }
        state.userRole = 'guest';
        state.isAdmin = false;
        updateUI();
    }
}

export async function updateUserData(uid, data) {
    try {
        const docRef = doc(db, 'users', uid);
        await updateDoc(docRef, { ...data, updatedAt: Timestamp.now() });
        if (uid === state.currentUser?.uid) {
            state.userData = { ...state.userData, ...data };
            state.isAdmin = state.userData.role === 'admin';
            updateUI();
        }
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// ============================================
// AUTH FUNCTIONS
// ============================================
export async function loginUser(email, password) {
    try {
        const result = await signInWithEmailAndPassword(auth, email, password);
        return { success: true, user: result.user };
    } catch (error) {
        return { success: false, error: error.message, code: error.code };
    }
}

export async function signupUser(email, password, userData) {
    try {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        const user = result.user;
        
        await setDoc(doc(db, 'users', user.uid), {
            uid: user.uid,
            name: userData.name || user.email?.split('@')[0] || 'User',
            email: user.email,
            phone: userData.phone || '',
            role: 'customer',
            status: 'active',
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
        });
        
        return { success: true, user };
    } catch (error) {
        return { success: false, error: error.message, code: error.code };
    }
}

export async function resetPassword(email) {
    try {
        await sendPasswordResetEmail(auth, email);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message, code: error.code };
    }
}

export async function logoutUser() {
    try {
        await signOut(auth);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// ============================================
// UI UPDATE HELPER
// ============================================
function updateUI() {
    const avatarInitial = document.getElementById('avatarInitial');
    const profileIcon = document.getElementById('profileIcon');
    const adminNavItem = document.getElementById('adminNavItem');
    
    if (profileIcon) {
        profileIcon.href = state.currentUser ? 'account.html' : 'login.html';
    }
    
    if (avatarInitial) {
        if (state.currentUser && state.userData) {
            if (state.isAdmin) {
                avatarInitial.className = 'avatar-initial admin';
                avatarInitial.textContent = 'A';
                if (adminNavItem) adminNavItem.style.display = 'block';
            } else if (state.userData.name) {
                avatarInitial.className = 'avatar-initial';
                avatarInitial.textContent = state.userData.name.charAt(0).toUpperCase();
                if (adminNavItem) adminNavItem.style.display = 'none';
            } else {
                avatarInitial.className = 'avatar-initial';
                avatarInitial.textContent = state.currentUser.email?.charAt(0).toUpperCase() || 'U';
                if (adminNavItem) adminNavItem.style.display = 'none';
            }
        } else if (state.currentUser) {
            avatarInitial.className = 'avatar-initial';
            avatarInitial.textContent = state.currentUser.email?.charAt(0).toUpperCase() || 'U';
            if (adminNavItem) adminNavItem.style.display = 'none';
        } else {
            avatarInitial.className = 'avatar-initial';
            avatarInitial.textContent = 'U';
            if (adminNavItem) adminNavItem.style.display = 'none';
        }
    }
    
    updateCartCount();
    updateWishlistCount();
}

// ============================================
// SAFE LISTENER ERROR HELPER
// ============================================
function handleListenerError(name, error, callback, fallbackData = []) {
    if (error.code === 'permission-denied') {
        console.warn(`🔒 ${name} listener: permission denied — using fallback`);
    } else if (error.code === 'unavailable') {
        console.warn(`⚠️ ${name} listener: network unavailable — retrying possible`);
    } else if (error.code === 'failed-precondition') {
        console.warn(`⚠️ ${name} listener: missing index. Please deploy firestore.indexes.json`);
    } else {
        console.warn(`⚠️ ${name} listener error:`, error.message);
    }
    if (callback) callback(fallbackData);
}

// ============================================
// REAL-TIME DATA LISTENERS - SAFE
// ============================================
let listenerRetryTimeout = null;
let listenerRetryCount = 0;
const MAX_LISTENER_RETRIES = 3;

export function listenToProducts(callback) {
    if (state.listeners.products) {
        state.listeners.products();
        state.listeners.products = null;
    }
    
    try {
        // Products: public read of active products (rules allow)
        const q = query(
            collection(db, 'products'),
            where('isActive', '==', true)
        );
        
        state.listeners.products = onSnapshot(q, (snapshot) => {
            listenerRetryCount = 0;
            const products = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                products.push({
                    id: doc.id,
                    ...data,
                    thumbnail: data.thumbnail || data.imageUrl || data.images?.[0]?.url || '',
                    oldPrice: data.oldPrice || data.salePrice || 0,
                    categoryName: data.categoryName || data.category || '',
                    sku: data.sku || data.SKU || data.productSku || data.productSKU || '',
                    isActive: data.isActive !== undefined ? data.isActive : true
                });
            });
            state.products = products;
            if (callback) callback(products);
        }, (error) => {
            handleListenerError('Products', error, callback, state.products);
        });
        
        return state.listeners.products;
    } catch (error) {
        handleListenerError('Products (setup)', error, callback, []);
        return null;
    }
}

export function listenToCategories(callback) {
    if (state.listeners.categories) {
        state.listeners.categories();
        state.listeners.categories = null;
    }
    
    try {
        // Categories: public read of active (rules allow)
        const q = query(
            collection(db, 'categories'),
            where('isActive', '==', true),
            orderBy('sortOrder', 'asc')
        );
        
        state.listeners.categories = onSnapshot(q, (snapshot) => {
            const categories = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                categories.push({
                    id: doc.id,
                    ...data,
                    isActive: data.isActive !== undefined ? data.isActive : true
                });
            });
            state.categories = categories;
            if (callback) callback(categories);
        }, (error) => {
            // If index missing, retry with simpler query (no orderBy)
            if (error.code === 'failed-precondition') {
                console.warn('📂 Categories: index missing — falling back to unsorted query');
                try {
                    const fallbackQ = query(collection(db, 'categories'), where('isActive', '==', true));
                    state.listeners.categories = onSnapshot(fallbackQ, (snapshot) => {
                        const categories = [];
                        snapshot.forEach(doc => {
                            const data = doc.data();
                            categories.push({ id: doc.id, ...data, isActive: data.isActive !== undefined ? data.isActive : true });
                        });
                        categories.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
                        state.categories = categories;
                        if (callback) callback(categories);
                    }, (err2) => handleListenerError('Categories (fallback)', err2, callback, state.categories));
                    return;
                } catch (e) {}
            }
            handleListenerError('Categories', error, callback, state.categories);
        });
        
        return state.listeners.categories;
    } catch (error) {
        handleListenerError('Categories (setup)', error, callback, []);
        return null;
    }
}

export function listenToBanners(callback) {
    if (state.listeners.banners) {
        state.listeners.banners();
        state.listeners.banners = null;
    }
    
    try {
        const q = query(
            collection(db, 'banners'),
            where('isActive', '==', true),
            orderBy('sortOrder', 'asc')
        );
        
        state.listeners.banners = onSnapshot(q, (snapshot) => {
            const banners = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                banners.push({
                    id: doc.id,
                    ...data,
                    isActive: data.isActive !== undefined ? data.isActive : true
                });
            });
            state.banners = banners;
            if (callback) callback(banners);
        }, (error) => {
            if (error.code === 'failed-precondition') {
                try {
                    const fallbackQ = query(collection(db, 'banners'), where('isActive', '==', true));
                    state.listeners.banners = onSnapshot(fallbackQ, (snapshot) => {
                        const banners = [];
                        snapshot.forEach(doc => {
                            const data = doc.data();
                            banners.push({ id: doc.id, ...data, isActive: data.isActive !== undefined ? data.isActive : true });
                        });
                        banners.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
                        state.banners = banners;
                        if (callback) callback(banners);
                    }, (err2) => handleListenerError('Banners (fallback)', err2, callback, state.banners));
                    return;
                } catch (e) {}
            }
            handleListenerError('Banners', error, callback, state.banners);
        });
        
        return state.listeners.banners;
    } catch (error) {
        handleListenerError('Banners (setup)', error, callback, []);
        return null;
    }
}

/**
 * Orders listener — gated by auth + admin.
 * For regular users: listen to their own orders only.
 * For admins: listen to all orders.
 */
export function listenToOrders(callback) {
    if (state.listeners.orders) {
        state.listeners.orders();
        state.listeners.orders = null;
    }
    
    // Do not start listener if no user
    if (!state.currentUser) {
        console.log('📋 Orders listener: skipped (no user)');
        if (callback) callback([]);
        return null;
    }
    
    try {
        let q;
        if (state.isAdmin) {
            // Admin: all orders
            q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
        } else {
            // Regular user: only own orders
            q = query(
                collection(db, 'orders'),
                where('customerId', '==', state.currentUser.uid)
            );
        }
        
        state.listeners.orders = onSnapshot(q, (snapshot) => {
            const orders = [];
            snapshot.forEach(doc => {
                orders.push({ id: doc.id, ...doc.data() });
            });
            if (state.isAdmin) {
                orders.sort((a, b) => {
                    const da = a.createdAt?.toDate?.() || 0;
                    const db_ = b.createdAt?.toDate?.() || 0;
                    return new Date(db_) - new Date(da);
                });
            } else {
                orders.sort((a, b) => {
                    const da = a.createdAt?.toDate?.() || 0;
                    const db_ = b.createdAt?.toDate?.() || 0;
                    return new Date(db_) - new Date(da);
                });
            }
            state.orders = orders;
            if (callback) callback(orders);
        }, (error) => {
            handleListenerError('Orders', error, callback, []);
        });
        
        return state.listeners.orders;
    } catch (error) {
        handleListenerError('Orders (setup)', error, callback, []);
        return null;
    }
}

/**
 * Users listener — ADMIN ONLY.
 * Regular users: no listener started.
 */
export function listenToUsers(callback) {
    if (state.listeners.users) {
        state.listeners.users();
        state.listeners.users = null;
    }
    
    // Users collection is admin-only. Do NOT start for non-admins.
    if (!state.isAdmin) {
        console.log('👥 Users listener: skipped (not admin)');
        if (callback) callback([]);
        return null;
    }
    
    try {
        const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
        
        state.listeners.users = onSnapshot(q, (snapshot) => {
            const users = [];
            snapshot.forEach(doc => {
                users.push({ id: doc.id, ...doc.data() });
            });
            state.users = users;
            if (callback) callback(users);
        }, (error) => {
            handleListenerError('Users', error, callback, []);
        });
        
        return state.listeners.users;
    } catch (error) {
        handleListenerError('Users (setup)', error, callback, []);
        return null;
    }
}

// ============================================
// CLEANUP ALL LISTENERS
// ============================================
export function cleanupAllListeners() {
    Object.keys(state.listeners).forEach(key => {
        if (state.listeners[key]) {
            state.listeners[key]();
            state.listeners[key] = null;
        }
    });
    clearTimeout(listenerRetryTimeout);
    listenerRetryCount = 0;
    console.log('🧹 All listeners cleaned up');
}

// ============================================
// ADMIN FUNCTIONS - PRODUCTS
// ============================================
export async function addProduct(productData) {
    try {
        const data = {
            ...productData,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
            isActive: productData.isActive !== undefined ? productData.isActive : true
        };
        const docRef = await addDoc(collection(db, 'products'), data);
        return { success: true, id: docRef.id };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

export async function updateProduct(productId, productData) {
    try {
        await updateDoc(doc(db, 'products', productId), { ...productData, updatedAt: Timestamp.now() });
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

export async function deleteProduct(productId) {
    try {
        await deleteDoc(doc(db, 'products', productId));
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

export async function toggleProductActive(productId, isActive) {
    try {
        await updateDoc(doc(db, 'products', productId), { isActive, updatedAt: Timestamp.now() });
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// ============================================
// ADMIN FUNCTIONS - CATEGORIES
// ============================================
export async function addCategory(categoryData) {
    try {
        const data = {
            ...categoryData,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
            isActive: categoryData.isActive !== undefined ? categoryData.isActive : true
        };
        const docRef = await addDoc(collection(db, 'categories'), data);
        return { success: true, id: docRef.id };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

export async function updateCategory(categoryId, categoryData) {
    try {
        await updateDoc(doc(db, 'categories', categoryId), { ...categoryData, updatedAt: Timestamp.now() });
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

export async function deleteCategory(categoryId) {
    try {
        await deleteDoc(doc(db, 'categories', categoryId));
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

export async function toggleCategoryActive(categoryId, isActive) {
    try {
        await updateDoc(doc(db, 'categories', categoryId), { isActive, updatedAt: Timestamp.now() });
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// ============================================
// ADMIN FUNCTIONS - BANNERS
// ============================================
export async function addBanner(bannerData) {
    try {
        const data = {
            ...bannerData,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
            isActive: bannerData.isActive !== undefined ? bannerData.isActive : true
        };
        const docRef = await addDoc(collection(db, 'banners'), data);
        return { success: true, id: docRef.id };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

export async function updateBanner(bannerId, bannerData) {
    try {
        await updateDoc(doc(db, 'banners', bannerId), { ...bannerData, updatedAt: Timestamp.now() });
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

export async function deleteBanner(bannerId) {
    try {
        await deleteDoc(doc(db, 'banners', bannerId));
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// ============================================
// ADMIN FUNCTIONS - ORDERS
// ============================================
export async function updateOrderStatus(orderId, status) {
    try {
        await updateDoc(doc(db, 'orders', orderId), { status, updatedAt: Timestamp.now() });
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// ============================================
// IMAGE UPLOAD FUNCTIONS
// ============================================
export async function uploadProductImage(productId, file, index = 0) {
    try {
        const { uploadImageToImgBB } = await import('./firebase-config.js');
        const result = await uploadImageToImgBB(file);
        return {
            success: true,
            url: result.url,
            name: result.name,
            size: result.size,
            type: result.type,
            order: index
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

export async function uploadProductImages(productId, files, onProgress) {
    const results = [];
    let completed = 0;
    const total = files.length;
    
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        try {
            const result = await uploadProductImage(productId, file, i);
            results.push(result);
            completed++;
            if (onProgress) onProgress(completed, total, result);
        } catch (error) {
            results.push({ success: false, error: error.message, name: file.name });
            completed++;
            if (onProgress) onProgress(completed, total, { success: false, error: error.message, name: file.name });
        }
    }
    
    return results;
}

// ============================================
// EXPOSE GLOBALLY
// ============================================
window.__app = {
    state,
    getCart, saveCart, getWishlist, saveWishlist, getOrders, saveOrders,
    addToCart, removeFromCart, updateCartQuantity, clearCart,
    getCartCount, getCartTotal, toggleWishlist, isInWishlist,
    loginUser, signupUser, logoutUser, resetPassword,
    initApp, checkAdminStatus, waitForAuth,
    listenToProducts, listenToCategories, listenToBanners,
    listenToOrders, listenToUsers, cleanupAllListeners,
    addProduct, updateProduct, deleteProduct, toggleProductActive,
    addCategory, updateCategory, deleteCategory, toggleCategoryActive,
    addBanner, updateBanner, deleteBanner, updateOrderStatus,
    uploadProductImage, uploadProductImages, updateUserData, searchProducts,
    BUSINESS_PHONE, BUSINESS_PHONE_TEL, BUSINESS_WHATSAPP
};

console.log('✅ App initialized successfully');