/**
 * Clipboard Lib - Logic
 */

describe('Clipboard Lib - Logic', () => {
    let mockWriteText: jest.Mock;

    beforeEach(() => {
        mockWriteText = jest.fn().mockResolvedValue(undefined);
        Object.defineProperty(global.navigator, 'clipboard', {
            value: { writeText: mockWriteText },
            configurable: true
        });
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('should call writeText with the provided string', async () => {
        console.log('Running: should call writeText');
        const text = 'secret-password';
        await navigator.clipboard.writeText(text);
        expect(mockWriteText).toHaveBeenCalledWith(text);
        console.log('Result: Success - writeText called with correct text');
    });

    it('should clear the clipboard after the timeout', async () => {
        console.log('Running: should clear clipboard after timeout');
        const timeout = 1000;
        await navigator.clipboard.writeText('top-secret');
        
        setTimeout(async () => {
            await navigator.clipboard.writeText('');
        }, timeout);

        jest.advanceTimersByTime(timeout);
        await Promise.resolve(); 
        expect(mockWriteText).toHaveBeenLastCalledWith('');
        console.log('Result: Success - clipboard cleared');
    });
});
