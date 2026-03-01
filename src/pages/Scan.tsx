import React, { useState, useEffect, useRef } from 'react';
import {
    Box, Card, CardContent, Typography, Button, TextField,
    Select, MenuItem, FormControl, InputLabel, Stepper, Step, StepLabel,
    LinearProgress, Chip, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, Breadcrumbs, Divider, Alert, Collapse,
    IconButton, Tooltip,
} from '@mui/material';
import { Grid } from '@mui/material';
import {
    NavigateNext, PlayArrow, CheckCircle, ErrorOutline, Cancel,
    ExpandMore, ExpandLess, Warning,
} from '@mui/icons-material';
import { useScanStore } from '../store/scanStore';
import { getScans, startScan } from '../api/scan';
import { formatDateTime } from '../lib/formatters';
import { CLOUD_PROVIDERS } from '../lib/constants';
import { sleep } from '../lib/utils';
import { useSnackbar } from 'notistack';
import PageShell from '../components/layout/PageShell';

const SCAN_STEPS = [
    { label: 'Authenticating', domain: 'identity' },
    { label: 'Discovering Resources', domain: 'resources' },
    { label: 'Analyzing IAM/RBAC', domain: 'identity' },
    { label: 'Checking Network', domain: 'network' },
    { label: 'Validating Services', domain: 'services' },
    { label: 'Checking Policies', domain: 'policy' },
    { label: 'Generating Report', domain: 'general' },
];

const DOMAIN_COLORS: Record<string, string> = {
    identity: '#8B5CF6', network: '#2563EB', resources: '#10B981',
    services: '#F59E0B', policy: '#EF4444', general: '#6B7280',
};

