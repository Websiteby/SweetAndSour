// ============================================
// FIREBASE DATA - SHARED SAFE PUBLIC DATA UTILITIES
// ============================================
import {
    db,
    collection,
    query,
    where,
    orderBy,
    onSnapshot,
    getDocs,
    getDoc,
    doc,
    isPermissionError,
    isOfflineError
} from './firebase-config.js';

// ============================================
// PUBLIC PRODUCTS (ACTIVE ONLY)
// Rules-compatible query. Never throws — always calls callback.
// ============================================
export function listenToActiveProducts(callback, opts = {}) {
    try {
        const constraints = [where('isActive', '==', true)];
        if (opts.categoryId) {
            constraints.push(where('categoryId', '==', opts.categoryId));
        }
        const q = query(collection(db, 'products'), ...constraints);

        return onSnapshot(q, (snapshot) => {
            const products = [];
            snapshot.forEach(d => {
                const data = d.data();
                products.push({
                    id: d.id,
                    ...data,
                    thumbnail: data.thumbnail || data.images?.[0]?.url || '',
                    oldPrice: data.oldPrice || data.salePrice || 0,
                    categoryName: data.categoryName || data.category || '',
                    sku: data.sku || data.SKU || data.productSku || data.productSKU || ''
                });
            });
            callback(null, products);
        }, (error) => {
            handlePublicError('Products', error);
            callback(error, []);
        });
    } catch (error) {
        handlePublicError('Products (setup)', error);
        callback(error, []);
        return null;
    }
}

// ============================================
// PUBLIC CATEGORIES (ACTIVE ONLY)
// ============================================
export function listenToActiveCategories(callback) {
    try {
        const q = query(
            collection(db, 'categories'),
            where('isActive', '==', true)
        );
        return onSnapshot(q, (snapshot) => {
            const items = [];
            snapshot.forEach(d => {
                items.push({ id: d.id, ...d.data() });
            });
            items.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
            callback(null, items);
        }, (error) => {
            handlePublicError('Categories', error);
            callback(error, []);
        });
    } catch (error) {
        handlePublicError('Categories (setup)', error);
        callback(error, []);
        return null;
    }
}

// ============================================
// PUBLIC BANNERS (ACTIVE ONLY)
// ============================================
export function listenToActiveBanners(callback) {
    try {
        const q = query(
            collection(db, 'banners'),
            where('isActive', '==', true)
        );
        return onSnapshot(q, (snapshot) => {
            const items = [];
            snapshot.forEach(d => {
                const data = d.data();
                items.push({ id: d.id, ...data });
            });
            items.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
            callback(null, items);
        }, (error) => {
            handlePublicError('Banners', error);
            callback(error, []);
        });
    } catch (error) {
        handlePublicError('Banners (setup)', error);
        callback(error, []);
        return null;
    }
}

// ============================================
// PUBLIC ANNOUNCEMENTS (ACTIVE ONLY)
// ============================================
export function listenToActiveAnnouncements(callback) {
    try {
        const q = query(
            collection(db, 'announcements'),
            where('isActive', '==', true)
        );
        return onSnapshot(q, (snapshot) => {
            const items = [];
            snapshot.forEach(d => items.push({ id: d.id, ...d.data() }));
            items.sort((a, b) => {
                const da = a.createdAt?.toDate?.() || 0;
                const db_ = b.createdAt?.toDate?.() || 0;
                return new Date(db_) - new Date(da);
            });
            callback(null, items);
        }, (error) => {
            handlePublicError('Announcements', error);
            callback(error, []);
        });
    } catch (error) {
        handlePublicError('Announcements (setup)', error);
        callback(error, []);
        return null;
    }
}

// ============================================
// ONE-SHOT PUBLIC PRODUCTS FETCH (for search cache)
// ============================================
export async function fetchActiveProducts() {
    try {
        const q = query(collection(db, 'products'), where('isActive', '==', true));
        const snap = await getDocs(q);
        const items = [];
        snap.forEach(d => {
            const data = d.data();
            items.push({
                id: d.id,
                ...data,
                thumbnail: data.thumbnail || data.images?.[0]?.url || '',
                categoryName: data.categoryName || data.category || '',
                sku: data.sku || data.SKU || data.productSku || data.productSKU || ''
            });
        });
        return items;
    } catch (error) {
        handlePublicError('fetchActiveProducts', error);
        return [];
    }
}

// ============================================
// HELPER
// ============================================
function handlePublicError(label, error) {
    if (isPermissionError(error)) {
        console.warn(`🔒 ${label}: permission denied — check rules`);
    } else if (isOfflineError(error)) {
        console.warn(`⚠️ ${label}: network unavailable`);
    } else if (error.code === 'failed-precondition') {
        console.warn(`⚠️ ${label}: missing index — deploy firestore.indexes.json`);
    } else {
        console.warn(`⚠️ ${label} error:`, error.message);
    }
}