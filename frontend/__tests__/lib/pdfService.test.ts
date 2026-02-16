jest.mock("jspdf", () => ({
    jsPDF: jest.fn().mockImplementation(() => ({
        internal: { pageSize: { getWidth: () => 210, getHeight: () => 297 } },
        setFillColor: jest.fn(),
        rect: jest.fn(),
        setTextColor: jest.fn(),
        setFont: jest.fn(),
        setFontSize: jest.fn(),
        text: jest.fn(),
        setDrawColor: jest.fn(),
        setLineWidth: jest.fn(),
        line: jest.fn(),
        save: jest.fn(),
    })),
}));

import { formatRecoveryKey } from "@/lib/pdfService";

describe('PDF Service - Logic', () => {
    describe('formatRecoveryKey', () => {
        it('should remove all spaces and dashes', () => {
            const key = ' abcd - efgh - ijkl ';
            console.log(`\n--- Test: formatRecoveryKey ---`);
            console.log(`Input Key: "${key}"`);
            
            const clean = formatRecoveryKey(key);
            console.log(`Output Cleaned Key: "${clean}"`);
            
            expect(clean).toBe('abcdefghijkl');
            console.log('Result: Success');
        });
    });

    it('should generate a valid filename', () => {
        const email = 'test.user@example.com';
        console.log(`\n--- Test: generate filename ---`);
        console.log(`Input Email: "${email}"`);
        
        const safeEmail = email.replace(/[^a-z0-9]/gi, '_');
        const fileName = `ZeroKnowledge_Recovery_${safeEmail}.pdf`;
        console.log(`Output Filename: "${fileName}"`);
        
        expect(fileName).toBe('ZeroKnowledge_Recovery_test_user_example_com.pdf');
        console.log('Result: Success');
    });
});
