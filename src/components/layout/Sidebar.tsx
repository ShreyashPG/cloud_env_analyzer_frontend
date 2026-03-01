import React from 'react';
import {
    Drawer, List, ListItemButton, ListItemIcon, ListItemText,
    Box, Typography, Divider, Tooltip,
} from '@mui/material';
import {
    DashboardOutlined,
    UploadFileOutlined,
    TravelExploreOutlined,
    VerifiedOutlined,
    CompareArrowsOutlined,
    AssessmentOutlined,
    SettingsOutlined,
} from '@mui/icons-material';
import { useLocation, Link } from 'react-router-dom';
import { TOPBAR_HEIGHT } from './TopBar';

export const SIDEBAR_WIDTH = 240;

const NAV_ITEMS = [
    { label: 'Dashboard', icon: <DashboardOutlined />, path: '/' },
    { label: 'Upload & Extract', icon: <UploadFileOutlined />, path: '/extract' },
    { label: 'Scan', icon: <TravelExploreOutlined />, path: '/scan' },
    { label: 'Validation', icon: <VerifiedOutlined />, path: '/validation' },
    { label: 'Comparison', icon: <CompareArrowsOutlined />, path: '/comparison' },
    { label: 'Reports', icon: <AssessmentOutlined />, path: '/reports' },
];

const BOTTOM_ITEMS = [
    { label: 'Settings', icon: <SettingsOutlined />, path: '/settings' },
];

const Sidebar: React.FC = () => {
    const location = useLocation();

    const navItem = (item: (typeof NAV_ITEMS)[0]) => (
        <Tooltip key={item.path} title="" placement="right">
            <ListItemButton
                component={Link}
                to={item.path}
                selected={
                    item.path === '/'
                        ? location.pathname === '/'
                        : location.pathname.startsWith(item.path)
                }
                sx={{ mx: 1, mb: 0.5, borderRadius: 2 }}
            >
                <ListItemIcon sx={{ minWidth: 36, '& svg': { fontSize: 20 } }}>
                    {item.icon}
                </ListItemIcon>
                <ListItemText
                    primary={item.label}
                    primaryTypographyProps={{ fontSize: '0.875rem', fontWeight: 500 }}
                />
            </ListItemButton>
        </Tooltip>
    );

    return (
        <Drawer
            variant="permanent"
            sx={{
                width: SIDEBAR_WIDTH,
                flexShrink: 0,
                '& .MuiDrawer-paper': {
                    width: SIDEBAR_WIDTH,
                    boxSizing: 'border-box',
                    top: TOPBAR_HEIGHT,
                    height: `calc(100vh - ${TOPBAR_HEIGHT}px)`,
                    overflowX: 'hidden',
                    bgcolor: '#fff',
                },
            }}
        >
            <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', py: 2 }}>
                {/* Main nav */}
                <List disablePadding sx={{ flexGrow: 1 }}>
                    <Box sx={{ px: 2, mb: 1 }}>
                        <Typography variant="overline" sx={{ color: '#9CA3AF', fontSize: '0.625rem' }}>
                            Navigation
                        </Typography>
                    </Box>
                    {NAV_ITEMS.map(navItem)}
                </List>

                <Divider sx={{ mx: 2, my: 1 }} />

                {/* Bottom nav */}
                <List disablePadding>
                    {BOTTOM_ITEMS.map(navItem)}
                </List>

                {/* Version tag */}
                <Box sx={{ px: 2, py: 1 }}>
                    <Typography variant="caption" sx={{ color: '#D1D5DB' }}>
                        v1.0.0 · Deloitte Internal
                    </Typography>
                </Box>
            </Box>
        </Drawer>
    );
};

export default Sidebar;
