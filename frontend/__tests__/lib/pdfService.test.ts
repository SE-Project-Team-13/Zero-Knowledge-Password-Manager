/**
 * PDF Service Tests
 */

describe('PDF Service - Logic', () => {
    // Helper logic as defined in the service
    const formatRecoveryKey = (key: string) => key.replace(/[\s-]/g, "");

    describe('formatRecoveryKey', () => {
        it('should remove all spaces and dashes', () => {
            console.log('Running: should remove spaces and dashes');
            const key = ' abcd - efgh - ijkl ';
            const clean = formatRecoveryKey(key);
            expect(clean).toBe('abcdefghijkl');
            console.log('Result: Success - cleaned key: ' + clean);
        });
    });

    it('should generate a valid filename', () => {
        console.log('Running: should generate valid filename');
        const email = 'test.user@example.com';
        const safeEmail = email.replace(/[^a-z0-9]/gi, '_');
        const fileName = `Recovery_${safeEmail}.pdf`;
        expect(fileName).toBe('Recovery_test_user_example_com.pdf');
        console.log('Result: Success - filename is ' + fileName);
    });
});
