import { Platform } from "react-native";

// Detect if we are running in an emulator or real device
const getBaseUrl = () => {
    // For development on real devices, use your machine's LAN IP
    // For emulator, you might want 10.0.2.2, but for now we prioritize the real device
    return 'http://10.12.226.184:3001';
};

export const API_URL = getBaseUrl();
