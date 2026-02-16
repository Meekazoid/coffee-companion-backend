// ==========================================
// SANITIZATION UTILITIES
// ==========================================
//
// SECURITY NOTE: This module provides basic regex-based sanitization for
// defense-in-depth. It is NOT a complete XSS prevention solution.
//
// Known limitations of regex-based HTML stripping:
// - May not catch all malformed HTML edge cases
// - Does not handle JavaScript in attributes (e.g., onclick, onerror)
// - Does not decode all possible HTML entity encodings
//
// Defense-in-depth strategy:
// 1. This backend sanitization provides a first layer of defense
// 2. Frontend MUST also sanitize user-facing output (e.g., using DOMPurify)
// 3. Database stores sanitized data to prevent persistence of malicious content
//
// This approach meets the requirements for no external dependencies while
// acknowledging that complete XSS prevention requires multiple layers.
// ==========================================

/**
 * Strip HTML tags from a string
 * Note: This is a basic regex-based approach for defense-in-depth.
 * It removes HTML tags but does not handle all XSS vectors.
 * Frontend should also implement proper sanitization (e.g., DOMPurify).
 * @param {string} str - Input string
 * @returns {string} - String with HTML tags removed
 */
export function stripHTML(str) {
    if (typeof str !== 'string') return '';
    
    let result = str;
    let previous = '';
    
    // Run multiple passes to handle nested/malformed tags like <script<script>>
    while (result !== previous) {
        previous = result;
        result = result
            .replace(/<[^>]*>/g, '')        // Remove HTML tags
            .replace(/&[^;]+;/g, '');       // Remove HTML entities
    }
    
    return result;
}

/**
 * Truncate a string to a maximum length
 * @param {string} str - Input string
 * @param {number} maxLength - Maximum length
 * @returns {string} - Truncated string
 */
export function truncateString(str, maxLength) {
    if (typeof str !== 'string') return '';
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength);
}

/**
 * Validate and clean altitude field
 * @param {string|number} altitude - Altitude value
 * @returns {string} - Cleaned altitude string
 */
export function cleanAltitude(altitude) {
    if (!altitude) return '';
    const str = String(altitude);
    // Strip HTML first
    const cleaned = stripHTML(str);
    // Keep only digits, hyphens, and spaces (remove units like "masl", "m", etc.)
    const result = cleaned.replace(/[^0-9\-\s]/g, '');
    return truncateString(result.trim(), 50);
}

/**
 * Validate process method against known values
 * @param {string} process - Process method
 * @returns {string} - Validated process or default 'washed'
 */
export function validateProcess(process) {
    const validProcesses = [
        'washed',
        'natural',
        'honey',
        'anaerobic',
        'wet hulled',
        'semi-washed',
        'pulped natural',
        'carbonic maceration',
        'anaerobic natural',
        'anaerobic washed',
        'yeast inoculated natural',
        'nitro washed',
        'extended fermentation'
    ];
    
    if (!process || typeof process !== 'string') return 'washed';
    
    const cleaned = stripHTML(process).toLowerCase().trim();
    
    // Check if the cleaned process is in the valid list
    if (validProcesses.includes(cleaned)) {
        return cleaned;
    }
    
    // Check for partial matches (e.g., "honey process" -> "honey")
    for (const valid of validProcesses) {
        if (cleaned.includes(valid)) {
            return valid;
        }
    }
    
    return 'washed';
}

/**
 * Sanitize a complete coffee data object
 * @param {Object} coffeeData - Raw coffee data
 * @returns {Object} - Sanitized coffee data
 */
export function sanitizeCoffeeData(coffeeData) {
    if (!coffeeData || typeof coffeeData !== 'object') {
        return {};
    }
    
    const sanitized = {};
    
    // Field-level constraints from requirements
    // These text fields are user-provided and need HTML stripping + truncation
    const stringFields = {
        name: 200,
        origin: 200,
        cultivar: 200,
        roaster: 200,
        roastery: 200,     // ← NEW: Rösterei field for card editor
        tastingNotes: 500
    };
    
    // Sanitize string fields with HTML stripping and truncation
    for (const [field, maxLength] of Object.entries(stringFields)) {
        const value = coffeeData[field];
        if (value !== undefined && value !== null) {
            const stripped = stripHTML(String(value));
            sanitized[field] = truncateString(stripped, maxLength);
        }
    }
    
    // Sanitize process field with validation
    if (coffeeData.process !== undefined) {
        sanitized.process = validateProcess(coffeeData.process);
    }
    
    // Sanitize altitude field
    if (coffeeData.altitude !== undefined) {
        sanitized.altitude = cleanAltitude(coffeeData.altitude);
    }
    
    // Preserve fields that don't need sanitization (dates, IDs, metadata)
    const nonStringFields = [
        'addedDate',       // ISO date string when coffee was added
        'id',              // Database ID
        'savedAt',         // Backend timestamp
        'createdAt',       // Backend timestamp
        'updatedAt',       // Backend timestamp
        'roastDate',       // User-set roast date (YYYY-MM-DD)
        'favorite',        // Boolean flag
        'favoritedAt',     // ISO date string
        'deleted',         // Boolean flag (soft delete / compost)
        'deletedAt',       // ISO date string
        'grindOffset',     // Integer: grinder-neutral adjustment
        'customTemp',      // String: user-adjusted temperature
        'customAmount',    // Number: user-adjusted coffee amount (grams)
        'feedback',        // Object: brew feedback data
        'initialGrind',    // String: initial grind setting (for reset)
        'initialTemp',     // String: initial temperature (for reset)
    ];
    
    for (const field of nonStringFields) {
        if (coffeeData[field] !== undefined) {
            sanitized[field] = coffeeData[field];
        }
    }
    
    return sanitized;
}
