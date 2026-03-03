import React from 'react';
import {
    Box, Card, CardContent, Typography, Chip, Divider,
    Button, Table, TableBody, TableCell, TableContainer, TableHead,
    TableRow, Breadcrumbs,
} from '@mui/material';
import { Grid } from '@mui/material';
import {
    TravelExploreOutlined, UploadFileOutlined, VerifiedOutlined,
    CheckCircle, ErrorOutline, NavigateNext, TrendingUp, AssessmentOutlined,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import PageShell from '../components/layout/PageShell';
import { useExtractionStore } from '../store/extractionStore';
import { useScanStore } from '../store/scanStore';
import { formatDateTime } from '../lib/formatters';

const Dashboard: React.FC = () => {
    const navigate = useNavigate();
    const { phase: extractPhase, total: extractedTotal, filename } = useExtractionStore();
    const { report } = useScanStore();

    // Derive stats from stores — no mock data needed
    const hasExtraction = extractPhase === 'done';
    const hasScan = !!report;
    const isReady = report?.summary.deployment_ready ?? false;

    const kpiCards = [
        {
            title: 'Prerequisites', value: hasExtraction ? extractedTotal : '—',
            icon: <UploadFileOutlined />, color: '#2563EB', bg: '#EFF6FF',
            subtitle: hasExtraction ? `From "${filename ?? 'document'}"` : 'No document uploaded yet',
        },
        {
            title: 'Checks Run', value: hasScan ? report!.summary.total : '—',
            icon: <TravelExploreOutlined />, color: '#8B5CF6', bg: '#EDE9FE',
            subtitle: hasScan ? `on ${report!.cloud_provider.toUpperCase()} ${report!.region}` : 'No scan run yet',
        },
        {
            title: 'Passed', value: hasScan ? report!.summary.passed : '—',
            icon: <VerifiedOutlined />, color: '#10B981', bg: '#ECFDF5',
            subtitle: hasScan ? `${report!.summary.failed} failed` : 'Run a scan to see results',
        },
        {
            title: 'Deployment', value: hasScan ? (isReady ? 'Ready' : 'Blocked') : '—',
            icon: isReady ? <CheckCircle /> : <ErrorOutline />, color: isReady ? '#059669' : '#EF4444', bg: isReady ? '#D1FAE5' : '#FEE2E2',
            subtitle: hasScan ? `${report!.summary.critical_failures} critical failures` : 'Pending scan',
        },
    ];

    return (
        <PageShell>
            <Breadcrumbs separator={<NavigateNext fontSize="small" sx={{ color: '#9CA3AF' }} />} sx={{ mb: 1 }}>
                <Typography sx={{ fontSize: '0.8125rem', color: 'text.primary', fontWeight: 500 }}>Dashboard</Typography>
            </Breadcrumbs>

            <Box sx={{ mb: 4, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
                <Box>
                    <Typography variant="h1" sx={{ fontSize: { xs: '1.375rem', md: '1.75rem' }, fontWeight: 600, mb: 0.5 }}>Dashboard</Typography>
                    <Typography variant="body2" color="text.secondary">Overview of your cloud environment analysis activity.</Typography>
                </Box>
                <Button variant="contained" onClick={() => navigate('/extract')} endIcon={<TrendingUp />}>New Extraction</Button>
            </Box>

            {/* KPI cards */}
            <Grid container spacing={3} sx={{ mb: 4 }}>
                {kpiCards.map((card) => (
                    <Grid key={card.title} size={{ xs: 12, sm: 6, lg: 3 }}>
                        <Card>
                            <CardContent sx={{ p: 3 }}>
                                <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
                                    <Box sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: card.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: card.color }}>
                                        {card.icon}
                                    </Box>
                                </Box>
                                <Typography variant="h2" sx={{ fontSize: '1.875rem', fontWeight: 700, mb: 0.25 }}>{card.value}</Typography>
                                <Typography variant="body2" fontWeight={600} color="text.primary">{card.title}</Typography>
                                <Typography variant="caption" color="text.secondary">{card.subtitle}</Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                ))}
            </Grid>

            <Grid container spacing={3}>
                {/* Recent scan results */}
                <Grid size={{ xs: 12, lg: 8 }}>
                    <Card>
                        <CardContent sx={{ p: 0 }}>
                            <Box sx={{ px: 3, py: 2.5, borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <Typography variant="h5">Latest Scan Results</Typography>
                                <Button size="small" onClick={() => navigate('/scan')} sx={{ color: 'primary.main', fontSize: '0.8125rem' }}>Go to scan →</Button>
                            </Box>
                            {!hasScan ? (
                                <Box sx={{ py: 6, textAlign: 'center', color: '#9CA3AF' }}>
                                    <TravelExploreOutlined sx={{ fontSize: 40, mb: 1 }} />
                                    <Typography>No scan results yet.</Typography>
                                    <Button variant="outlined" sx={{ mt: 2 }} onClick={() => navigate('/scan')}>Start a Scan</Button>
                                </Box>
                            ) : (
                                <TableContainer>
                                    <Table>
                                        <TableHead>
                                            <TableRow>
                                                <TableCell>Provider</TableCell>
                                                <TableCell>Region</TableCell>
                                                <TableCell>Status</TableCell>
                                                <TableCell>Passed</TableCell>
                                                <TableCell>Failed</TableCell>
                                                <TableCell>Critical</TableCell>
                                                <TableCell>Generated</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            <TableRow hover sx={{ cursor: 'pointer' }} onClick={() => navigate('/reports')}>
                                                <TableCell>
                                                    <Chip
                                                        label={report!.cloud_provider.toUpperCase()}
                                                        size="small"
                                                        sx={{ color: '#0078D4', fontWeight: 700, fontSize: '0.6875rem', borderRadius: 1 }}
                                                        variant="outlined"
                                                    />
                                                </TableCell>
                                                <TableCell><Typography variant="body2">{report!.region}</Typography></TableCell>
                                                <TableCell>
                                                    <Chip
                                                        icon={report!.summary.deployment_ready ? <CheckCircle sx={{ fontSize: '14px !important' }} /> : <ErrorOutline sx={{ fontSize: '14px !important' }} />}
                                                        label={report!.summary.deployment_ready ? 'Ready' : 'Blocked'}
                                                        size="small"
                                                        color={report!.summary.deployment_ready ? 'success' : 'error'}
                                                        variant="outlined"
                                                        sx={{ borderRadius: 99, fontSize: '0.75rem' }}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Typography variant="body2" color="success.main" fontWeight={600}>{report!.summary.passed}</Typography>
                                                </TableCell>
                                                <TableCell>
                                                    <Typography variant="body2" color={report!.summary.failed > 0 ? 'error.main' : 'success.main'} fontWeight={600}>
                                                        {report!.summary.failed}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell>
                                                    <Typography variant="body2" color={report!.summary.critical_failures > 0 ? 'error.main' : 'success.main'} fontWeight={700}>
                                                        {report!.summary.critical_failures}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell><Typography variant="caption" color="text.secondary">{formatDateTime(report!.generated_at)}</Typography></TableCell>
                                            </TableRow>
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            )}
                        </CardContent>
                    </Card>
                </Grid>

                {/* Quick workflow guide */}
                <Grid size={{ xs: 12, lg: 4 }}>
                    <Card sx={{ height: '100%' }}>
                        <CardContent sx={{ p: 3 }}>
                            <Typography variant="h5" gutterBottom>Workflow</Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>Complete these steps to validate your Azure environment:</Typography>
                            {[
                                { step: 1, label: 'Upload Document', done: hasExtraction, path: '/extract', desc: 'Upload prerequisites PDF/DOCX' },
                                { step: 2, label: 'Run Azure Scan', done: hasScan, path: '/scan', desc: 'Scan live Azure resources' },
                                { step: 3, label: 'View Report', done: hasScan && isReady, path: '/reports', desc: 'Review validation findings' },
                            ].map((item) => (
                                <Box key={item.step} sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 2 }}>
                                    <Box sx={{
                                        width: 28, height: 28, borderRadius: '50%', flexShrink: 0, mt: 0.25,
                                        bgcolor: item.done ? '#D1FAE5' : '#F3F4F6',
                                        color: item.done ? '#059669' : '#9CA3AF',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '0.75rem', fontWeight: 700,
                                    }}>
                                        {item.done ? <CheckCircle sx={{ fontSize: 16 }} /> : item.step}
                                    </Box>
                                    <Box sx={{ flex: 1 }}>
                                        <Typography variant="body2" fontWeight={600} sx={{ cursor: 'pointer', '&:hover': { color: 'primary.main' } }} onClick={() => navigate(item.path)}>
                                            {item.label}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">{item.desc}</Typography>
                                    </Box>
                                </Box>
                            ))}
                            <Divider sx={{ my: 2 }} />
                            <Button variant="outlined" fullWidth size="medium" onClick={() => navigate('/extract')} sx={{ borderColor: '#D1D5DB', color: 'text.primary' }}>
                                {hasExtraction ? 'Upload Another Document' : 'Start Now'}
                            </Button>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            {/* Quick actions */}
            <Box sx={{ mt: 3 }}>
                <Typography variant="h5" gutterBottom>Quick Actions</Typography>
                <Grid container spacing={2}>
                    {[
                        { label: 'Upload & Extract', desc: 'Analyze a prerequisites document', icon: <UploadFileOutlined />, color: '#2563EB', bg: '#EFF6FF', path: '/extract' },
                        { label: 'Run Azure Scan', desc: 'Scan live Azure environment', icon: <TravelExploreOutlined />, color: '#8B5CF6', bg: '#EDE9FE', path: '/scan' },
                        { label: 'View Reports', desc: 'Review validation findings', icon: <AssessmentOutlined />, color: '#059669', bg: '#D1FAE5', path: '/reports' },
                    ].map((action) => (
                        <Grid key={action.label} size={{ xs: 12, sm: 4 }}>
                            <Card sx={{ cursor: 'pointer', transition: 'box-shadow 150ms', '&:hover': { boxShadow: '0 4px 20px rgba(0,0,0,0.1)' } }} onClick={() => navigate(action.path)}>
                                <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2.5 }}>
                                    <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: action.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: action.color }}>{action.icon}</Box>
                                    <Box>
                                        <Typography variant="body2" fontWeight={600}>{action.label}</Typography>
                                        <Typography variant="caption" color="text.secondary">{action.desc}</Typography>
                                    </Box>
                                </CardContent>
                            </Card>
                        </Grid>
                    ))}
                </Grid>
            </Box>
        </PageShell>
    );
};

export default Dashboard;
