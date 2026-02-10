// Unit Tests for Sanitization Utilities
// Run with: npm test

import {
    stripHTML,
    truncateString,
    cleanAltitude,
    validateProcess,
    sanitizeCoffeeData
} from '../utils/sanitize.js';

describe('Sanitization Utilities', () => {
    describe('stripHTML', () => {
        test('should remove simple HTML tags', () => {
            expect(stripHTML('<b>Bold</b>')).toBe('Bold');
            expect(stripHTML('<script>alert("xss")</script>')).toBe('alert("xss")');
        });

        test('should remove complex HTML tags', () => {
            expect(stripHTML('<div class="test">Content</div>')).toBe('Content');
            expect(stripHTML('<a href="http://evil.com">Link</a>')).toBe('Link');
        });

        test('should handle multiple tags', () => {
            expect(stripHTML('<p>Hello <b>World</b></p>')).toBe('Hello World');
        });

        test('should handle non-string inputs', () => {
            expect(stripHTML(null)).toBe('');
            expect(stripHTML(undefined)).toBe('');
            expect(stripHTML(123)).toBe('');
        });

        test('should handle strings without HTML', () => {
            expect(stripHTML('Plain text')).toBe('Plain text');
        });

        test('should remove HTML entities', () => {
            expect(stripHTML('&lt;script&gt;')).toBe('script');
            expect(stripHTML('&amp;')).toBe('');
            expect(stripHTML('Test&nbsp;Text')).toBe('TestText');
        });

        test('should handle malformed/nested HTML tags', () => {
            // Multiple passes handle nested tags
            expect(stripHTML('<script<script>>')).toBe('>');
            expect(stripHTML('<<script>>alert(1)<</script>>')).toBe('>alert(1)>');
            // Verify actual dangerous content is removed
            expect(stripHTML('<b>Normal <script>evil</script> text</b>')).toBe('Normal evil text');
        });
    });

    describe('truncateString', () => {
        test('should truncate long strings', () => {
            const longString = 'a'.repeat(300);
            expect(truncateString(longString, 200)).toBe('a'.repeat(200));
        });

        test('should not truncate short strings', () => {
            expect(truncateString('Short', 200)).toBe('Short');
        });

        test('should handle exact length strings', () => {
            expect(truncateString('Exact', 5)).toBe('Exact');
        });

        test('should handle non-string inputs', () => {
            expect(truncateString(null, 100)).toBe('');
            expect(truncateString(undefined, 100)).toBe('');
        });
    });

    describe('cleanAltitude', () => {
        test('should clean valid altitude strings', () => {
            expect(cleanAltitude('1500')).toBe('1500');
            expect(cleanAltitude('1200-1800')).toBe('1200-1800');
            expect(cleanAltitude('1500 masl')).toBe('1500');
        });

        test('should remove HTML tags from altitude', () => {
            expect(cleanAltitude('<b>1500</b>')).toBe('1500');
            expect(cleanAltitude('<script>1500</script>')).toBe('1500');
        });

        test('should remove non-numeric characters except hyphens and spaces', () => {
            expect(cleanAltitude('1500m')).toBe('1500');
            expect(cleanAltitude('1200-1800 meters')).toBe('1200-1800');
            expect(cleanAltitude('~1500')).toBe('1500');
        });

        test('should handle numeric inputs', () => {
            expect(cleanAltitude(1500)).toBe('1500');
            expect(cleanAltitude(1200)).toBe('1200');
        });

        test('should handle empty inputs', () => {
            expect(cleanAltitude('')).toBe('');
            expect(cleanAltitude(null)).toBe('');
            expect(cleanAltitude(undefined)).toBe('');
        });

        test('should respect max length of 50 chars', () => {
            const longAltitude = '1'.repeat(100);
            expect(cleanAltitude(longAltitude).length).toBeLessThanOrEqual(50);
        });
    });

    describe('validateProcess', () => {
        test('should validate known processes', () => {
            expect(validateProcess('washed')).toBe('washed');
            expect(validateProcess('natural')).toBe('natural');
            expect(validateProcess('honey')).toBe('honey');
            expect(validateProcess('anaerobic')).toBe('anaerobic');
            expect(validateProcess('wet hulled')).toBe('wet hulled');
        });

        test('should be case-insensitive', () => {
            expect(validateProcess('WASHED')).toBe('washed');
            expect(validateProcess('Natural')).toBe('natural');
            expect(validateProcess('HoNeY')).toBe('honey');
        });

        test('should handle processes with extra words', () => {
            expect(validateProcess('honey process')).toBe('honey');
            expect(validateProcess('washed method')).toBe('washed');
        });

        test('should remove HTML from process', () => {
            expect(validateProcess('<b>washed</b>')).toBe('washed');
            expect(validateProcess('<script>natural</script>')).toBe('natural');
        });

        test('should default to "washed" for invalid processes', () => {
            expect(validateProcess('unknown')).toBe('washed');
            expect(validateProcess('invalid')).toBe('washed');
            expect(validateProcess('')).toBe('washed');
        });

        test('should handle non-string inputs', () => {
            expect(validateProcess(null)).toBe('washed');
            expect(validateProcess(undefined)).toBe('washed');
            expect(validateProcess(123)).toBe('washed');
        });
    });

    describe('sanitizeCoffeeData', () => {
        test('should sanitize all string fields', () => {
            const input = {
                name: '<script>Evil Coffee</script>',
                origin: '<b>Ethiopia</b>',
                cultivar: '<div>Heirloom</div>',
                roaster: '<a href="evil.com">Roaster</a>',
                tastingNotes: '<p>Fruity and sweet</p>',
                process: 'washed',
                altitude: '1500'
            };

            const result = sanitizeCoffeeData(input);

            expect(result.name).toBe('Evil Coffee');
            expect(result.origin).toBe('Ethiopia');
            expect(result.cultivar).toBe('Heirloom');
            expect(result.roaster).toBe('Roaster');
            expect(result.tastingNotes).toBe('Fruity and sweet');
        });

        test('should truncate long strings', () => {
            const input = {
                name: 'a'.repeat(300),
                origin: 'b'.repeat(300),
                cultivar: 'c'.repeat(300),
                roaster: 'd'.repeat(300),
                tastingNotes: 'e'.repeat(600)
            };

            const result = sanitizeCoffeeData(input);

            expect(result.name.length).toBe(200);
            expect(result.origin.length).toBe(200);
            expect(result.cultivar.length).toBe(200);
            expect(result.roaster.length).toBe(200);
            expect(result.tastingNotes.length).toBe(500);
        });

        test('should validate and clean process field', () => {
            const input = { process: '<b>natural</b>' };
            const result = sanitizeCoffeeData(input);
            expect(result.process).toBe('natural');
        });

        test('should clean altitude field', () => {
            const input = { altitude: '<b>1500</b> masl' };
            const result = sanitizeCoffeeData(input);
            expect(result.altitude).toBe('1500');
        });

        test('should preserve non-string fields', () => {
            const now = new Date().toISOString();
            const input = {
                name: 'Coffee',
                addedDate: now,
                id: 123,
                savedAt: now
            };

            const result = sanitizeCoffeeData(input);

            expect(result.addedDate).toBe(now);
            expect(result.id).toBe(123);
            expect(result.savedAt).toBe(now);
        });

        test('should handle empty object', () => {
            const result = sanitizeCoffeeData({});
            expect(result).toEqual({});
        });

        test('should handle null and undefined', () => {
            expect(sanitizeCoffeeData(null)).toEqual({});
            expect(sanitizeCoffeeData(undefined)).toEqual({});
        });

        test('should handle partial data', () => {
            const input = {
                name: 'Coffee Name',
                origin: 'Ethiopia'
            };

            const result = sanitizeCoffeeData(input);

            expect(result.name).toBe('Coffee Name');
            expect(result.origin).toBe('Ethiopia');
            expect(result.process).toBeUndefined();
            expect(result.altitude).toBeUndefined();
        });

        test('should handle comprehensive XSS attack', () => {
            const input = {
                name: '<script>alert("xss")</script>Evil Coffee',
                origin: '<img src=x onerror=alert(1)>Ethiopia',
                process: '<iframe src="evil.com">washed</iframe>',
                cultivar: 'javascript:alert(1)',
                altitude: '<svg/onload=alert(1)>1500',
                roaster: '<object data="evil.swf">Roaster</object>',
                tastingNotes: '<embed src="evil.swf">Notes</embed>'
            };

            const result = sanitizeCoffeeData(input);

            expect(result.name).toBe('alert("xss")Evil Coffee');
            expect(result.origin).toBe('Ethiopia');
            expect(result.process).toBe('washed');
            expect(result.cultivar).toBe('javascript:alert(1)');
            expect(result.altitude).toBe('1500');
            expect(result.roaster).toBe('Roaster');
            expect(result.tastingNotes).toBe('Notes');
        });
    });
});
