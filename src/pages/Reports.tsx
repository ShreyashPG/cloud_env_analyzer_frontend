import React, { useEffect, useState } from 'react';
import {
    Box, Card, CardContent, Typography, Breadcrumbs, Chip, Alert,
    LinearProgress, Table, TableBody, TableCell, TableHead, TableRow,
    TableContainer, Button,
} from '@mui/material';
import { Grid } from '@mui/material';
import { NavigateNext, CheckCircle, ErrorOutline, ArrowBack } from '@mui/icons-material';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSnackbar } from 'notistack';
import PageShell from '../components/layout/PageShell';
import { getReport } from '../api/scan';
import { useScanStore } from '../store/scanStore';
import type { ValidationReport, Finding, FindingStatus, Severity } from '../api/types';
import { formatDateTime } from '../lib/formatters';

const STATUS_CHIP: Record<FindingStatus, { color: string; bg: string }> = {
    pass: { color: '#10B981', bg: '#ECFDF5' },
    fail: { color: '#EF4444', bg: '#FEF2F2' },
    error: { color: '#F59E0B', bg: '#FFFBEB' },
    skipped: { color: '#6B7280', bg: '#F3F4F6' },
};
const SEV_COLOR: Record<Severity, string> = { critical: '#EF4444', high: '#F59E0B', medium: '#2563EB', low: '#10B981' };

