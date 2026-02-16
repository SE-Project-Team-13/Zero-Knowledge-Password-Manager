import { renderHook } from '@testing-library/react';
import { usePasswordAging } from '@/hooks/usePasswordAging';
import { useVault } from '@/context/VaultContext';

jest.mock('@/context/VaultContext', () => ({
  useVault: jest.fn(),
}));

describe('usePasswordAging - Pure Logic', () => {
    beforeEach(() => {
        (useVault as jest.Mock).mockReturnValue({
            decryptedEntries: [],
            snoozeEntry: jest.fn(),
        });
    });

    it('should identify passwords older than 365 days', () => {
        const now = new Date('2024-01-01').getTime();
        const dateSpy = jest.spyOn(Date, 'now').mockReturnValue(now);

        const { result } = renderHook(() => usePasswordAging());
        const { isPasswordOld, getLastUpdatedMs } = result.current;

        const oldDate = new Date('2022-12-31').toISOString();
        const entry = { lastUpdated: oldDate } as any;
        
        console.log(`Running Test: Identify old passwords`);
        console.log(`Input Entry:`, entry);
        
        const isOld = isPasswordOld(entry);
        const last = getLastUpdatedMs(entry);
        
        console.log(`Output getLastUpdatedMs: ${last}`);
        console.log(`Output isPasswordOld: ${isOld}`);

        expect(last).toBe(new Date(oldDate).getTime());
        expect(isOld).toBe(true);
        
        console.log('Result: Success - password correctly identified as old');
        dateSpy.mockRestore();
    });

    it('should return false for passwords newer than 365 days', () => {
        const now = new Date('2024-01-01').getTime();
        const dateSpy = jest.spyOn(Date, 'now').mockReturnValue(now);

        const { result } = renderHook(() => usePasswordAging());
        const { isPasswordOld } = result.current;

        const newDate = new Date('2023-06-01').toISOString();
        const entry = { lastUpdated: newDate } as any;
        
        console.log(`Running Test: Identify new passwords`);
        console.log(`Input Entry:`, entry);

        const isOld = isPasswordOld(entry);
        console.log(`Output isPasswordOld: ${isOld}`);

        expect(isOld).toBe(false);
        console.log('Result: Success - password correctly identified as not old');
        
        dateSpy.mockRestore();
    });
});
