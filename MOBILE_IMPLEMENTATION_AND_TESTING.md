# Mobile App: Detailed Implementation & Testing Plan

## 1. Implementation Strategy

### Phase 1: Environment & Monorepo Setup

**Goal**: Initialize the React Native project and ensure it can consume the shared `crypto-engine`.

1.  **Scaffold Project**:
    - Initialize `mobile` directory using `create-expo-app` with TypeScript.
    - register `mobile` in root `package.json` workspaces.
2.  **Monorepo Integration**:
    - **Metro Configuration**: Custom `metro.config.js` to allow resolving dependencies from the workspace root (hoisted `node_modules`) and the `crypto-engine` package.
    - **Path Aliases**: Update `tsconfig.json` to map `@password-manager/crypto-engine` to the local package.
3.  **Polyfills**:
    - Install `react-native-get-random-values` and `text-encoding` to support the Web Crypto API used by the `crypto-engine`.

### Phase 2: Core Architecture & State

**Goal**: Build the foundation for data flow and secure memory management.

1.  **State Management**:
    - Use **Zustand** for global state (lighter than Redux).
    - **Stores**:
      - `authStore`: Holds the _decrypted_ Master Key (in memory ONLY).
      - `vaultStore`: Holds the list of encrypted/decrypted items.
2.  **Secure Storage Layer**:
    - Use `expo-secure-store` to persist authentication tokens (Session ID) and the _Encrypted_ Account Key (not the Master Password itself).
3.  **Networking**:
    - Use **TanStack Query (React Query)** for data fetching, caching, and synchronization state.
    - Create an `Axios` instance interceptor to attach the session token to requests.

### Phase 3: Application Features (MVP)

**Goal**: A functional password manager.

1.  **Authentication Screens**:
    - `LoginScreen`: Input email/password -> derive key -> authenticate with backend.
    - `BiometricPrompt`: Use `expo-local-authentication` to unlock the app if the session is valid but locked.
2.  **Vault Management**:
    - `VaultListScreen`: FlatList rendering of vault items.
    - `ItemDetailScreen`: View details. Implement "Tap to Copy" and "Job to Reveal" for passwords.
    - `EditItemScreen`: Form with validation (Zod + React Hook Form).
3.  **Sync Logic**:
    - Implement "Pull on Refresh" and "Push on Save" for vault items.

## 2. Testing Strategy

### A. Unit Testing (Jest)

**Scope**: Logic-heavy components and utilities.

- **Tools**: `jest`, `jest-expo`, `@testing-library/react-native`.
- **Key Test Cases**:
  - **Crypto Integration**: Verify that `crypto-engine` functions (encrypt/decrypt) return expected results in the RN environment.
  - **State Reducers**: Verify `authStore` clears sensitive data on logout.
  - **Utils**: Test formatting, validation helpers.

### B. Integration Testing

**Scope**: Component interactions and Data Flow.

- **Tools**: `@testing-library/react-native`.
- **Strategy**:
  - **Mock Backend**: Mock the API calls (MSW or simple Jest mocks).
  - **Flow**:
    - Render `LoginScreen`.
    - Simulate user input.
    - Assert that `login()` from `authStore` is called.
    - Assert navigation to `VaultListScreen`.

### C. End-to-End (E2E) Testing (Maestro)

**Scope**: Full User Journeys on simulated devices. `Maestro` is preferred over Appium for its simplicity and speed with Expo.

- **Tools**: [Maestro](https://maestro.mobile.dev/).
- **Test Flows (`flow.yaml`)**:
  1.  **Onboarding**: Create account -> Land on empty vault.
  2.  **CRUD Cycle**: Login -> Add Password -> Verify in List -> Edit Password -> Delete Password.
  3.  **Offline Handling**: Turn off network -> Attempt read (should work) -> Attempt write (should queue or warn).

## 3. Immediate Action Plan (Next 4 Steps)

1.  **Step 1**: Run `npx create-expo-app mobile --template blank-typescript`.
2.  **Step 2**: Configure `metro.config.js` for monorepo support.
3.  **Step 3**: Install `jest-expo` and configure the test runner.
4.  **Step 4**: Create a "Hello World" test to verify the setup.
