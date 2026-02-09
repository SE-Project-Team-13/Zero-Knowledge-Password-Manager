/**
 * Password Aging Hook Logic Tests
 */

describe('usePasswordAging - Pure Logic', () => {
    const getLastUpdatedMs = (entry: any) => {
        const candidates = [entry.lastUpdated, entry.updatedAt, entry.createdAt].filter(Boolean) as string[];
        for (const value of candidates) {
            const parsed = new Date(value).getTime();
            if (!Number.isNaN(parsed)) return parsed;
        }
        return NaN;
    };

    it('should identify passwords older than 365 days', () => {
        console.log('Running: should identify old passwords');
        const now = new Date('2024-01-01').getTime();
        const oldDate = new Date('2022-12-31').toISOString();
        const entry = { lastUpdated: oldDate };
        
        const last = getLastUpdatedMs(entry);
        const ageDays = (now - last) / (1000 * 60 * 60 * 24);
        const isOld = ageDays >= 365;
        
        expect(isOld).toBe(true);
        console.log('Result: Success - password identified as old');
    });
});
