import React, { useState } from 'react';
import {
    AppBar, Toolbar, Box, Typography, IconButton, Avatar,
    Badge, Divider, Tooltip, Button, Menu, MenuItem,
} from '@mui/material';
import {
    Cloud as CloudIcon,
    NotificationsOutlined,
    HelpOutline,
    KeyboardArrowDown,
} from '@mui/icons-material';
import { Link } from 'react-router-dom';

export const TOPBAR_HEIGHT = 64;

const TopBar: React.FC = () => {
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

    return (
        <AppBar
            position="fixed"
            elevation={0}
            sx={{
                bgcolor: '#fff',
                borderBottom: '1px solid #E4E7EC',
                height: TOPBAR_HEIGHT,
                zIndex: (theme) => theme.zIndex.drawer + 1,
                color: 'text.primary',
            }}
        >
            <Toolbar sx={{ height: TOPBAR_HEIGHT, px: { xs: 2, md: 3 }, minHeight: `${TOPBAR_HEIGHT}px !important` }}>
                {/* Logo */}
                <Box component={Link} to="/" sx={{ display: 'flex', alignItems: 'center', gap: 1, textDecoration: 'none', mr: 4 }}>
                    <CloudIcon sx={{ color: 'primary.main', fontSize: 26 }} />
                    <Typography sx={{ fontSize: '1.0625rem', fontWeight: 700, lineHeight: 1 }}>
                        <Box component="span" sx={{ color: '#1A1D23' }}>Cloud</Box>
                        <Box component="span" sx={{ color: 'primary.main' }}> Environment</Box>
                        <Box component="span" sx={{ color: '#1A1D23' }}> Analyzer</Box>
                    </Typography>
                </Box>

                <Box sx={{ flexGrow: 1 }} />

                {/* Right cluster */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Button
                        component={Link}
                        to="/settings"
                        startIcon={<HelpOutline sx={{ fontSize: 18 }} />}
                        size="small"
                        variant="text"
                        sx={{ color: 'text.secondary', fontWeight: 400, display: { xs: 'none', sm: 'inline-flex' } }}
                    >
                        Help
                    </Button>

                    <Tooltip title="Notifications">
                        <IconButton size="small" sx={{ color: 'text.secondary' }}>
                            <Badge badgeContent={3} color="error">
                                <NotificationsOutlined fontSize="small" />
                            </Badge>
                        </IconButton>
                    </Tooltip>

                    <Divider orientation="vertical" flexItem sx={{ mx: 1, height: 24, alignSelf: 'center' }} />

                    {/* User Avatar */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer' }}
                        onClick={(e) => setAnchorEl(e.currentTarget as HTMLElement)}>
                        <Avatar
                            sx={{
                                width: 32, height: 32,
                                bgcolor: '#DBEAFE',
                                color: '#1D4ED8',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                            }}
                        >
                            JR
                        </Avatar>
                        <KeyboardArrowDown sx={{ color: 'text.secondary', fontSize: 18 }} />
                    </Box>

                    <Menu
                        anchorEl={anchorEl}
                        open={Boolean(anchorEl)}
                        onClose={() => setAnchorEl(null)}
                        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
                        PaperProps={{ sx: { mt: 1, minWidth: 180, borderRadius: 2, border: '1px solid #E4E7EC', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' } }}
                    >
                        <MenuItem dense sx={{ py: 1 }}>
                            <Box>
                                <Typography variant="body2" fontWeight={600}>John Reynolds</Typography>
                                <Typography variant="caption">j.reynolds@deloitte.com</Typography>
                            </Box>
                        </MenuItem>
                        <Divider />
                        <MenuItem dense component={Link} to="/settings" onClick={() => setAnchorEl(null)}>Profile Settings</MenuItem>
                        <MenuItem dense sx={{ color: 'error.main' }}>Sign Out</MenuItem>
                    </Menu>
                </Box>
            </Toolbar>
        </AppBar>
    );
};

export default TopBar;
