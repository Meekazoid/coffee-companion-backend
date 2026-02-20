import {
    buildCoffeeDefaults,
    extractCoffeeJsonFromAnthropicResponse
} from '../utils/analyzeResponse.js';

describe('analyze response utilities', () => {
    test('extracts JSON from plain text response', () => {
        const response = {
            content: [{ type: 'text', text: '{"name":"Test Coffee","origin":"Ethiopia"}' }]
        };

        expect(extractCoffeeJsonFromAnthropicResponse(response)).toEqual({
            name: 'Test Coffee',
            origin: 'Ethiopia'
        });
    });

    test('extracts JSON from fenced code block', () => {
        const response = {
            content: [{
                type: 'text',
                text: 'Here is your data:\n```json\n{"name":"Bag","process":"natural"}\n```'
            }]
        };

        expect(extractCoffeeJsonFromAnthropicResponse(response)).toEqual({
            name: 'Bag',
            process: 'natural'
        });
    });

    test('throws when no text payload is present', () => {
        expect(() => extractCoffeeJsonFromAnthropicResponse({ content: [] }))
            .toThrow('No text content returned from analysis provider');
    });

    test('builds defaults for missing fields', () => {
        const defaults = buildCoffeeDefaults({ name: 'Only Name' });

        expect(defaults.name).toBe('Only Name');
        expect(defaults.origin).toBe('Unknown');
        expect(defaults.process).toBe('washed');
        expect(defaults.tastingNotes).toBe('No notes');
        expect(defaults.addedDate).toBeTruthy();
    });
});
