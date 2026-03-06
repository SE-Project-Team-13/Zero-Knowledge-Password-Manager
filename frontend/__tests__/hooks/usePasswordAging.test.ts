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

    it('should identify passwords older than 180 days', () => {
        const now = new Date('2024-01-01').getTime();
        const dateSpy = jest.spyOn(Date, 'now').mockReturnValue(now);

        const { result } = renderHook(() => usePasswordAging());
        const { isPasswordOld, getLastUpdatedMs } = result.current;

        const oldDate = new Date('2023-06-01').toISOString(); // 7 months ago
        const entry = { lastUpdated: oldDate } as any;
        
        const isOld = isPasswordOld(entry);
        const last = getLastUpdatedMs(entry);
        
        expect(last).toBe(new Date(oldDate).getTime());
        expect(isOld).toBe(true);
        
        dateSpy.mockRestore();
    });

    it('should return false for passwords newer than 180 days', () => {
        const now = new Date('2024-01-01').getTime();
        const dateSpy = jest.spyOn(Date, 'now').mockReturnValue(now);

        const { result } = renderHook(() => usePasswordAging());
        const { isPasswordOld } = result.current;

        const newDate = new Date('2023-10-01').toISOString(); // 3 months ago
        const entry = { lastUpdated: newDate } as any;
        
        const isOld = isPasswordOld(entry);

        expect(isOld).toBe(false);
        
        dateSpy.mockRestore();
    });
});
