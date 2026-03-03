import React, { useEffect, useRef, useState } from 'react';
import {
    Box, Card, CardContent, Typography, Button, TextField,
    FormControl, InputLabel, Select, MenuItem, LinearProgress,
    Stepper, Step, StepLabel, Chip, Alert, Breadcrumbs, Divider,
    Collapse, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
} from '@mui/material';
import { Grid } from '@mui/material';
import {
    NavigateNext, PlayArrow, CheckCircle, ErrorOutline, Cancel,
    ExpandMore, ExpandLess, AssessmentOutlined,
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { useLocation, useNavigate } from 'react-router-dom';
import PageShell from '../components/layout/PageShell';
import { startScan, getReport } from '../api/scan';
import { pollJobUntilDone } from '../api/jobs';
import { useScanStore } from '../store/scanStore';
import { useExtractionStore } from '../store/extractionStore';
import type { Finding } from '../api/types';

const SEVERITY_COLOR: Record<string, string> = {
    critical: '#EF4444', high: '#F59E0B', medium: '#2563EB', low: '#10B981',
};

const STATUS_CONFIG = {
    pass: { color: '#10B981', bg: '#ECFDF5', label: 'PASS' },
    fail: { color: '#EF4444', bg: '#FEF2F2', label: 'FAIL' },
    error: { color: '#F59E0B', bg: '#FFFBEB', label: 'ERROR' },
    skipped: { color: '#6B7280', bg: '#F3F4F6', label: 'SKIP' },
};

const SCAN_STEPS = [
    'Loading prerequisites',
    'Scanning compute resources',
    'Scanning networking',
    'Scanning databases',
    'Scanning security',
    'Running validation',
    'Building report',
];

const Scan: React.FC = () => {
    const {
        setScanJobId, documentId: storedDocId, setDocumentId,
        isScanning, setIsScanning, scanProgress, setScanProgress,
        currentStep, report, setReport, setReportId, setError, error, reset,
    } = useScanStore();
    const { documentId: extractionDocId } = useExtractionStore();
    const { enqueueSnackbar } = useSnackbar();
    const navigate = useNavigate();
    const location = useLocation();

    const [activeStep, setActiveStep] = useState(0);
    const [resourceGroup, setResourceGroup] = useState('');
    const [region, setRegion] = useState('eastus');
    const [showAdvanced, setShowAdvanced] = useState(false);
    const cancelRef = useRef(false);

    // Allow document_id to come from nav state (from Extraction page) or extraction store
    const documentId = (location.state as any)?.documentId ?? extractionDocId ?? storedDocId ?? '';

    useEffect(() => {
        if (documentId) setDocumentId(documentId);
    }, [documentId]);

    const handleStartScan = async () => {
        if (!documentId) {
            enqueueSnackbar('Please upload and extract a document first.', { variant: 'warning' });
            return;
        }
        cancelRef.current = false;
        setIsScanning(true);
        setScanProgress(0, 'Starting scan…');
        setActiveStep(0);
        setError(null);
        setReport(null);

        try {
            const res = await startScan({
                document_id: documentId,
                resource_group: resourceGroup || null,
                region,
            });

            setScanJobId(res.job_id);

            const finalJob = await pollJobUntilDone(
                res.job_id,
                (job) => {
                    setScanProgress(job.progress_pct, job.current_step);
                    // Map progress % to stepper step
                    const step = Math.min(
                        Math.floor((job.progress_pct / 100) * SCAN_STEPS.length),
                        SCAN_STEPS.length - 1
                    );
                    setActiveStep(step);
                },
                3000
            );

            if (finalJob.result_id) {
                const reportData = await getReport(finalJob.result_id);
                setReport(reportData);
                setReportId(finalJob.result_id);
                enqueueSnackbar(
                    reportData.summary.deployment_ready
                        ? '✅ Scan complete — environment is deployment ready!'
                        : `⚠ Scan complete — ${reportData.summary.failed} issues found.`,
                    { variant: reportData.summary.deployment_ready ? 'success' : 'warning', autoHideDuration: 6000 }
                );
            } else {
                enqueueSnackbar('Scan completed but no report was generated.', { variant: 'warning' });
            }
        } catch (err: any) {
            if (!cancelRef.current) {
                setError(err.message ?? 'Scan failed');
                enqueueSnackbar(err.message ?? 'Scan failed', { variant: 'error' });
            }
        } finally {
            setIsScanning(false);
        }
    };

    const handleCancel = () => { cancelRef.current = true; setIsScanning(false); };

    const REGIONS = ['eastus', 'eastus2', 'westus', 'westus2', 'westeurope', 'northeurope', 'southeastasia', 'australiaeast', 'japaneast', 'centralus'];

    return (
        <PageShell>
            <Breadcrumbs separator={<NavigateNext fontSize="small" sx={{ color: '#9CA3AF' }} />} sx={{ mb: 1 }}>
                <Typography component="a" href="/" sx={{ fontSize: '0.8125rem', color: 'text.secondary', textDecoration: 'none' }}>Dashboard</Typography>
                <Typography sx={{ fontSize: '0.8125rem', color: 'text.primary', fontWeight: 500 }}>Scan</Typography>
            </Breadcrumbs>

            <Box sx={{ mb: 4 }}>
                <Typography variant="h1" sx={{ fontSize: { xs: '1.375rem', md: '1.75rem' }, fontWeight: 600, mb: 0.5 }}>
                    Azure Environment Scan
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    Scan your Azure subscription to validate all extracted prerequisites against live resources.
                </Typography>
            </Box>

            <Grid container spacing={3}>
                {/* Configuration */}
                <Grid size={{ xs: 12, lg: 5 }}>
                    <Card>
                        <CardContent sx={{ p: 3.5 }}>
                            <Typography variant="h5" gutterBottom>Scan Configuration</Typography>
                            <Divider sx={{ mb: 3 }} />

                            <Alert severity="info" sx={{ mb: 3, fontSize: '0.8125rem', borderRadius: 1.5 }}>
                                Azure credentials are read from the <strong>.env</strong> file on the backend server.
                                Only <strong>read-only</strong> permissions are required.
                            </Alert>

                            {documentId ? (
                                <Alert severity="success" sx={{ mb: 2, fontSize: '0.8125rem' }}>
                                    Document ID: <strong>{documentId.slice(0, 8)}…</strong> — prerequisites loaded.
                                </Alert>
                            ) : (
                                <Alert severity="warning" sx={{ mb: 2, fontSize: '0.8125rem' }}>
                                    No document selected.{' '}
                                    <Typography
                                        component="span"
                                        sx={{ cursor: 'pointer', textDecoration: 'underline', fontSize: '0.8125rem', color: 'warning.dark' }}
                                        onClick={() => navigate('/extract')}
                                    >
                                        Upload a document first →
                                    </Typography>
                                </Alert>
                            )}

                            {/* Advanced scope */}
                            <Box sx={{ mb: 2 }}>
                                <Button
                                    size="small"
                                    onClick={() => setShowAdvanced(!showAdvanced)}
                                    endIcon={showAdvanced ? <ExpandLess sx={{ fontSize: 14 }} /> : <ExpandMore sx={{ fontSize: 14 }} />}
                                    sx={{ color: 'text.secondary', fontSize: '0.8125rem', pl: 0 }}
                                >
                                    Advanced Scope Options
                                </Button>
                                <Collapse in={showAdvanced}>
                                    <Box sx={{ pt: 1.5 }}>
                                        <TextField
                                            fullWidth size="small" label="Resource Group (optional)"
                                            value={resourceGroup} onChange={(e) => setResourceGroup(e.target.value)}
                                            sx={{ mb: 2 }}
                                            helperText="Leave blank to scan entire subscription"
                                        />
                                        <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                                            <InputLabel>Azure Region</InputLabel>
                                            <Select value={region} label="Azure Region" onChange={(e) => setRegion(e.target.value)}>
                                                {REGIONS.map((r) => (
                                                    <MenuItem key={r} value={r}>{r}</MenuItem>
                                                ))}
                                            </Select>
                                        </FormControl>
                                    </Box>
                                </Collapse>
                            </Box>

                            <Box sx={{ display: 'flex', gap: 1 }}>
                                <Button
                                    variant="contained"
                                    size="large"
                                    fullWidth
                                    onClick={handleStartScan}
                                    disabled={isScanning || !documentId}
                                    startIcon={<PlayArrow />}
                                >
                                    {isScanning ? 'Scanning…' : 'Start Scan'}
                                </Button>
                                {isScanning && (
                                    <Button variant="outlined" color="error" size="large" onClick={handleCancel} startIcon={<Cancel />}>
                                        Cancel
                                    </Button>
                                )}
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>

                {/* Progress & Results */}
                <Grid size={{ xs: 12, lg: 7 }}>
                    {isScanning && (
                        <Card sx={{ mb: 3 }}>
                            <CardContent sx={{ p: 3.5 }}>
                                <Typography variant="h5" gutterBottom>Scan Progress</Typography>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
                                    <Typography variant="body2" color="text.secondary">{currentStep || 'Starting…'}</Typography>
                                    <Typography variant="body2" fontWeight={700} color="primary.main">{scanProgress}%</Typography>
                                </Box>
                                <LinearProgress variant="determinate" value={scanProgress} sx={{ height: 8, borderRadius: 99, mb: 3, '& .MuiLinearProgress-bar': { borderRadius: 99 } }} />
                                <Stepper alternativeLabel activeStep={activeStep}>
                                    {SCAN_STEPS.map((step, i) => (
                                        <Step key={step} completed={i < activeStep}>
                                            <StepLabel sx={{ '& .MuiStepLabel-label': { fontSize: '0.625rem' } }}>{step}</StepLabel>
                                        </Step>
                                    ))}
                                </Stepper>
                            </CardContent>
                        </Card>
                    )}

                    {error && !isScanning && (
                        <Alert severity="error" sx={{ mb: 2 }}>
                            <strong>Scan failed:</strong> {error}
                        </Alert>
                    )}

                    {report && !isScanning && (
                        <Card>
                            <CardContent sx={{ p: 3.5 }}>
                                {/* Deployment readiness banner */}
                                <Alert
                                    severity={report.summary.deployment_ready ? 'success' : 'error'}
                                    icon={report.summary.deployment_ready ? <CheckCircle /> : <ErrorOutline />}
                                    sx={{ mb: 3, fontWeight: 500, borderLeft: `4px solid ${report.summary.deployment_ready ? '#10B981' : '#EF4444'}` }}
                                >
                                    {report.summary.deployment_ready
                                        ? 'Deployment Ready — All critical prerequisites satisfied.'
                                        : `Not Ready — ${report.summary.critical_failures} critical and ${report.summary.high_failures} high failures.`}
                                </Alert>

                                {/* KPI row */}
                                <Grid container spacing={2} sx={{ mb: 3 }}>
                                    {[
                                        { label: 'Passed', value: report.summary.passed, color: '#10B981', bg: '#ECFDF5' },
                                        { label: 'Failed', value: report.summary.failed, color: '#EF4444', bg: '#FEF2F2' },
                                        { label: 'Errors', value: report.summary.errors, color: '#F59E0B', bg: '#FFFBEB' },
                                        { label: 'Skipped', value: report.summary.skipped, color: '#6B7280', bg: '#F3F4F6' },
                                    ].map((item) => (
                                        <Grid key={item.label} size={{ xs: 6, sm: 3 }}>
                                            <Box sx={{ p: 2, bgcolor: item.bg, borderRadius: 2, textAlign: 'center' }}>
                                                <Typography variant="h4" sx={{ fontSize: '1.75rem', fontWeight: 700, color: item.color }}>{item.value}</Typography>
                                                <Typography variant="caption" fontWeight={600} color="text.secondary">{item.label}</Typography>
                                            </Box>
                                        </Grid>
                                    ))}
                                </Grid>

                                {/* Findings table — first 20 failures */}
                                <Typography variant="h6" gutterBottom>Failures</Typography>
                                <TableContainer>
                                    <Table size="small">
                                        <TableHead>
                                            <TableRow>
                                                <TableCell>Status</TableCell>
                                                <TableCell>Severity</TableCell>
                                                <TableCell>Attribute</TableCell>
                                                <TableCell>Resource</TableCell>
                                                <TableCell>Reason</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {(report.findings_by_status.fail ?? []).slice(0, 20).map((f: Finding) => {
                                                const sc = STATUS_CONFIG[f.status] ?? STATUS_CONFIG.fail;
                                                const svColor = SEVERITY_COLOR[f.severity] ?? '#6B7280';
                                                return (
                                                    <TableRow key={f.id} hover>
                                                        <TableCell>
                                                            <Chip label={sc.label} size="small" sx={{ bgcolor: sc.bg, color: sc.color, fontWeight: 700, fontSize: '0.6875rem', borderRadius: 1 }} />
                                                        </TableCell>
                                                        <TableCell>
                                                            <Chip label={f.severity} size="small" sx={{ bgcolor: SEVERITY_COLOR[f.severity] + '20', color: svColor, fontWeight: 600, fontSize: '0.6875rem', borderRadius: 1 }} />
                                                        </TableCell>
                                                        <TableCell>
                                                            <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>{f.condition.attribute}</Typography>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Typography variant="caption" color="text.secondary">{f.resource_name ?? '—'}</Typography>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Typography variant="caption" color="text.secondary">{f.reason}</Typography>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                            {(report.findings_by_status.fail ?? []).length === 0 && (
                                                <TableRow>
                                                    <TableCell colSpan={5} align="center" sx={{ py: 3, color: '#10B981' }}>
                                                        <CheckCircle sx={{ mr: 1, verticalAlign: 'middle' }} /> No failures!
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </TableContainer>

                                <Box sx={{ mt: 3, display: 'flex', gap: 1 }}>
                                    <Button
                                        variant="contained"
                                        startIcon={<AssessmentOutlined />}
                                        onClick={() => navigate('/reports', { state: { reportId: report.report_id } })}
                                    >
                                        View Full Report
                                    </Button>
                                    <Button variant="outlined" onClick={reset} sx={{ borderColor: '#D1D5DB', color: 'text.secondary' }}>
                                        New Scan
                                    </Button>
                                </Box>
                            </CardContent>
                        </Card>
                    )}

                    {!isScanning && !report && !error && (
                        <Card>
                            <CardContent sx={{ py: 8, textAlign: 'center', color: '#9CA3AF' }}>
                                <AssessmentOutlined sx={{ fontSize: 48, mb: 2 }} />
                                <Typography variant="h6" color="text.secondary">Configure scan options and click <strong>Start Scan</strong></Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                    Azure credentials are loaded from the server's .env file.
                                </Typography>
                            </CardContent>
                        </Card>
                    )}
                </Grid>
            </Grid>
        </PageShell>
    );
};

export default Scan;