const Reports: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { enqueueSnackbar } = useSnackbar();
    const { report: storeReport, reportId: storeReportId } = useScanStore();

    const resolvedReportId = (location.state as any)?.reportId ?? storeReportId;

    const [report, setReport] = useState<ValidationReport | null>(storeReport);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (resolvedReportId && !report) {
            setLoading(true);
            getReport(resolvedReportId)
                .then(setReport)
                .catch((err: any) => enqueueSnackbar(err.message ?? 'Failed to load report', { variant: 'error' }))
                .finally(() => setLoading(false));
        }
    }, [resolvedReportId]);

    return (
        <PageShell>
            <Breadcrumbs separator={<NavigateNext fontSize="small" sx={{ color: '#9CA3AF' }} />} sx={{ mb: 1 }}>
                <Typography component="a" href="/" sx={{ fontSize: '0.8125rem', color: 'text.secondary', textDecoration: 'none' }}>Dashboard</Typography>
                <Typography sx={{ fontSize: '0.8125rem', color: 'text.primary', fontWeight: 500 }}>Report</Typography>
            </Breadcrumbs>

            <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 4, flexWrap: 'wrap', gap: 2 }}>
                <Box>
                    <Typography variant="h1" sx={{ fontSize: { xs: '1.375rem', md: '1.75rem' }, fontWeight: 600, mb: 0.5 }}>Full Validation Report</Typography>
                    <Typography variant="body2" color="text.secondary">
                        {report ? `Generated ${formatDateTime(report.generated_at)} · ${report.cloud_provider.toUpperCase()} · ${report.region}` : 'Azure prerequisite validation results.'}
                    </Typography>
                </Box>
                <Button startIcon={<ArrowBack sx={{ fontSize: 14 }} />} onClick={() => navigate('/scan')} size="small" variant="outlined" sx={{ borderColor: '#E4E7EC', color: 'text.secondary' }}>Back to Scan</Button>
            </Box>

            {loading && (
                <Card sx={{ mb: 3 }}>
                    <CardContent sx={{ p: 3 }}>
                        <Typography variant="body2" gutterBottom>Loading report…</Typography>
                        <LinearProgress />
                    </CardContent>
                </Card>
            )}

            {!loading && !report && !resolvedReportId && (
                <Alert severity="info" sx={{ mt: 4 }}>
                    No report generated yet. <Typography component="span" sx={{ textDecoration: 'underline', cursor: 'pointer' }} onClick={() => navigate('/scan')}>Run a scan first →</Typography>
                </Alert>
            )}

            {!loading && report && (
                <>
                    {/* Readiness banner */}
                    <Alert
                        severity={report.summary.deployment_ready ? 'success' : 'error'}
                        icon={report.summary.deployment_ready ? <CheckCircle /> : <ErrorOutline />}
                        sx={{ mb: 3, borderRadius: 2, fontWeight: 500 }}
                    >
                        {report.summary.deployment_ready
                            ? 'Environment is deployment ready — all critical checks passed.'
                            : `${report.summary.critical_failures} critical and ${report.summary.high_failures} high failures must be resolved.`}
                    </Alert>

                    {/* Summary cards */}
                    <Grid container spacing={2} sx={{ mb: 3 }}>
                        {[
                            { label: 'Total Checks', value: report.summary.total, color: '#374151', bg: '#F9FAFB' },
                            { label: 'Passed', value: report.summary.passed, color: '#10B981', bg: '#ECFDF5' },
                            { label: 'Failed', value: report.summary.failed, color: '#EF4444', bg: '#FEF2F2' },
                            { label: 'Critical Failures', value: report.summary.critical_failures, color: '#991B1B', bg: '#FEE2E2' },
                            { label: 'High Failures', value: report.summary.high_failures, color: '#B45309', bg: '#FEF3C7' },
                            { label: 'Skipped', value: report.summary.skipped, color: '#6B7280', bg: '#F3F4F6' },
                        ].map((item) => (
                            <Grid key={item.label} size={{ xs: 6, sm: 4, md: 2 }}>
                                <Box sx={{ p: 2, bgcolor: item.bg, borderRadius: 2, textAlign: 'center' }}>
                                    <Typography variant="h4" sx={{ fontSize: '1.5rem', fontWeight: 700, color: item.color }}>{item.value}</Typography>
                                    <Typography variant="caption" fontWeight={600} color="text.secondary">{item.label}</Typography>
                                </Box>
                            </Grid>
                        ))}
                    </Grid>

                    {/* All findings by status sections */}
                    {(['fail', 'error', 'pass', 'skipped'] as FindingStatus[]).map((status) => {
                        const findings = report.findings_by_status[status] ?? [];
                        if (findings.length === 0) return null;
                        const sc = STATUS_CHIP[status];
                        return (
                            <Card key={status} sx={{ mb: 2 }}>
                                <CardContent sx={{ p: 0 }}>
                                    <Box sx={{ px: 3, py: 2.5, borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Chip label={status.toUpperCase()} size="small" sx={{ bgcolor: sc.bg, color: sc.color, fontWeight: 700, borderRadius: 1 }} />
                                        <Typography variant="h6">{findings.length} finding{findings.length !== 1 ? 's' : ''}</Typography>
                                    </Box>
                                    <TableContainer>
                                        <Table size="small">
                                            <TableHead>
                                                <TableRow>
                                                    <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Severity</TableCell>
                                                    <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Attribute</TableCell>
                                                    <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Operator</TableCell>
                                                    <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Expected</TableCell>
                                                    <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Actual</TableCell>
                                                    <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Resource</TableCell>
                                                    <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Reason</TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {findings.map((f: Finding) => (
                                                    <TableRow key={f.id} hover>
                                                        <TableCell>
                                                            <Chip label={f.severity} size="small" sx={{ bgcolor: SEV_COLOR[f.severity] + '20', color: SEV_COLOR[f.severity], fontWeight: 600, borderRadius: 1, fontSize: '0.6875rem' }} />
                                                        </TableCell>
                                                        <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>{f.condition.attribute}</TableCell>
                                                        <TableCell>
                                                            <Chip label={f.condition.operator} size="small" sx={{ bgcolor: '#EFF6FF', color: '#1D4ED8', fontWeight: 600, borderRadius: 1, fontSize: '0.6875rem' }} />
                                                        </TableCell>
                                                        <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>
                                                            {f.expected_value !== null && f.expected_value !== undefined ? String(f.expected_value) : '—'}
                                                        </TableCell>
                                                        <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8125rem', color: status === 'fail' ? '#EF4444' : 'inherit' }}>
                                                            {f.actual_value !== null && f.actual_value !== undefined ? String(f.actual_value) : <em style={{ color: '#9CA3AF' }}>not found</em>}
                                                        </TableCell>
                                                        <TableCell>
                                                            <Typography variant="caption" color="text.secondary">{f.resource_name ?? '—'}</Typography>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Typography variant="caption" color="text.secondary">{f.reason}</Typography>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </TableContainer>
                                </CardContent>
                            </Card>
                        );
                    })}
                </>
            )}
        </PageShell>
    );
};

export default Reports;
