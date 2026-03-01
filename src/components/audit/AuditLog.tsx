import React, { useEffect, useState } from 'react';
import {
    Box, Card, CardContent, Typography, Chip, Table, TableBody,
    TableCell, TableContainer, TableHead, TableRow, LinearProgress,
    Select, MenuItem, FormControl, InputLabel,
} from '@mui/material';
import { CheckCircle, ErrorOutline, InfoOutlined, WarningAmber } from '@mui/icons-material';
import { formatDateTime } from '../../lib/formatters';
import type { AuditEvent, AuditEventLevel } from '../../api/types';
import { API_BASE_URL } from '../../lib/constants';
import axios from 'axios';

const LEVEL_CONFIG: Record<AuditEventLevel, { color: string; bg: string; label: string; icon: React.ReactNode }> = {
    info: { color: '#2563EB', bg: '#EFF6FF', label: 'INFO', icon: <InfoOutlined sx={{ fontSize: 14 }} /> },
    warn: { color: '#F59E0B', bg: '#FFFBEB', label: 'WARN', icon: <WarningAmber sx={{ fontSize: 14 }} /> },
    error: { color: '#EF4444', bg: '#FEF2F2', label: 'ERROR', icon: <ErrorOutline sx={{ fontSize: 14 }} /> },
    success: { color: '#10B981', bg: '#F0FDF4', label: 'SUCCESS', icon: <CheckCircle sx={{ fontSize: 14 }} /> },
};

const AuditLog: React.FC = () => {
    const [logs, setLogs] = useState<AuditEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [levelFilter, setLevelFilter] = useState<AuditEventLevel | 'all'>('all');
    const [moduleFilter, setModuleFilter] = useState<string>('all');

    useEffect(() => {
        axios.get(`${API_BASE_URL}/auditLogs`)
            .then(res => { setLogs(res.data); setLoading(false); })
            .catch(() => setLoading(false));
    }, []);

    const modules = Array.from(new Set(logs.map(l => l.module)));
    const filtered = logs
        .filter(l => levelFilter === 'all' || l.level === levelFilter)
        .filter(l => moduleFilter === 'all' || l.module === moduleFilter);

    return (
        <Card>
            <CardContent sx={{ p: 0 }}>
                {/* Header */}
                <Box sx={{ px: 3, py: 2.5, borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
                    <Box>
                        <Typography variant="h5">Audit Log</Typography>
                        <Typography variant="caption" color="text.secondary">Structured log of all scan checks and API interactions</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1.5 }}>
                        <FormControl size="small" sx={{ minWidth: 120 }}>
                            <InputLabel>Level</InputLabel>
                            <Select value={levelFilter} label="Level" onChange={e => setLevelFilter(e.target.value as any)}>
                                <MenuItem value="all">All Levels</MenuItem>
                                {(['info', 'warn', 'error', 'success'] as AuditEventLevel[]).map(l => (
                                    <MenuItem key={l} value={l}>{l.toUpperCase()}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <FormControl size="small" sx={{ minWidth: 120 }}>
                            <InputLabel>Module</InputLabel>
                            <Select value={moduleFilter} label="Module" onChange={e => setModuleFilter(e.target.value)}>
                                <MenuItem value="all">All Modules</MenuItem>
                                {modules.map(m => <MenuItem key={m} value={m}>{m}</MenuItem>)}
                            </Select>
                        </FormControl>
                    </Box>
                </Box>

                {loading && <LinearProgress />}

                <TableContainer sx={{ maxHeight: 480 }}>
                    <Table stickyHeader size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#6B7280' }}>Timestamp</TableCell>
                                <TableCell sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#6B7280' }}>Level</TableCell>
                                <TableCell sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#6B7280' }}>Module</TableCell>
                                <TableCell sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#6B7280' }}>Action</TableCell>
                                <TableCell sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#6B7280' }}>Result</TableCell>
                                <TableCell sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#6B7280' }} align="right">Duration</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {filtered.map(log => {
                                const cfg = LEVEL_CONFIG[log.level];
                                return (
                                    <TableRow key={log.id} hover sx={{ '& td': { py: 1 } }}>
                                        <TableCell>
                                            <Typography variant="caption" sx={{ fontFamily: 'monospace', color: '#6B7280', whiteSpace: 'nowrap' }}>
                                                {new Date(log.timestamp).toLocaleTimeString('en-US', { hour12: false })}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Chip
                                                icon={cfg.icon as any}
                                                label={cfg.label}
                                                size="small"
                                                sx={{ bgcolor: cfg.bg, color: cfg.color, fontWeight: 700, fontSize: '0.625rem', borderRadius: 1, border: 'none', height: 20 }}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#374151', fontWeight: 600 }}>{log.module}</Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Typography variant="caption" sx={{ fontFamily: 'monospace', color: '#6B7280' }}>{log.action}</Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Typography variant="caption" color="text.primary">{log.result}</Typography>
                                        </TableCell>
                                        <TableCell align="right">
                                            {log.durationMs !== undefined && log.durationMs > 0 && (
                                                <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                                                    {log.durationMs}ms
                                                </Typography>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                            {!loading && filtered.length === 0 && (
                                <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4, color: '#9CA3AF' }}>No log entries.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            </CardContent>
        </Card>
    );
};

export default AuditLog;
