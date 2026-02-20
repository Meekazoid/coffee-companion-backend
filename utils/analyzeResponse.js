export function extractCoffeeJsonFromAnthropicResponse(responseBody) {
    const textSegments = responseBody?.content
        ?.filter(item => item?.type === 'text' && typeof item?.text === 'string')
        ?.map(item => item.text) || [];

    if (textSegments.length === 0) {
        throw new Error('No text content returned from analysis provider');
    }

    const combinedText = textSegments.join('\n').trim();

    // Prefer fenced JSON blocks when present
    const fencedMatch = combinedText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    const candidate = fencedMatch ? fencedMatch[1] : combinedText;

    // Fall back to first object-like block
    const objectMatch = candidate.match(/\{[\s\S]*\}/);
    if (!objectMatch) {
        throw new Error('Could not parse coffee data');
    }

    return JSON.parse(objectMatch[0]);
}

export function buildCoffeeDefaults(coffeeData) {
    return {
        name: coffeeData?.name || 'Unknown',
        origin: coffeeData?.origin || 'Unknown',
        process: coffeeData?.process || 'washed',
        cultivar: coffeeData?.cultivar || 'Unknown',
        altitude: coffeeData?.altitude || '1500',
        roaster: coffeeData?.roaster || 'Unknown',
        tastingNotes: coffeeData?.tastingNotes || 'No notes',
        addedDate: new Date().toISOString()
    };
}
