import React from 'react';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { BrowserRouter } from 'react-router-dom';
import { SnackbarProvider } from 'notistack';
import theme from './lib/theme';
import AppRouter from './router';

const App: React.FC = () => (
  <ThemeProvider theme={theme}>
    <CssBaseline />
    <SnackbarProvider
      maxSnack={3}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      autoHideDuration={4000}
    >
      <BrowserRouter>
        <AppRouter />
      </BrowserRouter>
    </SnackbarProvider>
  </ThemeProvider>
);

export default App;
