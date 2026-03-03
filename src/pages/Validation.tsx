import React, { useEffect, useState } from 'react';
import {
    Box, Card, CardContent, Typography, Chip, Divider,
    Accordion, AccordionSummary, AccordionDetails, Breadcrumbs,
    Alert, LinearProgress, Tab, Tabs, Button, Tooltip, IconButton,
    Collapse, Table, TableBody, TableCell, TableRow,
} from '@mui/material';
import { Grid } from '@mui/material';
import {
    NavigateNext, ExpandMore, CheckCircle, WarningAmber,
    ErrorOutline, InfoOutlined, Shield, ArrowBack, Refresh,
    DeleteOutline, RestoreFromTrash,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSnackbar } from 'notistack';
import PageShell from '../components/layout/PageShell';
import { getReport } from '../api/scan';
import { useScanStore } from '../store/scanStore';
import type { FindingStatus, Severity, ValidationReport } from '../api/types';

const SEVERITY_CONFIG: Record<Severity, { color: string; bg: string; icon: React.ReactNode; label: string }> = {
    critical: { color: '#EF4444', bg: '#FEF2F2', icon: <ErrorOutline sx={{ fontSize: 16 }} />, label: 'Critical' },
    high: { color: '#F59E0B', bg: '#FFFBEB', icon: <WarningAmber sx={{ fontSize: 16 }} />, label: 'High' },
    medium: { color: '#2563EB', bg: '#EFF6FF', icon: <InfoOutlined sx={{ fontSize: 16 }} />, label: 'Medium' },
    low: { color: '#10B981', bg: '#ECFDF5', icon: <CheckCircle sx={{ fontSize: 16 }} />, label: 'Low' },
};

const STATUS_CONFIG: Record<FindingStatus, { color: string; bg: string; label: string }> = {
    pass: { color: '#10B981', bg: '#ECFDF5', label: 'PASS' },
    fail: { color: '#EF4444', bg: '#FEF2F2', label: 'FAIL' },
    error: { color: '#F59E0B', bg: '#FFFBEB', label: 'ERROR' },
    skipped: { color: '#6B7280', bg: '#F3F4F6', label: 'SKIP' },
};

