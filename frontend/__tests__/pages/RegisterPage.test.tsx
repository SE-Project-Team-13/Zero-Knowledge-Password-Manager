import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import RegisterPage from "@/app/register/page";
import { useRouter } from "next/navigation";
import { useVaultSync } from "@/hooks/useVaultSync";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";


// Mock dependencies
jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
}));

jest.mock("@/hooks/useVaultSync", () => ({
  useVaultSync: jest.fn(),
}));

jest.mock("@/lib/api-client", () => ({
  apiClient: {
    checkEmail: jest.fn(),
  },
}));

jest.mock("sonner", () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn(),
    info: jest.fn(),
  },
}));

jest.mock("@/components/ThemeToggle", () => ({
  ThemeToggle: () => <div data-testid="theme-toggle" />,
}));

jest.mock("@/components/PasswordStrength", () => ({
  PasswordStrength: ({ onStrengthChange }: { onStrengthChange: (valid: boolean) => void }) => {
    // Automatically trigger validity for testing
    React.useEffect(() => {
      onStrengthChange(true);
    }, [onStrengthChange]);
    return <div data-testid="password-strength" />;
  },
}));

jest.mock("@/lib/recovery", () => ({
  generateAndDownloadRecoveryKey: jest.fn(),
}));

describe("RegisterPage", () => {
  const pushMock = jest.fn();
  const registerMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ push: pushMock });
    (useVaultSync as jest.Mock).mockReturnValue([{ isLoading: false, error: null }, { register: registerMock }]);
    (apiClient.checkEmail as jest.Mock).mockResolvedValue({ exists: false });

    // Mock localStorage
    const localStore: Record<string, string> = { "auth_token": "mock-token" };
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: (key: string) => localStore[key] || null,
        setItem: (key: string, value: string) => { localStore[key] = value; },
        removeItem: (key: string) => { delete localStore[key]; },
        clear: () => { Object.keys(localStore).forEach(k => delete localStore[k]); }
      },
      writable: true
    });

    // Mock sessionStorage
    const sessionStore: Record<string, string> = {};
    Object.defineProperty(window, 'sessionStorage', {
      value: {
        getItem: (key: string) => sessionStore[key] || null,
        setItem: (key: string, value: string) => { sessionStore[key] = value; },
        removeItem: (key: string) => { delete sessionStore[key]; },
        clear: () => { Object.keys(sessionStore).forEach(k => delete sessionStore[k]); }
      },
      writable: true
    });
  });

  it("renders the registration form correctly", async () => {
    render(<RegisterPage />);

    
    // Wait for mount
    await waitFor(() => {
      expect(screen.getByLabelText(/Full Name/i)).toBeInTheDocument();
    });

    expect(screen.getByLabelText(/Email Address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Master Password$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Confirm Password/i)).toBeInTheDocument();
    
    // Find button by role and name
    const submitButtons = screen.getAllByRole("button", { name: /Create Account/i });
    expect(submitButtons.length).toBeGreaterThan(0);
  });

  it("submits the form and redirects to /otp on success", async () => {
    registerMock.mockResolvedValueOnce(undefined);
    render(<RegisterPage />);
    
    // Wait for mount
    await waitFor(() => {
      expect(screen.getByLabelText(/Full Name/i)).toBeInTheDocument();
    });
    
    fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: "Test User" } });
    fireEvent.change(screen.getByLabelText(/Email Address/i), { target: { value: "test@example.com" } });
    fireEvent.change(screen.getByLabelText(/^Master Password$/i), { target: { value: "Password123!" } });
    fireEvent.change(screen.getByLabelText(/Confirm Password/i), { target: { value: "Password123!" } });
    
    const submitButton = screen.getByRole("button", { name: /Create Account/i });
    
    // Wait for button to be enabled (PasswordStrength mock triggers this)
    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
    });

    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(registerMock).toHaveBeenCalled();
    }, { timeout: 3000 });

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/otp");
    }, { timeout: 3000 });
  });

  it("shows error if passwords do not match", async () => {
    render(<RegisterPage />);

    
    // Wait for mount
    await waitFor(() => {
      expect(screen.getByLabelText(/Full Name/i)).toBeInTheDocument();
    });
    
    fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: "Test User" } });
    fireEvent.change(screen.getByLabelText(/Email Address/i), { target: { value: "test@example.com" } });
    fireEvent.change(screen.getByLabelText(/^Master Password$/i), { target: { value: "Password123!" } });
    fireEvent.change(screen.getByLabelText(/Confirm Password/i), { target: { value: "Mismatch123!" } });
    
    const submitButton = screen.getByRole("button", { name: /Create Account/i });
    
    // Wait for button to be enabled (PasswordStrength mock triggers this)
    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
    });

    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Passwords do not match");
    });
  });

  it("redirects to /login when sign in button is clicked", async () => {
    render(<RegisterPage />);
    
    // Wait for mount
    await waitFor(() => {
      expect(screen.getByText(/Already have an account/i)).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByRole("button", { name: /Sign in/i }));
    expect(pushMock).toHaveBeenCalledWith("/login");
  });
});
