import React, { useEffect, useState } from 'react';
import {
    Box, Card, CardContent, Typography, Chip,
    Divider, Button, Table, TableBody, TableCell,
    TableContainer, TableHead, TableRow, LinearProgress, Breadcrumbs,
} from '@mui/material';
import { Grid } from '@mui/material';
import {
    TravelExploreOutlined, UploadFileOutlined, VerifiedOutlined,
    CheckCircle, ErrorOutline, NavigateNext, TrendingUp,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import type { DashboardStats, Scan } from '../api/types';
import { formatDateTime } from '../lib/formatters';
import PageShell from '../components/layout/PageShell';

const PROVIDER_COLORS: Record<string, string> = {
    aws: '#FF9900',
    gcp: '#4285F4',
    azure: '#0078D4',
};

const Dashboard: React.FC = () => {
    const navigate = useNavigate();
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [scans, setScans] = useState<Scan[]>([]);

    useEffect(() => {
        client.get('/dashboard').then(({ data }) => setStats(data[0])).catch(() => {
            setStats({
                id: 'stats',
                totalScans: 12,
                totalExtractions: 34,
                totalValidations: 28,
                totalIssues: 19,
                deploymentsReady: 22,
                lastScanAt: new Date().toISOString(),
                providerDistribution: { aws: 8, azure: 3, gcp: 1 },
            });
        });
        client.get('/scans').then(({ data }) => setScans(data)).catch(() => setScans([]));
    }, []);

    const kpiCards = stats ? [
        { title: 'Total Scans', value: stats.totalScans, icon: <TravelExploreOutlined />, color: '#2563EB', bg: '#EFF6FF', subtitle: 'Cloud environments scanned' },
        { title: 'Extractions', value: stats.totalExtractions, icon: <UploadFileOutlined />, color: '#10B981', bg: '#ECFDF5', subtitle: 'Config files processed' },
        { title: 'Validations', value: stats.totalValidations, icon: <VerifiedOutlined />, color: '#8B5CF6', bg: '#EDE9FE', subtitle: 'Templates validated' },
        { title: 'Ready to Deploy', value: stats.deploymentsReady, icon: <CheckCircle />, color: '#059669', bg: '#D1FAE5', subtitle: `${stats.totalIssues} issues found` },
    ] : [];

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
            {stats && (
                <Grid container spacing={3} sx={{ mb: 4 }}>
                    {kpiCards.map((card) => (
                        <Grid key={card.title} size={{ xs: 12, sm: 6, lg: 3 }}>
                            <Card>
                                <CardContent sx={{ p: 3 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
                                        <Box sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: card.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: card.color }}>
                                            {card.icon}
                                        </Box>
                                        <Chip label="+12%" size="small" sx={{ bgcolor: '#F0FDF4', color: '#15803D', fontWeight: 600, fontSize: '0.6875rem' }} />
                                    </Box>
                                    <Typography variant="h2" sx={{ fontSize: '1.875rem', fontWeight: 700, mb: 0.25 }}>{card.value}</Typography>
                                    <Typography variant="body2" fontWeight={600} color="text.primary">{card.title}</Typography>
                                    <Typography variant="caption" color="text.secondary">{card.subtitle}</Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                    ))}
                </Grid>
            )}

            <Grid container spacing={3}>
                {/* Recent Scans */}
                <Grid size={{ xs: 12, lg: 8 }}>
                    <Card>
                        <CardContent sx={{ p: 0 }}>
                            <Box sx={{ px: 3, py: 2.5, borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <Typography variant="h5">Recent Scans</Typography>
                                <Button size="small" onClick={() => navigate('/scan')} sx={{ color: 'primary.main', fontSize: '0.8125rem' }}>View all →</Button>
                            </Box>
                            <TableContainer>
                                <Table>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Provider</TableCell>
                                            <TableCell>Environment</TableCell>
                                            <TableCell>Status</TableCell>
                                            <TableCell>Resources</TableCell>
                                            <TableCell>Issues</TableCell>
                                            <TableCell>Date</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {scans.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={6} align="center" sx={{ py: 4, color: '#9CA3AF' }}>No scans yet. Start a new scan to see results.</TableCell>
                                            </TableRow>
                                        ) : scans.map((scan) => (
                                            <TableRow key={scan.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate('/scan')}>
                                                <TableCell>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: PROVIDER_COLORS[scan.provider] ?? '#999' }} />
                                                        <Typography variant="body2" fontWeight={500} sx={{ textTransform: 'uppercase', fontSize: '0.75rem', color: PROVIDER_COLORS[scan.provider] }}>{scan.provider}</Typography>
                                                    </Box>
                                                </TableCell>
                                                <TableCell><Typography variant="body2">{scan.environment}</Typography></TableCell>
                                                <TableCell>
                                                    <Chip
                                                        icon={scan.status === 'completed' ? <CheckCircle sx={{ fontSize: 14 }} /> : <ErrorOutline sx={{ fontSize: 14 }} />}
                                                        label={scan.status}
                                                        size="small"
                                                        color={scan.status === 'completed' ? 'success' : scan.status === 'failed' ? 'error' : 'warning'}
                                                        variant="outlined"
                                                        sx={{ textTransform: 'capitalize', fontSize: '0.75rem', borderRadius: 99 }}
                                                    />
                                                </TableCell>
                                                <TableCell><Typography variant="body2">{scan.resourceCount}</Typography></TableCell>
                                                <TableCell>
                                                    <Typography variant="body2" color={scan.issueCount > 0 ? 'error.main' : 'success.main'} fontWeight={600}>{scan.issueCount}</Typography>
                                                </TableCell>
                                                <TableCell><Typography variant="caption" color="text.secondary">{formatDateTime(scan.startedAt)}</Typography></TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </CardContent>
                    </Card>
                </Grid>

                {/* Provider Distribution */}
                <Grid size={{ xs: 12, lg: 4 }}>
                    <Card sx={{ height: '100%' }}>
                        <CardContent sx={{ p: 3 }}>
                            <Typography variant="h5" gutterBottom>Provider Distribution</Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>Breakdown of scans by cloud provider</Typography>
                            {stats && Object.entries(stats.providerDistribution).map(([provider, count]) => {
                                const total = Object.values(stats.providerDistribution).reduce((a, b) => a + b, 0);
                                const pct = Math.round((count / total) * 100);
                                const color = PROVIDER_COLORS[provider] ?? '#999';
                                return (
                                    <Box key={provider} sx={{ mb: 2 }}>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: color }} />
                                                <Typography variant="body2" fontWeight={500} sx={{ textTransform: 'uppercase', fontSize: '0.75rem', color }}>{provider}</Typography>
                                            </Box>
                                            <Typography variant="body2" fontWeight={600}>{count} <Typography component="span" variant="caption" color="text.secondary">({pct}%)</Typography></Typography>
                                        </Box>
                                        <LinearProgress variant="determinate" value={pct} sx={{ height: 6, borderRadius: 99, bgcolor: '#F3F4F6', '& .MuiLinearProgress-bar': { bgcolor: color, backgroundImage: 'none' } }} />
                                    </Box>
                                );
                            })}
                            <Divider sx={{ my: 2 }} />
                            <Button variant="outlined" fullWidth size="medium" onClick={() => navigate('/scan')} sx={{ borderColor: '#D1D5DB', color: 'text.primary' }}>Start New Scan</Button>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            {/* Quick actions */}
            <Box sx={{ mt: 3 }}>
                <Typography variant="h5" gutterBottom>Quick Actions</Typography>
                <Grid container spacing={2}>
                    {[
                        { label: 'Upload & Extract', desc: 'Analyze a new config file', icon: <UploadFileOutlined />, color: '#2563EB', bg: '#EFF6FF', path: '/extract' },
                        { label: 'Run Scan', desc: 'Scan a cloud environment', icon: <TravelExploreOutlined />, color: '#8B5CF6', bg: '#EDE9FE', path: '/scan' },
                        { label: 'View Reports', desc: 'Review past analysis reports', icon: <VerifiedOutlined />, color: '#059669', bg: '#D1FAE5', path: '/reports' },
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
