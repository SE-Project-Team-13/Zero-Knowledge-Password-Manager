import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AddCredentialPage from "@/app/(authenticated)/add-credential/page";

const pushMock = jest.fn();
const addEntryMock = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

jest.mock("@/context/VaultContext", () => ({
  useVault: () => ({ addEntry: addEntryMock }),
}));

jest.mock("@/hooks/useVaultSync", () => ({
  useVaultSync: () => ([{ isAuthenticated: true }]),
}));

jest.mock("sonner", () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn(),
  },
}));

describe("AddCredentialPage", () => {
  beforeEach(() => {
    pushMock.mockClear();
    addEntryMock.mockClear();
  });

  it("submits a new credential and redirects", async () => {
    console.log("Running: submits a new credential and redirects");
    render(<AddCredentialPage />);

    fireEvent.change(screen.getByLabelText(/URL/i), { target: { value: "https://github.com" } });
    fireEvent.change(screen.getByLabelText(/Username\/Email/i), { target: { value: "user@example.com" } });
    fireEvent.change(screen.getByLabelText(/^Password$/i), { target: { value: "Secret123!" } });
    fireEvent.change(screen.getByLabelText(/Notes/i), { target: { value: "work" } });

    fireEvent.click(screen.getByRole("button", { name: /Save Password/i }));

    await waitFor(() => {
      expect(addEntryMock).toHaveBeenCalledWith({
        username: "user@example.com",
        password: "Secret123!",
        url: "https://github.com",
        notes: "work",
      });
    });

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/password-manager");
    });
    console.log("Result: Success - addEntry called and redirected");
  });

  it("shows error when required fields are missing", async () => {
    console.log("Running: shows error when required fields are missing");
    const { toast } = require("sonner");
    const { container } = render(<AddCredentialPage />);

    const form = container.querySelector("form");
    if (!form) throw new Error("Form not found");
    fireEvent.submit(form);

    await waitFor(() => {
      expect(addEntryMock).not.toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalled();
    });
    console.log("Result: Success - validation prevented submit and showed error");
  });

  it("trims leading and trailing whitespace from URL before submitting", async () => {
    console.log("Running: trims leading and trailing whitespace from URL before submitting");
    render(<AddCredentialPage />);

    fireEvent.change(screen.getByLabelText(/URL/i), { target: { value: "  example.com  " } });
    fireEvent.change(screen.getByLabelText(/Username\/Email/i), { target: { value: "user@example.com" } });
    fireEvent.change(screen.getByLabelText(/^Password$/i), { target: { value: "Secret123!" } });

    fireEvent.click(screen.getByRole("button", { name: /Save Password/i }));

    await waitFor(() => {
      expect(addEntryMock).toHaveBeenCalledWith({
        username: "user@example.com",
        password: "Secret123!",
        url: "example.com",
        notes: "",
      });
    });
    console.log("Result: Success - URL was trimmed before calling addEntry");
  });

  it("rejects whitespace-only URL values", async () => {
    console.log("Running: rejects whitespace-only URL values");
    const { toast } = require("sonner");
    render(<AddCredentialPage />);

    fireEvent.change(screen.getByLabelText(/URL/i), { target: { value: "   " } });
    fireEvent.change(screen.getByLabelText(/Username\/Email/i), { target: { value: "user@example.com" } });
    fireEvent.change(screen.getByLabelText(/^Password$/i), { target: { value: "Secret123!" } });

    fireEvent.click(screen.getByRole("button", { name: /Save Password/i }));

    await waitFor(() => {
      expect(addEntryMock).not.toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalledWith(
        "Please complete all required fields (URL, Username, and Password)"
      );
    });
    console.log("Result: Success - whitespace-only URL rejected, error toast shown");
  });
});
