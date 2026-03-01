import React, { useState } from 'react';
import {
    Box, Card, CardContent, Typography, Button,
    Divider, Chip, Breadcrumbs, Table, TableBody, TableCell,
    TableContainer, TableHead, TableRow, Tab, Tabs,
} from '@mui/material';
import { NavigateNext, Download, PictureAsPdf, Description, QueryStats } from '@mui/icons-material';
import { formatDateTime } from '../lib/formatters';
import PageShell from '../components/layout/PageShell';
import AuditLog from '../components/audit/AuditLog';

const MOCK_REPORTS = [
    { id: 'r-001', name: 'AWS Production Scan — March 2026', provider: 'aws', type: 'Compatibility Report', status: 'passed', date: '2026-03-01T06:04:30Z', size: '1.2 MB', format: 'PDF' },
    { id: 'r-002', name: 'Azure Staging Config Extraction', provider: 'azure', type: 'Extraction Report', status: 'mismatch', date: '2026-02-28T14:03:15Z', size: '0.8 MB', format: 'JSON' },
    { id: 'r-003', name: 'GCP Dev Scan — Failed Auth', provider: 'gcp', type: 'Scan Error Log', status: 'failed', date: '2026-02-27T10:01:10Z', size: '0.2 MB', format: 'JSON' },
];

const STATUS = {
    passed: { color: 'success' as const, label: 'Passed' },
    mismatch: { color: 'warning' as const, label: 'Mismatch' },
    failed: { color: 'error' as const, label: 'Failed' },
};

const PROVIDER_COLORS: Record<string, string> = { aws: '#FF9900', gcp: '#4285F4', azure: '#0078D4' };

const Reports: React.FC = () => {
    const [tab, setTab] = useState(0);

    return (
        <PageShell>
            <Breadcrumbs separator={<NavigateNext fontSize="small" sx={{ color: '#9CA3AF' }} />} sx={{ mb: 1 }}>
                <Typography component="a" href="/" sx={{ fontSize: '0.8125rem', color: 'text.secondary', textDecoration: 'none' }}>Dashboard</Typography>
                <Typography sx={{ fontSize: '0.8125rem', color: 'text.primary', fontWeight: 500 }}>Reports</Typography>
            </Breadcrumbs>

            <Box sx={{ mb: 4 }}>
                <Typography variant="h1" sx={{ fontSize: { xs: '1.375rem', md: '1.75rem' }, fontWeight: 600, mb: 0.5 }}>Reports & Audit</Typography>
                <Typography variant="body2" color="text.secondary">Download analysis reports and review structured audit logs of all scan activity.</Typography>
            </Box>

            {/* Tabs */}
            <Box sx={{ borderBottom: '1px solid #F3F4F6', mb: 3 }}>
                <Tabs value={tab} onChange={(_, v) => setTab(v)}>
                    <Tab label="Reports" sx={{ textTransform: 'none', fontSize: '0.875rem' }} />
                    <Tab label={<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}><QueryStats sx={{ fontSize: 16 }} /> Audit Log</Box>} sx={{ textTransform: 'none', fontSize: '0.875rem' }} />
                </Tabs>
            </Box>

            {tab === 0 && (
                <Card>
                    <CardContent sx={{ p: 0 }}>
                        <Box sx={{ px: 3, py: 2.5, borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Typography variant="h5">All Reports</Typography>
                            <Typography variant="caption" color="text.secondary">{MOCK_REPORTS.length} reports</Typography>
                        </Box>
                        <TableContainer>
                            <Table>
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Report</TableCell>
                                        <TableCell>Provider</TableCell>
                                        <TableCell>Type</TableCell>
                                        <TableCell>Status</TableCell>
                                        <TableCell>Size</TableCell>
                                        <TableCell>Date</TableCell>
                                        <TableCell align="right">Action</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {MOCK_REPORTS.map((r) => {
                                        const sc = STATUS[r.status as keyof typeof STATUS];
                                        return (
                                            <TableRow key={r.id} hover>
                                                <TableCell>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                                        <Box sx={{ color: r.format === 'PDF' ? '#EF4444' : '#2563EB' }}>
                                                            {r.format === 'PDF' ? <PictureAsPdf /> : <Description />}
                                                        </Box>
                                                        <Typography variant="body2" fontWeight={500}>{r.name}</Typography>
                                                    </Box>
                                                </TableCell>
                                                <TableCell>
                                                    <Chip label={r.provider.toUpperCase()} size="small" sx={{ color: PROVIDER_COLORS[r.provider], fontWeight: 700, fontSize: '0.6875rem', borderRadius: 1 }} variant="outlined" />
                                                </TableCell>
                                                <TableCell><Typography variant="body2">{r.type}</Typography></TableCell>
                                                <TableCell>
                                                    <Chip label={sc.label} size="small" color={sc.color} variant="outlined" sx={{ borderRadius: 99, fontSize: '0.75rem' }} />
                                                </TableCell>
                                                <TableCell><Typography variant="body2" color="text.secondary">{r.size}</Typography></TableCell>
                                                <TableCell><Typography variant="caption" color="text.secondary">{formatDateTime(r.date)}</Typography></TableCell>
                                                <TableCell align="right">
                                                    <Button size="small" startIcon={<Download sx={{ fontSize: 14 }} />} sx={{ fontSize: '0.8125rem', color: 'primary.main' }}>Download</Button>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </CardContent>
                </Card>
            )}

            {tab === 1 && <AuditLog />}
        </PageShell>
    );
};

export default Reports;
