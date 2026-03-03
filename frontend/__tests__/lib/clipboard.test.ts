import { copyWithAutoClear } from "@/lib/clipboard";
import { toast } from "sonner";

jest.mock("sonner", () => ({
  toast: {
    info: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
  },
}));

describe('Clipboard Lib - Logic', () => {
    let mockWriteText: jest.Mock;

    beforeEach(() => {
        mockWriteText = jest.fn().mockResolvedValue(undefined);
        Object.defineProperty(global.navigator, 'clipboard', {
            value: { writeText: mockWriteText },
            configurable: true
        });
        jest.useFakeTimers();
        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('should call writeText with the provided string and show toast', async () => {
        const text = 'secret-password';
        console.log(`Running Test: copyWithAutoClear`);
        console.log(`Input Text: "${text}"`);
        
        const success = await copyWithAutoClear(text);
        
        console.log(`Output success status: ${success}`);
        expect(success).toBe(true);
        expect(mockWriteText).toHaveBeenCalledWith(text);
        expect(toast.info).toHaveBeenCalledWith("Text copied to clipboard");
        console.log('Result: Success - copyWithAutoClear called correctly and toast shown');
    });

    it('should clear the clipboard after the timeout', async () => {
        const timeout = 1000;
        const text = 'top-secret';
        console.log(`Running Test: clipboard auto-clear`);
        console.log(`Input Text: "${text}", Timeout: ${timeout}ms`);

        await copyWithAutoClear(text, timeout);
        
        expect(mockWriteText).toHaveBeenCalledWith(text);
        console.log(`Status: Advanced timers by ${timeout}ms`);

        jest.advanceTimersByTime(timeout);
        
        // Use flush promises to allow the async clearTimeout callback to run
        await Promise.resolve();
        
        console.log(`Output Last Clipboard Call: "${mockWriteText.mock.calls[mockWriteText.mock.calls.length - 1][0]}"`);
        expect(mockWriteText).toHaveBeenLastCalledWith('');
        expect(toast.info).toHaveBeenCalledWith("Clipboard cleared for security");
        console.log('Result: Success - clipboard cleared automatically after timeout');
    });
});
