import React from 'react';
import { Box } from '@mui/material';
import TopBar, { TOPBAR_HEIGHT } from './TopBar';
import Sidebar, { SIDEBAR_WIDTH } from './Sidebar';

interface PageShellProps {
    children: React.ReactNode;
}

const PageShell: React.FC<PageShellProps> = ({ children }) => {
    return (
        <Box sx={{ display: 'flex', bgcolor: 'background.default', minHeight: '100vh' }}>
            <TopBar />
            <Sidebar />
            <Box
                component="main"
                sx={{
                    flexGrow: 1,
                    mt: `${TOPBAR_HEIGHT}px`,
                    ml: `${SIDEBAR_WIDTH}px`,
                    minHeight: `calc(100vh - ${TOPBAR_HEIGHT}px)`,
                    p: 0,
                }}
            >
                <Box
                    sx={{
                        maxWidth: 1280,
                        mx: 'auto',
                        pt: 5,
                        px: { xs: 2, md: 4 },
                        pb: 6,
                    }}
                >
                    {children}
                </Box>
            </Box>
        </Box>
    );
};

export default PageShell;
