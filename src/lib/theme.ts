import { createTheme, alpha } from '@mui/material/styles';

declare module '@mui/material/styles' {
    interface Palette {
        surface: Palette['primary'];
    }
    interface PaletteOptions {
        surface?: PaletteOptions['primary'];
    }
}

const theme = createTheme({
    palette: {
        primary: {
            main: '#2563EB',
            dark: '#1D4ED8',
            light: '#60A5FA',
            contrastText: '#FFFFFF',
        },
        secondary: {
            main: '#10B981',
            dark: '#059669',
            light: '#34D399',
            contrastText: '#FFFFFF',
        },
        warning: {
            main: '#F59E0B',
            dark: '#D97706',
            light: '#FCD34D',
        },
        error: {
            main: '#EF4444',
            dark: '#DC2626',
            light: '#FCA5A5',
        },
        background: {
            default: '#F7F8FA',
            paper: '#FFFFFF',
        },
        text: {
            primary: '#1A1D23',
            secondary: '#6B7280',
            disabled: '#9CA3AF',
        },
        divider: '#E4E7EC',
    },
    typography: {
        fontFamily: '"Inter", "Segoe UI", system-ui, -apple-system, sans-serif',
        h1: { fontSize: '2rem', fontWeight: 700, lineHeight: 1.3 },
        h2: { fontSize: '1.5rem', fontWeight: 700, lineHeight: 1.3 },
        h3: { fontSize: '1.25rem', fontWeight: 600, lineHeight: 1.3 },
        h4: { fontSize: '1.125rem', fontWeight: 600, lineHeight: 1.3 },
        h5: { fontSize: '1rem', fontWeight: 600, lineHeight: 1.3 },
        h6: { fontSize: '0.875rem', fontWeight: 600, lineHeight: 1.3 },
        body1: { fontSize: '0.875rem', fontWeight: 400, lineHeight: 1.5 },
        body2: { fontSize: '0.8125rem', fontWeight: 400, lineHeight: 1.5 },
        caption: { fontSize: '0.75rem', lineHeight: 1.4, color: '#9CA3AF' },
        overline: {
            fontSize: '0.6875rem',
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase' as const,
            lineHeight: 1.4,
            color: '#9CA3AF',
        },
    },
    spacing: 8,
    shape: {
        borderRadius: 8,
    },
    components: {
        MuiCssBaseline: {
            styleOverrides: {
                '@import': "url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap')",
                body: {
                    backgroundColor: '#F7F8FA',
                    fontFamily: '"Inter", "Segoe UI", system-ui, -apple-system, sans-serif',
                },
                '*': {
                    boxSizing: 'border-box',
                },
                '::-webkit-scrollbar': { width: '6px', height: '6px' },
                '::-webkit-scrollbar-track': { background: '#F3F4F6' },
                '::-webkit-scrollbar-thumb': { background: '#D1D5DB', borderRadius: '4px' },
                '::-webkit-scrollbar-thumb:hover': { background: '#9CA3AF' },
            },
        },
        MuiButton: {
            styleOverrides: {
                root: {
                    textTransform: 'none',
                    fontWeight: 600,
                    borderRadius: 8,
                    fontSize: '0.875rem',
                    '&:focus-visible': {
                        outline: '2px solid #2563EB',
                        outlineOffset: '2px',
                    },
                },
                contained: {
                    boxShadow: 'none',
                    '&:hover': {
                        boxShadow: 'none',
                    },
                },
                sizeLarge: { height: 44, padding: '0 24px' },
                sizeMedium: { height: 36, padding: '0 20px' },
                sizeSmall: { height: 32, padding: '0 16px', fontSize: '0.8125rem' },
            },
        },
        MuiCard: {
            styleOverrides: {
                root: {
                    borderRadius: 12,
                    border: '1px solid #E4E7EC',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)',
                },
            },
        },
        MuiChip: {
            styleOverrides: {
                root: {
                    borderRadius: 99,
                    fontWeight: 500,
                    '&:focus-visible': {
                        outline: '2px solid #2563EB',
                        outlineOffset: '2px',
                    },
                },
            },
        },
        MuiTextField: {
            defaultProps: {
                variant: 'outlined',
                size: 'small',
            },
            styleOverrides: {
                root: {
                    '& .MuiOutlinedInput-root': {
                        borderRadius: 6,
                        '&:focus-within': {
                            '& .MuiOutlinedInput-notchedOutline': {
                                borderColor: '#2563EB',
                                borderWidth: '2px',
                            },
                        },
                    },
                    '& .MuiInputBase-input': {
                        fontSize: '0.875rem',
                    },
                },
            },
        },
        MuiSelect: {
            defaultProps: {
                size: 'small',
            },
            styleOverrides: {
                root: {
                    borderRadius: 6,
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                        borderColor: '#2563EB',
                    },
                },
            },
        },
        MuiTooltip: {
            styleOverrides: {
                tooltip: {
                    borderRadius: 6,
                    fontSize: '0.75rem',
                    backgroundColor: '#1A1D23',
                },
            },
        },
        MuiLinearProgress: {
            styleOverrides: {
                root: {
                    borderRadius: 99,
                    height: 8,
                    backgroundColor: '#E4E7EC',
                },
                bar: {
                    borderRadius: 99,
                    backgroundImage: 'linear-gradient(90deg, #2563EB 0%, #60A5FA 100%)',
                },
            },
        },
        MuiListItemButton: {
            styleOverrides: {
                root: {
                    borderRadius: 8,
                    '&.Mui-selected': {
                        backgroundColor: alpha('#2563EB', 0.08),
                        color: '#2563EB',
                        '&:hover': {
                            backgroundColor: alpha('#2563EB', 0.12),
                        },
                        '& .MuiListItemIcon-root': {
                            color: '#2563EB',
                        },
                        '& .MuiListItemText-primary': {
                            fontWeight: 600,
                            color: '#2563EB',
                        },
                    },
                },
            },
        },
        MuiDrawer: {
            styleOverrides: {
                paper: {
                    border: 'none',
                    borderRight: '1px solid #E4E7EC',
                },
            },
        },
        MuiDivider: {
            styleOverrides: {
                root: { borderColor: '#E4E7EC' },
            },
        },
        MuiBreadcrumbs: {
            styleOverrides: {
                root: { fontSize: '0.8125rem' },
                separator: { color: '#9CA3AF' },
            },
        },
        MuiStepLabel: {
            styleOverrides: {
                label: {
                    fontSize: '0.75rem',
                    fontWeight: 400,
                    color: '#6B7280',
                    '&.Mui-active': { fontWeight: 600, color: '#2563EB' },
                    '&.Mui-completed': { fontWeight: 500, color: '#1A1D23' },
                },
            },
        },
        MuiStepIcon: {
            styleOverrides: {
                root: {
                    color: '#E4E7EC',
                    '&.Mui-active': { color: '#2563EB' },
                    '&.Mui-completed': { color: '#2563EB' },
                },
                text: { fill: '#9CA3AF', fontSize: '0.75rem', fontWeight: 600 },
            },
        },
        MuiStepConnector: {
            styleOverrides: {
                line: { borderColor: '#E4E7EC' },
            },
        },
        MuiAlert: {
            styleOverrides: {
                root: {
                    borderRadius: 8,
                    fontSize: '0.875rem',
                },
            },
        },
        MuiTableCell: {
            styleOverrides: {
                head: {
                    fontWeight: 600,
                    fontSize: '0.75rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: '#9CA3AF',
                    backgroundColor: '#F9FAFB',
                },
                body: {
                    fontSize: '0.875rem',
                    color: '#1A1D23',
                    borderBottom: '1px solid #F3F4F6',
                },
            },
        },
        MuiBadge: {
            styleOverrides: {
                badge: {
                    fontSize: '0.5625rem',
                    minWidth: 16,
                    height: 16,
                },
            },
        },
    },
});

export default theme;
