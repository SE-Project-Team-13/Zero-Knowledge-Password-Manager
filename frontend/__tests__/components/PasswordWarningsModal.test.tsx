import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { PasswordWarningsModal } from '@/components/PasswordWarningsModal';
import { usePasswordAging } from '@/hooks/usePasswordAging';

// Mock UI components
jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// Mock hook with factory
const mockSnoozeEntry = jest.fn();
const mockGetLastUpdated = jest.fn(() => new Date('2020-01-01').getTime());
let mockAgingEntries = [
  {
    id: '1',
    site: 'OldSite',
    username: 'user1',
    updatedAt: '2020-01-01',
    lastUpdated: '2020-01-01',
  },
];

jest.mock('@/hooks/usePasswordAging', () => ({
  usePasswordAging: jest.fn(() => ({
    agingEntries: mockAgingEntries,
    getLastUpdatedMs: mockGetLastUpdated,
    snoozeEntry: mockSnoozeEntry,
  })),
}));

describe('PasswordWarningsModal', () => {
    // Reset mocks before each test
    beforeEach(() => {
        jest.clearAllMocks();
        mockAgingEntries = [
            {
                id: '1',
                site: 'OldSite',
                username: 'user1',
                updatedAt: '2020-01-01',
                lastUpdated: '2020-01-01',
            },
        ];
        (usePasswordAging as jest.Mock).mockReturnValue({
            agingEntries: mockAgingEntries,
            getLastUpdatedMs: mockGetLastUpdated,
            snoozeEntry: mockSnoozeEntry,
        });
    });

  it('renders correctly with warnings', () => {
    
    render(
      <PasswordWarningsModal
        isOpen={true}
        onClose={jest.fn()}
        onEdit={jest.fn()}
      />
    );

    expect(screen.getByText('Password Warnings')).toBeInTheDocument();
  });

  it('renders correctly with specific warning', () => {
    render(
        <PasswordWarningsModal
          isOpen={true}
          onClose={jest.fn()}
          onEdit={jest.fn()}
        />
      );
      expect(screen.getByText('OldSite')).toBeInTheDocument();
  });


  it('calls snoozeEntry when snooze button is clicked', () => {
    render(
      <PasswordWarningsModal
        isOpen={true}
        onClose={jest.fn()}
        onEdit={jest.fn()}
      />
    );

    const snoozeButtons = screen.getAllByText(/Snooze 7 days/i);
    fireEvent.click(snoozeButtons[0]);

    expect(mockSnoozeEntry).toHaveBeenCalledWith('1');
  });

   it('renders empty state correctly', () => {
    (usePasswordAging as jest.Mock).mockReturnValue({
      agingEntries: [],
      getLastUpdatedMs: mockGetLastUpdated,
      snoozeEntry: mockSnoozeEntry,
    });

    render(
      <PasswordWarningsModal
        isOpen={true}
        onClose={jest.fn()}
        onEdit={jest.fn()}
      />
    );

    expect(screen.getByText('No old passwords detected')).toBeInTheDocument();
  });
});
