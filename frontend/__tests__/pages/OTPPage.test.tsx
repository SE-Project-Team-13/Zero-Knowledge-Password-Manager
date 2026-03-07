import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import OTPPage from "@/app/otp/page";
import { useRouter } from "next/navigation";
import { useVaultSync } from "@/hooks/useVaultSync";
import { useVault } from "@/context/VaultContext";

// Mock dependencies
jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
}));

jest.mock("@/hooks/useVaultSync", () => ({
  useVaultSync: jest.fn(),
}));

jest.mock("@/context/VaultContext", () => ({
  useVault: jest.fn(),
}));

jest.mock("sonner", () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn(),
  },
}));

jest.mock("@/components/ThemeToggle", () => ({
  ThemeToggle: () => <div data-testid="theme-toggle" />,
}));

// Mock global fetch
global.fetch = jest.fn();

describe("OTPPage", () => {
  const pushMock = jest.fn();
  const unlockVaultMock = jest.fn();
  const logoutMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ push: pushMock });
    (useVaultSync as jest.Mock).mockReturnValue([{ isAuthenticated: true, email: "test@example.com", isLoading: false }, { logout: logoutMock, refreshProfile: jest.fn().mockResolvedValue({}) }]);
    (useVault as jest.Mock).mockReturnValue({ unlockVault: unlockVaultMock, isUnlocked: false });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ message: "Success" }),
    });

    // Mock sessionStorage
    const store: Record<string, string> = {};
    Object.defineProperty(window, 'sessionStorage', {
      value: {
        getItem: (key: string) => store[key] || null,
        setItem: (key: string, value: string) => { store[key] = value; },
        removeItem: (key: string) => { delete store[key]; },
        clear: () => { Object.keys(store).forEach(k => delete store[k]); }
      },
      writable: true
    });
  });

  it("renders the identity verification screen", async () => {
    render(<OTPPage />);
    expect(screen.getByText("Verify Identity")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("000000")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Verify & Unlock/i })).toBeInTheDocument();
    
    await waitFor(() => {
      expect(screen.queryByText(/Sending OTP/i)).not.toBeInTheDocument();
    });
  });

  it("sends OTP on mount if not already sent", async () => {
    render(<OTPPage />);
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/otp/send"),
        expect.objectContaining({ method: "POST" })
      );
    });
    
    await waitFor(() => {
      expect(screen.queryByText(/Sending OTP/i)).not.toBeInTheDocument();
    });
  });

  it("verifies OTP and redirects to dashboard", async () => {
    sessionStorage.setItem("session_master_password", "password123");
    render(<OTPPage />);
    
    // Wait for initial OTP send
    await waitFor(() => expect(screen.queryByText(/Sending OTP/i)).not.toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText("000000"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: /Verify & Unlock/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/otp/verify"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ email: "test@example.com", code: "123456" })
        })
      );
    });

    await waitFor(() => {
      expect(unlockVaultMock).toHaveBeenCalled();
      expect(pushMock).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("logs out and redirects to login when logout button is clicked", async () => {
    render(<OTPPage />);
    
    await waitFor(() => {
      expect(screen.queryByText(/Sending OTP/i)).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Logout and clear session/i }));
    expect(logoutMock).toHaveBeenCalled();
    expect(pushMock).toHaveBeenCalledWith("/login");
  });
});
