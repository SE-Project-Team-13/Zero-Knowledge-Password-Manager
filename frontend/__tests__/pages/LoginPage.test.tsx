import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import LoginPage from "@/app/login/page";
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
  },
}));

jest.mock("@/components/ThemeToggle", () => ({
  ThemeToggle: () => <div data-testid="theme-toggle" />,
}));

describe("LoginPage", () => {
  const pushMock = jest.fn();
  const loginMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ push: pushMock });
    (useVaultSync as jest.Mock).mockReturnValue([{ isLoading: false, error: null }, { login: loginMock }]);
    (apiClient.checkEmail as jest.Mock).mockResolvedValue({ exists: true });
  });

  it("renders the login form correctly", () => {
    render(<LoginPage />);
    expect(screen.getByText("Welcome Back")).toBeInTheDocument();
    expect(screen.getByLabelText(/Email Address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Master Password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Sign In/i })).toBeInTheDocument();
  });

  it("submits the form and redirects to /otp on success", async () => {
    render(<LoginPage />);
    
    fireEvent.change(screen.getByLabelText(/Email Address/i), { target: { value: "test@example.com" } });
    fireEvent.change(screen.getByLabelText(/Master Password/i), { target: { value: "password123" } });
    
    loginMock.mockResolvedValueOnce({ is2faEnabled: true });
    fireEvent.click(screen.getByRole("button", { name: /Sign In/i }));

    await waitFor(() => {
      expect(loginMock).toHaveBeenCalledWith("test@example.com", "password123");
    });

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/otp");
    });
  });

  it("shows an error message if login fails", async () => {
    loginMock.mockRejectedValue(new Error("Invalid credentials"));
    render(<LoginPage />);

    
    fireEvent.change(screen.getByLabelText(/Email Address/i), { target: { value: "test@example.com" } });
    fireEvent.change(screen.getByLabelText(/Master Password/i), { target: { value: "wrongpassword" } });
    
    fireEvent.click(screen.getByRole("button", { name: /Sign In/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Invalid credentials");
    });
  });

  it("redirects to /register when sign up button is clicked", () => {
    render(<LoginPage />);
    fireEvent.click(screen.getByRole("button", { name: /Sign up/i }));
    expect(pushMock).toHaveBeenCalledWith("/register");
  });
});
