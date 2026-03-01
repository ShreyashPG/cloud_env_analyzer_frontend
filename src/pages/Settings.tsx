import React, { useState } from 'react';
import {
    Box, Card, CardContent, Typography, Divider, TextField,
    Button, Switch, FormControlLabel, Select, MenuItem, FormControl,
    InputLabel, Breadcrumbs, Alert,
} from '@mui/material';
import { Grid } from '@mui/material';
import { NavigateNext, Save } from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import PageShell from '../components/layout/PageShell';
import { CLOUD_PROVIDERS } from '../lib/constants';

const Settings: React.FC = () => {
    const { enqueueSnackbar } = useSnackbar();
    const [defaultProvider, setDefaultProvider] = useState('aws');
    const [autoValidate, setAutoValidate] = useState(true);
    const [emailNotifications, setEmailNotifications] = useState(true);
    const [maxFileSize, setMaxFileSize] = useState('50');

    return (
        <PageShell>
            <Breadcrumbs separator={<NavigateNext fontSize="small" sx={{ color: '#9CA3AF' }} />} sx={{ mb: 1 }}>
                <Typography component="a" href="/" sx={{ fontSize: '0.8125rem', color: 'text.secondary', textDecoration: 'none' }}>Dashboard</Typography>
                <Typography sx={{ fontSize: '0.8125rem', color: 'text.primary', fontWeight: 500 }}>Settings</Typography>
            </Breadcrumbs>

            <Box sx={{ mb: 4 }}>
                <Typography variant="h1" sx={{ fontSize: { xs: '1.375rem', md: '1.75rem' }, fontWeight: 600, mb: 0.5 }}>Settings</Typography>
                <Typography variant="body2" color="text.secondary">Manage your preferences and application configuration.</Typography>
            </Box>

            <Grid container spacing={3}>
                <Grid size={{ xs: 12, md: 8 }}>
                    {/* Profile */}
                    <Card sx={{ mb: 3 }}>
                        <CardContent sx={{ p: 3.5 }}>
                            <Typography variant="h5" gutterBottom>Profile</Typography>
                            <Divider sx={{ mb: 3 }} />
                            <Grid container spacing={2}>
                                <Grid size={{ xs: 6 }}><TextField fullWidth label="First Name" defaultValue="John" /></Grid>
                                <Grid size={{ xs: 6 }}><TextField fullWidth label="Last Name" defaultValue="Reynolds" /></Grid>
                                <Grid size={{ xs: 12 }}><TextField fullWidth label="Email" defaultValue="j.reynolds@deloitte.com" /></Grid>
                                <Grid size={{ xs: 12 }}><TextField fullWidth label="Organization" defaultValue="Deloitte" /></Grid>
                            </Grid>
                        </CardContent>
                    </Card>

                    {/* Preferences */}
                    <Card sx={{ mb: 3 }}>
                        <CardContent sx={{ p: 3.5 }}>
                            <Typography variant="h5" gutterBottom>Preferences</Typography>
                            <Divider sx={{ mb: 3 }} />
                            <FormControl fullWidth sx={{ mb: 3 }}>
                                <InputLabel>Default Cloud Provider</InputLabel>
                                <Select value={defaultProvider} label="Default Cloud Provider" onChange={(e) => setDefaultProvider(e.target.value)}>
                                    {CLOUD_PROVIDERS.map((p) => (
                                        <MenuItem key={p.id} value={p.id}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: p.color }} />{p.label}
                                            </Box>
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                            <TextField fullWidth label="Max File Upload Size (MB)" value={maxFileSize} onChange={(e) => setMaxFileSize(e.target.value)} type="number" sx={{ mb: 3 }} />
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                                <FormControlLabel
                                    control={<Switch checked={autoValidate} onChange={(e) => setAutoValidate(e.target.checked)} color="primary" />}
                                    label={<Box><Typography variant="body2" fontWeight={500}>Auto-validate after extraction</Typography><Typography variant="caption" color="text.secondary">Automatically run validation when extraction completes</Typography></Box>}
                                />
                                <FormControlLabel
                                    control={<Switch checked={emailNotifications} onChange={(e) => setEmailNotifications(e.target.checked)} color="primary" />}
                                    label={<Box><Typography variant="body2" fontWeight={500}>Email notifications</Typography><Typography variant="caption" color="text.secondary">Receive email alerts for scan and extraction results</Typography></Box>}
                                />
                            </Box>
                        </CardContent>
                    </Card>

                    <Button variant="contained" size="large" startIcon={<Save />} onClick={() => enqueueSnackbar('Settings saved!', { variant: 'success' })}>
                        Save Settings
                    </Button>
                </Grid>

                <Grid size={{ xs: 12, md: 4 }}>
                    <Card>
                        <CardContent sx={{ p: 3.5 }}>
                            <Typography variant="h5" gutterBottom>About</Typography>
                            <Divider sx={{ mb: 2 }} />
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                                {[
                                    { label: 'Product', value: 'Cloud Environment Analyzer' },
                                    { label: 'Version', value: 'v1.0.0' },
                                    { label: 'Build', value: 'March 2026' },
                                    { label: 'Organization', value: 'Deloitte' },
                                    { label: 'License', value: 'Internal Use Only' },
                                ].map(({ label, value }) => (
                                    <Box key={label}>
                                        <Typography variant="overline" sx={{ color: '#9CA3AF' }}>{label}</Typography>
                                        <Typography variant="body2" fontWeight={500}>{value}</Typography>
                                    </Box>
                                ))}
                            </Box>
                            <Divider sx={{ my: 2 }} />
                            <Alert severity="info" sx={{ fontSize: '0.8125rem' }}>For support, contact the Deloitte SDE team or raise a ticket in your internal issue tracker.</Alert>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>
        </PageShell>
    );
};

export default Settings;