const Scan: React.FC = () => {
    const { scans, setScans, isScanning, setIsScanning, scanProgress, setScanProgress, currentStep, setCurrentStep } = useScanStore();
    const { enqueueSnackbar } = useSnackbar();

    const [provider, setProvider] = useState('azure');
    const [environment, setEnvironment] = useState('production');
    const [scope, setScope] = useState('');
    const [credentials, setCredentials] = useState<Record<string, string>>({});
    const [activeStep, setActiveStep] = useState(0);
    const [eta, setEta] = useState<number | null>(null);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [partialSections, setPartialSections] = useState<string[]>([]);
    const cancelRef = useRef(false);
    const startTimeRef = useRef<number>(0);

    useEffect(() => { getScans().then(setScans).catch(() => { }); }, []);

    const handleStartScan = async () => {
        if (!provider) { enqueueSnackbar('Please select a cloud provider.', { variant: 'warning' }); return; }
        cancelRef.current = false;
        setIsScanning(true); setScanProgress(0); setActiveStep(0);
        setPartialSections([]); setEta(null);
        startTimeRef.current = Date.now();

        try {
            for (let i = 0; i < SCAN_STEPS.length; i++) {
                if (cancelRef.current) break;
                setCurrentStep(SCAN_STEPS[i].label); setActiveStep(i);

                const stepsTotal = SCAN_STEPS.length;
                const startPct = (i / stepsTotal) * 100;
                const endPct = ((i + 1) / stepsTotal) * 100;

                for (let pct = startPct; pct < endPct; pct += 3) {
                    if (cancelRef.current) break;
                    await sleep(120);
                    const rounded = Math.min(Math.round(pct), 99);
                    setScanProgress(rounded);
                    // Update ETA
                    const elapsed = (Date.now() - startTimeRef.current) / 1000;
                    if (rounded > 5) setEta(Math.max(0, Math.round((100 - rounded) * (elapsed / rounded))));
                }

                // Simulate occasional partial-result warning (step 2 = network sometimes limited)
                if (i === 3 && Math.random() < 0.4) {
                    setPartialSections((prev) => [...prev, 'Network']);
                }
            }

            if (!cancelRef.current) {
                setScanProgress(100); setCurrentStep('Complete'); setEta(0);
                const scan = await startScan({ provider, environment, credentials });
                setScans([{ ...scan, status: 'completed', resourceCount: 147, issueCount: 3, scope }, ...scans]);
                enqueueSnackbar('Scan completed successfully!', { variant: 'success' });
            } else {
                enqueueSnackbar('Scan cancelled.', { variant: 'warning' });
            }
        } catch {
            enqueueSnackbar('Scan failed. Please check credentials.', { variant: 'error' });
        } finally {
            setIsScanning(false);
        }
    };

    const handleCancel = () => { cancelRef.current = true; };

    const credentialFields: Record<string, Array<{ key: string; label: string; type?: string }>> = {
        aws: [
            { key: 'accessKeyId', label: 'Access Key ID' },
            { key: 'secretAccessKey', label: 'Secret Access Key', type: 'password' },
            { key: 'sessionToken', label: 'Session Token (optional)' },
        ],
        gcp: [
            { key: 'projectId', label: 'Project ID' },
            { key: 'serviceAccountKey', label: 'Service Account JSON Key', type: 'password' },
        ],
        azure: [
            { key: 'subscriptionId', label: 'Subscription ID' },
            { key: 'tenantId', label: 'Tenant ID' },
            { key: 'clientId', label: 'Client ID' },
            { key: 'clientSecret', label: 'Client Secret', type: 'password' },
        ],
    };

    return (
        <PageShell>
            <Breadcrumbs separator={<NavigateNext fontSize="small" sx={{ color: '#9CA3AF' }} />} sx={{ mb: 1 }}>
                <Typography component="a" href="/" sx={{ fontSize: '0.8125rem', color: 'text.secondary', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>Dashboard</Typography>
                <Typography sx={{ fontSize: '0.8125rem', color: 'text.primary', fontWeight: 500 }}>Scan</Typography>
            </Breadcrumbs>

            <Box sx={{ mb: 4 }}>
                <Typography variant="h1" sx={{ fontSize: { xs: '1.375rem', md: '1.75rem' }, fontWeight: 600, mb: 0.5 }}>Cloud Environment Scan</Typography>
                <Typography variant="body2" color="text.secondary">Connect to your cloud provider and run a live environment readiness scan against AI Assist prerequisites.</Typography>
            </Box>

            <Grid container spacing={3}>
                {/* Credential Form */}
                <Grid size={{ xs: 12, lg: 5 }}>
                    <Card>
                        <CardContent sx={{ p: 3.5 }}>
                            <Typography variant="h5" gutterBottom>Scan Configuration</Typography>
                            <Divider sx={{ mb: 3 }} />
                            <Alert severity="info" sx={{ mb: 3, fontSize: '0.8125rem', borderRadius: 1.5 }}>
                                Only <strong>read-only</strong> credentials are required. No write or modify permissions needed.
                            </Alert>

                            <FormControl fullWidth sx={{ mb: 2.5 }}>
                                <InputLabel>Cloud Provider</InputLabel>
                                <Select value={provider} label="Cloud Provider" onChange={(e) => { setProvider(e.target.value); setCredentials({}); }}>
                                    {CLOUD_PROVIDERS.map((p) => (
                                        <MenuItem key={p.id} value={p.id}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: p.color }} />{p.label}
                                            </Box>
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>

                            <FormControl fullWidth sx={{ mb: 2.5 }}>
                                <InputLabel>Environment</InputLabel>
                                <Select value={environment} label="Environment" onChange={(e) => setEnvironment(e.target.value)}>
                                    {['production', 'staging', 'development', 'testing'].map((e) => (
                                        <MenuItem key={e} value={e} sx={{ textTransform: 'capitalize' }}>{e}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>

                            {(credentialFields[provider] ?? []).map((field) => (
                                <TextField key={field.key} fullWidth label={field.label} type={field.type ?? 'text'}
                                    placeholder={field.type === 'password' ? '••••••••••••' : ''}
                                    value={credentials[field.key] ?? ''}
                                    onChange={(e) => setCredentials((prev) => ({ ...prev, [field.key]: e.target.value }))}
                                    sx={{ mb: 2 }} />
                            ))}

                            {/* Advanced scope options */}
                            <Box sx={{ mb: 2 }}>
                                <Button size="small" onClick={() => setShowAdvanced(!showAdvanced)}
                                    endIcon={showAdvanced ? <ExpandLess sx={{ fontSize: 14 }} /> : <ExpandMore sx={{ fontSize: 14 }} />}
                                    sx={{ color: 'text.secondary', fontSize: '0.8125rem', pl: 0 }}>
                                    Advanced Scope Options
                                </Button>
                                <Collapse in={showAdvanced}>
                                    <Box sx={{ pt: 1.5, pb: 0.5 }}>
                                        <TextField fullWidth size="small" label={provider === 'aws' ? 'Resources Region (e.g. us-east-1)' : provider === 'azure' ? 'Resource Group (optional)' : 'Region / Zone (optional)'}
                                            value={scope} onChange={(e) => setScope(e.target.value)} sx={{ mb: 2 }}
                                            helperText="Leave blank to scan the full subscription/account" />
                                    </Box>
                                </Collapse>
                            </Box>

                            <Button variant="contained" size="large" fullWidth onClick={handleStartScan} disabled={isScanning} startIcon={<PlayArrow />} sx={{ mt: 1 }}>
                                {isScanning ? 'Scanning…' : 'Start Scan'}
                            </Button>
                        </CardContent>
                    </Card>
                </Grid>

                {/* Progress + history */}
                <Grid size={{ xs: 12, lg: 7 }}>
                    {isScanning && (
                        <Card sx={{ mb: 3 }}>
                            <CardContent sx={{ p: 3.5 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                                    <Typography variant="h5">Scan Progress</Typography>
                                    <Tooltip title="Cancel scan">
                                        <Button size="small" variant="outlined" color="error" startIcon={<Cancel sx={{ fontSize: 14 }} />} onClick={handleCancel} sx={{ fontSize: '0.8125rem' }}>
                                            Cancel
                                        </Button>
                                    </Tooltip>
                                </Box>

                                <Box sx={{ mb: 3 }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: DOMAIN_COLORS[SCAN_STEPS[activeStep]?.domain ?? 'general'], animation: 'pulseRing 1.5s infinite' }} />
                                            <Typography variant="body2" color="text.secondary">{currentStep}</Typography>
                                        </Box>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                            {eta !== null && eta > 0 && (
                                                <Typography variant="caption" color="text.secondary">~{eta}s remaining</Typography>
                                            )}
                                            <Typography variant="body2" color="primary.main" fontWeight={700}>{scanProgress}%</Typography>
                                        </Box>
                                    </Box>
                                    <LinearProgress variant="determinate" value={scanProgress} sx={{ height: 8, borderRadius: 99, '& .MuiLinearProgress-bar': { borderRadius: 99, bgcolor: DOMAIN_COLORS[SCAN_STEPS[activeStep]?.domain ?? 'general'] } }} />
                                </Box>

                                {/* Partial results warning */}
                                {partialSections.length > 0 && (
                                    <Alert severity="warning" icon={<Warning sx={{ fontSize: 16 }} />} sx={{ mb: 2, fontSize: '0.8125rem', py: 0.5 }}>
                                        Partial results: <strong>{partialSections.join(', ')}</strong> section{partialSections.length > 1 ? 's' : ''} may have incomplete data due to API restrictions.
                                    </Alert>
                                )}

                                <Stepper alternativeLabel activeStep={activeStep} sx={{ mt: 1 }}>
                                    {SCAN_STEPS.map((step, i) => (
                                        <Step key={step.label} completed={i < activeStep}>
                                            <StepLabel
                                                sx={{
                                                    '& .MuiStepIcon-root.Mui-active': { color: DOMAIN_COLORS[step.domain] },
                                                    '& .MuiStepLabel-label': { fontSize: '0.625rem' },
                                                }}
                                            >
                                                {step.label}
                                            </StepLabel>
                                        </Step>
                                    ))}
                                </Stepper>
                            </CardContent>
                        </Card>
                    )}

                    <Card>
                        <CardContent sx={{ p: 0 }}>
                            <Box sx={{ px: 3, py: 2.5, borderBottom: '1px solid #F3F4F6' }}>
                                <Typography variant="h5">Scan History</Typography>
                            </Box>
                            <TableContainer>
                                <Table>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Provider</TableCell>
                                            <TableCell>Environment</TableCell>
                                            <TableCell>Scope</TableCell>
                                            <TableCell>Status</TableCell>
                                            <TableCell>Resources</TableCell>
                                            <TableCell>Issues</TableCell>
                                            <TableCell>Date</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {scans.map((scan) => (
                                            <TableRow key={scan.id} hover>
                                                <TableCell>
                                                    <Chip label={scan.provider.toUpperCase()} size="small"
                                                        sx={{ color: CLOUD_PROVIDERS.find(p => p.id === scan.provider)?.color ?? '#666', fontWeight: 700, fontSize: '0.6875rem', borderRadius: 1 }}
                                                        variant="outlined" />
                                                </TableCell>
                                                <TableCell><Typography variant="body2" sx={{ textTransform: 'capitalize' }}>{scan.environment}</Typography></TableCell>
                                                <TableCell><Typography variant="caption" color="text.secondary">{(scan as any).scope ?? '—'}</Typography></TableCell>
                                                <TableCell>
                                                    <Chip icon={scan.status === 'completed' ? <CheckCircle sx={{ fontSize: '14px !important' }} /> : <ErrorOutline sx={{ fontSize: '14px !important' }} />}
                                                        label={scan.status} size="small"
                                                        color={scan.status === 'completed' ? 'success' : 'error'}
                                                        variant="outlined" sx={{ borderRadius: 99, fontSize: '0.75rem', textTransform: 'capitalize' }} />
                                                </TableCell>
                                                <TableCell><Typography variant="body2">{scan.resourceCount}</Typography></TableCell>
                                                <TableCell><Typography variant="body2" color={scan.issueCount > 0 ? 'error.main' : 'success.main'} fontWeight={600}>{scan.issueCount}</Typography></TableCell>
                                                <TableCell><Typography variant="caption" color="text.secondary">{formatDateTime(scan.startedAt)}</Typography></TableCell>
                                            </TableRow>
                                        ))}
                                        {scans.length === 0 && (
                                            <TableRow><TableCell colSpan={7} align="center" sx={{ py: 5, color: '#9CA3AF' }}>No scans yet.</TableCell></TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>
        </PageShell>
    );
};

export default Scan;
