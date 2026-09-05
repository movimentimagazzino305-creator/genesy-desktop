// ===========================================================================
// PRODUCT CATALOG LOOKUP
// ===========================================================================

/**
 * Search for a product in Giobby's catalog by code
 * @param {Object} config - Giobby configuration
 * @param {string} productCode - Product code to search for
 * @returns {Promise<{id: string, code: string, description: string}|null>}
 */
window.searchGiobbyProduct = async function (config, productCode) {
    if (!productCode || !productCode.trim()) {
        return null;
    }

    const cacheKey = productCode.trim().toUpperCase();

    // Check cache first
    if (window._giobbyProductCache && window._giobbyProductCache.has(cacheKey)) {
        return window._giobbyProductCache.get(cacheKey);
    }

    try {
        const baseUrl = config.apiUrl.endsWith('/') ? config.apiUrl : config.apiUrl + '/';

        // Try multiple query parameter formats
        // Common patterns: ?code=X, ?filter=code:X, ?search=X
        const searchAttempts = [
            `products?code=${encodeURIComponent(productCode)}`,
            `products?filter=code:${encodeURIComponent(productCode)}`,
            `products?search=${encodeURIComponent(productCode)}`
        ];

        for (const endpoint of searchAttempts) {
            let url = baseUrl + endpoint;
            if (config.useProxy) {
                url = "https://corsproxy.io/?" + encodeURIComponent(url);
            }

            console.log(`🔍 Searching Giobby product: ${productCode} via ${endpoint}`);

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

            try {
                const response = await fetch(url, {
                    method: 'GET',
                    headers: window.getGiobbyHeaders(config.accessToken),
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (response.ok) {
                    const data = await response.json();

                    // Normalize response - could be array or object with items
                    let products = Array.isArray(data) ? data : (data.items || data.products || data.objects || []);

                    if (products.length > 0) {
                        // Find exact match by code (case-insensitive)
                        const exactMatch = products.find(p =>
                            (p.code && p.code.toUpperCase() === cacheKey) ||
                            (p.productCode && p.productCode.toUpperCase() === cacheKey) ||
                            (p.itemCode && p.itemCode.toUpperCase() === cacheKey)
                        );

                        const product = exactMatch || products[0]; // Use first if no exact match

                        // Extract ID (try common field names)
                        const productId = product.id || product.idMaterial || product.productId || product.idProduct;

                        if (productId) {
                            const result = {
                                id: String(productId),
                                code: product.code || product.productCode || product.itemCode || productCode,
                                description: product.description || product.name || ""
                            };

                            // Cache the result
                            if (!window._giobbyProductCache) {
                                window._giobbyProductCache = new Map();
                            }
                            window._giobbyProductCache.set(cacheKey, result);

                            console.log(`✅ Found product in Giobby catalog:`, result);
                            return result;
                        }
                    }
                }
            } catch (fetchError) {
                if (fetchError.name === 'AbortError') {
                    console.warn(`⏱️ Timeout searching product: ${productCode}`);
                } else {
                    console.warn(`⚠️ Error searching product with ${endpoint}:`, fetchError.message);
                }
                clearTimeout(timeoutId);
            }
        }

        // Not found after all attempts
        console.log(`ℹ️ Product not found in Giobby catalog: ${productCode}`);

        // Cache negative result to avoid repeated searches
        if (!window._giobbyProductCache) {
            window._giobbyProductCache = new Map();
        }
        window._giobbyProductCache.set(cacheKey, null);

        return null;

    } catch (error) {
        console.error(`❌ Error in product search for ${productCode}:`, error);
        return null;
    }
};

/**
 * Clear product cache (call at start of each export)
 */
window.clearGiobbyProductCache = function () {
    window._giobbyProductCache = new Map();
    console.log("🗑️ Giobby product cache cleared");
};
