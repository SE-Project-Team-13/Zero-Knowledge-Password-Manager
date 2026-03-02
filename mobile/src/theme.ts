// Shared design tokens — Obsidian & Gold theme
export const Colors = {
    background: '#000000',
    surface: '#0A0A0A',
    surfaceElevated: '#121212',
    border: '#1A1A1A',
    primary: '#FACC15', // Vibrant Yellow-400
    primaryDim: 'rgba(250, 204, 21, 0.12)',
    primaryBorder: 'rgba(250, 204, 21, 0.25)',
    text: '#FFFFFF',
    textMuted: '#A1A1AA',
    textDim: '#52525B', // Zinc-600
    destructive: '#EF4444',
    destructiveDim: 'rgba(239, 68, 68, 0.15)',
    success: '#22C55E',
    warning: '#FACC15',
    purple: '#FACC15', // Simplified most accents to yellow for consistency
    purpleDim: 'rgba(250, 204, 21, 0.12)',
    cardGradientStart: 'rgba(250, 204, 21, 0.1)',
    cardGradientEnd: 'rgba(0, 0, 0, 0)',
};

export const Spacing = {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
};

export const Radius = {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    full: 9999,
};

export const Typography = {
    heading: {
        fontFamily: 'System',
        fontWeight: '700' as const,
        color: Colors.text,
        letterSpacing: -0.5,
    },
    subheading: {
        fontFamily: 'System',
        fontWeight: '600' as const,
        color: Colors.text,
    },
    body: {
        fontFamily: 'System',
        fontWeight: '400' as const,
        color: Colors.text,
    },
    muted: {
        fontFamily: 'System',
        fontWeight: '400' as const,
        color: Colors.textMuted,
    },
    mono: {
        fontFamily: 'Courier New',
        fontWeight: '400' as const,
        color: Colors.text,
    },
};
