import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EditCredentialModal } from '@/components/EditCredentialModal';
import { DecryptedEntry } from '@/context/VaultContext';

// Mock UI components that might cause issues (optional, but good for unit isolation)
jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// Mock Sonner
jest.mock('sonner', () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn(),
  },
}));

const mockEntry: DecryptedEntry = {
  id: '1',
  url: 'https://github.com',
  username: 'testuser',
  password: 'password123',
  notes: 'Test notes',
  createdAt: '2023-01-01T00:00:00Z',
  updatedAt: '2023-01-01T00:00:00Z',
  lastUpdated: '2023-01-01T00:00:00Z',
  isPasswordVisible: false,
};

describe('EditCredentialModal', () => {
  it('renders correctly when open', () => {
    console.log('Running: renders correctly when open');
    render(
      <EditCredentialModal
        isOpen={true}
        onClose={jest.fn()}
        entry={mockEntry}
        onSave={jest.fn()}
      />
    );

    expect(screen.getByText('Edit Credential')).toBeInTheDocument();
    expect(screen.getByDisplayValue('https://github.com')).toBeInTheDocument();
    console.log('Result: Success - Modal title and entry data found');
  });

  it('calls onSave with updated data', async () => {
    console.log('Running: calls onSave with updated data');
    const onSaveMock = jest.fn();
    render(
      <EditCredentialModal
        isOpen={true}
        onClose={jest.fn()}
        entry={mockEntry}
        onSave={onSaveMock}
      />
    );

    const usernameInput = screen.getByDisplayValue('testuser');
    fireEvent.change(usernameInput, { target: { value: 'newuser' } });

    const saveButton = screen.getByText('Save Changes');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(onSaveMock).toHaveBeenCalledWith(expect.objectContaining({
        username: 'newuser',
      }));
    });
    console.log('Result: Success - onSave called with new username "newuser"');
  });

  it('does not render when closed', () => {
    console.log('Running: does not render when closed');
    const { container } = render(
      <EditCredentialModal
        isOpen={false}
        onClose={jest.fn()}
        entry={mockEntry}
        onSave={jest.fn()}
      />
    );

    expect(container).toBeEmptyDOMElement();
    console.log('Result: Success - container is empty');
  });
});
