// Shared design tokens — dark cyber theme matching the web app
export const Colors = {
    background: '#0A0B1A',
    surface: '#141526',
    surfaceElevated: '#1A1B2E',
    border: '#1E2035',
    primary: '#00B4D8',
    primaryDim: 'rgba(0,180,216,0.15)',
    primaryBorder: 'rgba(0,180,216,0.25)',
    text: '#E8F0FF',
    textMuted: '#6B7A99',
    textDim: '#3A4260',
    destructive: '#EF4444',
    destructiveDim: 'rgba(239,68,68,0.15)',
    success: '#10B981',
    warning: '#F59E0B',
    purple: '#7C3AED',
    purpleDim: 'rgba(124,58,237,0.15)',
    cardGradientStart: 'rgba(0,180,216,0.08)',
    cardGradientEnd: 'rgba(10,11,26,0)',
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