const Validation: React.FC = () => {
    const { report: storeReport, reportId, setReport } = useScanStore();
    const { enqueueSnackbar } = useSnackbar();
    const navigate = useNavigate();
    const location = useLocation();

    const resolvedReportId = (location.state as any)?.reportId ?? reportId;

    const [report, setLocalReport] = useState<ValidationReport | null>(storeReport);
    const [loading, setLoading] = useState(false);
    const [statusTab, setStatusTab] = useState<FindingStatus | 'all'>('all');
    const [severityFilter, setSeverityFilter] = useState<Severity | 'all'>('all');
    const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
    const [showDismissed, setShowDismissed] = useState(false);

    const loadReport = async (id: string) => {
        setLoading(true);
        try {
            const r = await getReport(id);
            setLocalReport(r);
            setReport(r);
        } catch (err: any) {
            enqueueSnackbar(err.message ?? 'Failed to load report', { variant: 'error' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (resolvedReportId && !report) {
            loadReport(resolvedReportId);
        }
    }, [resolvedReportId]);

    if (!resolvedReportId && !report) {
        return (
            <PageShell>
                <Breadcrumbs separator={<NavigateNext fontSize="small" sx={{ color: '#9CA3AF' }} />} sx={{ mb: 1 }}>
                    <Typography component="a" href="/" sx={{ fontSize: '0.8125rem', color: 'text.secondary', textDecoration: 'none' }}>Dashboard</Typography>
                    <Typography sx={{ fontSize: '0.8125rem', color: 'text.primary', fontWeight: 500 }}>Validation</Typography>
                </Breadcrumbs>
                <Alert severity="info" sx={{ mt: 4 }}>
                    No validation report found. Please{' '}
                    <Typography component="span" sx={{ textDecoration: 'underline', cursor: 'pointer' }} onClick={() => navigate('/scan')}>
                        run a scan first
                    </Typography>
                    .
                </Alert>
            </PageShell>
        );
    }

    const allFindings = report?.findings ?? [];
    const activeFindings = allFindings.filter((f) => !dismissedIds.has(f.id));
    const dismissedFindings = allFindings.filter((f) => dismissedIds.has(f.id));

    // Apply filters
    const filtered = activeFindings
        .filter((f) => statusTab === 'all' || f.status === statusTab)
        .filter((f) => severityFilter === 'all' || f.severity === severityFilter);

    const counts = {
        all: activeFindings.length,
        pass: activeFindings.filter((f) => f.status === 'pass').length,
        fail: activeFindings.filter((f) => f.status === 'fail').length,
        error: activeFindings.filter((f) => f.status === 'error').length,
        skipped: activeFindings.filter((f) => f.status === 'skipped').length,
    };

    const handleDismiss = (id: string) => {
        setDismissedIds((prev) => new Set([...prev, id]));
        enqueueSnackbar('Finding dismissed.', { variant: 'info', autoHideDuration: 2000 });
    };
    const handleDismissAll = () => {
        const ids = filtered.map((f) => f.id);
        setDismissedIds((prev) => new Set([...prev, ...ids]));
        enqueueSnackbar(`${ids.length} findings dismissed.`, { variant: 'success' });
    };
    const handleRestore = (id: string) => {
        setDismissedIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
        enqueueSnackbar('Finding restored.', { variant: 'info', autoHideDuration: 2000 });
    };
    const handleRestoreAll = () => {
        setDismissedIds(new Set());
        enqueueSnackbar('All dismissed findings restored.', { variant: 'success' });
    };

    const isDeploymentReady = report?.summary.deployment_ready ?? false;

    return (
        <PageShell>
            <Breadcrumbs separator={<NavigateNext fontSize="small" sx={{ color: '#9CA3AF' }} />} sx={{ mb: 1 }}>
                <Typography component="a" href="/" sx={{ fontSize: '0.8125rem', color: 'text.secondary', textDecoration: 'none' }}>Dashboard</Typography>
                <Typography component="a" onClick={() => navigate('/scan')} sx={{ fontSize: '0.8125rem', color: 'text.secondary', textDecoration: 'none', cursor: 'pointer' }}>Scan</Typography>
                <Typography sx={{ fontSize: '0.8125rem', color: 'text.primary', fontWeight: 500 }}>Validation Report</Typography>
            </Breadcrumbs>

            <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 4, flexWrap: 'wrap', gap: 2 }}>
                <Box>
                    <Typography variant="h1" sx={{ fontSize: { xs: '1.375rem', md: '1.75rem' }, fontWeight: 600, mb: 0.5 }}>
                        Validation Report
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        Azure scan results — prerequisites vs live environment.
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Button startIcon={<ArrowBack sx={{ fontSize: 14 }} />} onClick={() => navigate('/scan')} size="small" variant="outlined" sx={{ borderColor: '#E4E7EC', color: 'text.secondary' }}>Back to Scan</Button>
                    <Button startIcon={<Refresh sx={{ fontSize: 14 }} />} onClick={() => resolvedReportId && loadReport(resolvedReportId)} disabled={loading} size="small" variant="outlined" sx={{ borderColor: '#E4E7EC', color: 'text.secondary' }}>Refresh</Button>
                </Box>
            </Box>

            {loading && <Card sx={{ mb: 3 }}><CardContent sx={{ p: 3 }}><Typography variant="body2" gutterBottom>Loading validation report…</Typography><LinearProgress /></CardContent></Card>}

            {!loading && report && (
                <>
                    {/* Readiness banner */}
                    <Alert
                        severity={isDeploymentReady ? 'success' : 'error'}
                        icon={isDeploymentReady ? <CheckCircle /> : <ErrorOutline />}
                        sx={{ mb: 3, borderRadius: 2, fontWeight: 500, borderLeft: `4px solid ${isDeploymentReady ? '#10B981' : '#EF4444'}` }}
                    >
                        {isDeploymentReady
                            ? 'Deployment Ready — No critical or high failures found.'
                            : `Not Ready — ${report.summary.critical_failures} critical, ${report.summary.high_failures} high failures must be resolved.`}
                    </Alert>

                    {/* KPI cards */}
                    <Grid container spacing={2} sx={{ mb: 3 }}>
                        {(['pass', 'fail', 'error', 'skipped'] as FindingStatus[]).map((s) => {
                            const sc = STATUS_CONFIG[s];
                            return (
                                <Grid key={s} size={{ xs: 6, sm: 3 }}>
                                    <Card
                                        sx={{ cursor: 'pointer', border: `1px solid ${statusTab === s ? sc.color : 'transparent'}` }}
                                        onClick={() => setStatusTab((prev) => prev === s ? 'all' : s)}
                                    >
                                        <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2.5 }}>
                                            <Box sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: sc.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: sc.color }}>
                                                <Typography fontWeight={800} fontSize="0.75rem">{sc.label}</Typography>
                                            </Box>
                                            <Box>
                                                <Typography variant="h4" sx={{ fontSize: '1.5rem', fontWeight: 700, color: sc.color }}>{counts[s]}</Typography>
                                                <Typography variant="body2" fontWeight={500} sx={{ textTransform: 'capitalize' }}>{s}</Typography>
                                            </Box>
                                        </CardContent>
                                    </Card>
                                </Grid>
                            );
                        })}
                    </Grid>

                    {/* Severity filter chips */}
                    <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                        {(['all', 'critical', 'high', 'medium', 'low'] as const).map((sev) => (
                            <Chip
                                key={sev}
                                label={sev === 'all' ? 'All Severities' : SEVERITY_CONFIG[sev]?.label ?? sev}
                                onClick={() => setSeverityFilter(sev)}
                                size="small"
                                sx={{
                                    cursor: 'pointer',
                                    bgcolor: severityFilter === sev ? (sev === 'all' ? '#374151' : SEVERITY_CONFIG[sev]?.color) : '#F3F4F6',
                                    color: severityFilter === sev ? '#fff' : '#6B7280',
                                    fontWeight: severityFilter === sev ? 700 : 400,
                                    '&:hover': { opacity: 0.85 },
                                    transition: 'all 120ms',
                                }}
                            />
                        ))}
                    </Box>

                    {/* Findings panel */}
                    <Card>
                        <CardContent sx={{ p: 0 }}>
                            <Box sx={{ px: 3, pt: 2.5, pb: 1, borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
                                <Typography variant="h5">Findings</Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Typography variant="caption" color="text.secondary">{filtered.length} of {activeFindings.length} shown</Typography>
                                    {filtered.length > 0 && (
                                        <Tooltip title={`Dismiss all ${filtered.length} visible`}>
                                            <Button size="small" variant="outlined" startIcon={<DeleteOutline sx={{ fontSize: 14 }} />} onClick={handleDismissAll}
                                                sx={{ borderColor: '#FECACA', color: '#EF4444', fontSize: '0.75rem', height: 28, '&:hover': { bgcolor: '#FEF2F2', borderColor: '#EF4444' } }}>
                                                Dismiss all ({filtered.length})
                                            </Button>
                                        </Tooltip>
                                    )}
                                </Box>
                            </Box>

                            <Tabs value={['all', 'pass', 'fail', 'error', 'skipped'].indexOf(statusTab)} onChange={(_, v) => setStatusTab(['all', 'pass', 'fail', 'error', 'skipped'][v] as any)} sx={{ px: 2, minHeight: 36, borderBottom: '1px solid #F3F4F6' }}>
                                {['All', 'Pass', 'Fail', 'Error', 'Skip'].map((label, i) => (
                                    <Tab key={label} label={`${label} (${counts[['all', 'pass', 'fail', 'error', 'skipped'][i] as keyof typeof counts]})`} sx={{ fontSize: '0.8125rem', minHeight: 36, textTransform: 'none' }} />
                                ))}
                            </Tabs>

                            <Box sx={{ p: 2 }}>
                                {filtered.length === 0 ? (
                                    <Box sx={{ py: 5, textAlign: 'center', color: '#9CA3AF' }}>
                                        <CheckCircle sx={{ fontSize: 40, color: '#10B981', mb: 1 }} />
                                        <Typography>No findings in this category.</Typography>
                                    </Box>
                                ) : filtered.map((finding) => {
                                    const sev = SEVERITY_CONFIG[finding.severity] ?? SEVERITY_CONFIG.medium;
                                    const st = STATUS_CONFIG[finding.status] ?? STATUS_CONFIG.error;
                                    return (
                                        <Accordion key={finding.id} elevation={0} sx={{ border: '1px solid #F3F4F6', borderRadius: '8px !important', mb: 1, '&:before': { display: 'none' } }}>
                                            <AccordionSummary expandIcon={<ExpandMore />} sx={{ px: 2.5 }}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1, flexWrap: 'wrap', pr: 1 }}>
                                                    <Chip label={st.label} size="small" sx={{ bgcolor: st.bg, color: st.color, fontWeight: 700, borderRadius: 1, fontSize: '0.6875rem', minWidth: 48 }} />
                                                    <Chip icon={sev.icon as any} label={sev.label} size="small" sx={{ bgcolor: sev.bg, color: sev.color, fontWeight: 600, borderRadius: 1, border: 'none', minWidth: 80 }} />
                                                    <Typography variant="body2" fontWeight={600} sx={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>
                                                        {finding.condition.attribute}
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' }, flex: 1 }}>
                                                        {finding.condition.operator} {finding.condition.expected_value !== null ? String(finding.condition.expected_value) : '(exists)'}
                                                    </Typography>
                                                    <Tooltip title="Dismiss finding">
                                                        <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleDismiss(finding.id); }} sx={{ color: '#9CA3AF', '&:hover': { color: '#EF4444', bgcolor: '#FEF2F2' } }}>
                                                            <DeleteOutline sx={{ fontSize: 17 }} />
                                                        </IconButton>
                                                    </Tooltip>
                                                </Box>
                                            </AccordionSummary>
                                            <AccordionDetails sx={{ px: 2.5, pt: 0 }}>
                                                <Divider sx={{ mb: 2 }} />
                                                <Table size="small" sx={{ mb: 2 }}>
                                                    <TableBody>
                                                        <TableRow>
                                                            <TableCell sx={{ fontWeight: 600, width: 140, fontSize: '0.75rem' }}>Attribute</TableCell>
                                                            <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>{finding.condition.attribute}</TableCell>
                                                        </TableRow>
                                                        <TableRow>
                                                            <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Expected</TableCell>
                                                            <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>
                                                                {finding.condition.operator} {finding.expected_value !== null && finding.expected_value !== undefined ? String(finding.expected_value) : '(any value)'}
                                                            </TableCell>
                                                        </TableRow>
                                                        <TableRow>
                                                            <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Actual</TableCell>
                                                            <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8125rem', color: finding.status === 'fail' ? '#EF4444' : 'inherit' }}>
                                                                {finding.actual_value !== null && finding.actual_value !== undefined ? String(finding.actual_value) : <em style={{ color: '#9CA3AF' }}>not found</em>}
                                                            </TableCell>
                                                        </TableRow>
                                                        {finding.resource_name && (
                                                            <TableRow>
                                                                <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Resource</TableCell>
                                                                <TableCell sx={{ fontSize: '0.8125rem' }}>{finding.resource_name}</TableCell>
                                                            </TableRow>
                                                        )}
                                                    </TableBody>
                                                </Table>
                                                <Box sx={{ p: 2, bgcolor: '#F9FAFB', borderRadius: 1, border: '1px solid #E5E7EB' }}>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                                        <Shield sx={{ fontSize: 14, color: '#6B7280' }} />
                                                        <Typography variant="overline" sx={{ color: '#6B7280' }}>Reason</Typography>
                                                    </Box>
                                                    <Typography variant="body2">{finding.reason}</Typography>
                                                </Box>
                                            </AccordionDetails>
                                        </Accordion>
                                    );
                                })}
                            </Box>
                        </CardContent>
                    </Card>

                    {/* Dismissed tray */}
                    {dismissedFindings.length > 0 && (
                        <Card sx={{ mt: 2, border: '1px solid #E5E7EB' }}>
                            <CardContent sx={{ p: 0 }}>
                                <Box sx={{ px: 3, py: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', '&:hover': { bgcolor: '#F9FAFB' } }} onClick={() => setShowDismissed(v => !v)}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                        <RestoreFromTrash sx={{ fontSize: 18, color: '#9CA3AF' }} />
                                        <Typography variant="body2" fontWeight={600} color="text.secondary">{dismissedFindings.length} dismissed finding{dismissedFindings.length > 1 ? 's' : ''}</Typography>
                                        <Chip label={showDismissed ? 'Hide' : 'Show'} size="small" sx={{ fontSize: '0.6875rem', height: 20, bgcolor: '#F3F4F6', color: '#6B7280' }} />
                                    </Box>
                                    <Button size="small" startIcon={<RestoreFromTrash sx={{ fontSize: 14 }} />} onClick={(e) => { e.stopPropagation(); handleRestoreAll(); }} sx={{ color: '#6B7280', fontSize: '0.75rem' }}>Restore all</Button>
                                </Box>
                                <Collapse in={showDismissed}>
                                    <Divider />
                                    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                                        {dismissedFindings.map((f) => {
                                            const sev = SEVERITY_CONFIG[f.severity] ?? SEVERITY_CONFIG.medium;
                                            return (
                                                <Box key={f.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.25, bgcolor: '#F9FAFB', borderRadius: 1, border: '1px solid #F3F4F6', opacity: 0.75 }}>
                                                    <Chip icon={sev.icon as any} label={sev.label} size="small" sx={{ bgcolor: sev.bg, color: sev.color, fontWeight: 600, borderRadius: 1, border: 'none', minWidth: 76, fontSize: '0.6875rem' }} />
                                                    <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '0.8125rem', flex: 1 }}>{f.condition.attribute}</Typography>
                                                    <Typography variant="caption" color="text.disabled" sx={{ display: { xs: 'none', sm: 'block' }, flex: 1 }}>{f.reason}</Typography>
                                                    <Tooltip title="Restore finding">
                                                        <IconButton size="small" onClick={() => handleRestore(f.id)} sx={{ color: '#9CA3AF', '&:hover': { color: '#10B981', bgcolor: '#F0FDF4' } }}>
                                                            <RestoreFromTrash sx={{ fontSize: 16 }} />
                                                        </IconButton>
                                                    </Tooltip>
                                                </Box>
                                            );
                                        })}
                                    </Box>
                                </Collapse>
                            </CardContent>
                        </Card>
                    )}
                </>
            )}
        </PageShell>
    );
};

export default Validation;
