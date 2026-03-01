import React, { useEffect, useState } from 'react';
import {
    Box, Card, CardContent, Typography, Chip, Divider,
    Accordion, AccordionSummary, AccordionDetails, Breadcrumbs,
    Alert, LinearProgress, Tab, Tabs, Button, Tooltip,
} from '@mui/material';
import { Grid } from '@mui/material';
import {
    NavigateNext, ExpandMore, CheckCircle, WarningAmber,
    ErrorOutline, InfoOutlined, Shield, ArrowBack, Refresh,
} from '@mui/icons-material';
import { useValidationStore } from '../store/validationStore';
import { validateExtraction } from '../api/validation';
import PageShell from '../components/layout/PageShell';
import { useExtractionStore } from '../store/extractionStore';
import { FINDING_DOMAINS } from '../lib/constants';
import type { FindingDomain } from '../api/types';
import { useNavigate } from 'react-router-dom';

const SEVERITY_CONFIG = {
    blocker: { color: '#EF4444', bg: '#FEF2F2', icon: <ErrorOutline sx={{ fontSize: 16 }} />, label: 'Blocker', chipColor: 'error' as const },
    warning: { color: '#F59E0B', bg: '#FFFBEB', icon: <WarningAmber sx={{ fontSize: 16 }} />, label: 'Warning', chipColor: 'warning' as const },
    info: { color: '#2563EB', bg: '#EFF6FF', icon: <InfoOutlined sx={{ fontSize: 16 }} />, label: 'Info', chipColor: 'info' as const },
};

const DOMAIN_ICONS: Record<FindingDomain | 'all', React.ReactNode> = {
    all: null,
    identity: '🔑',
    network: '🌐',
    policy: '📋',
    resources: '🖥️',
    services: '⚙️',
    general: '📎',
};

const Validation: React.FC = () => {
    const { validation, setValidation, isValidating, setIsValidating, dismissedFindings } = useValidationStore();
    const { extraction } = useExtractionStore();
    const navigate = useNavigate();

    const [severityTab, setSeverityTab] = useState(0);
    const [domainTab, setDomainTab] = useState(0);

    const severityFilters = ['all', 'blocker', 'warning', 'info'];
    const domainFilters = FINDING_DOMAINS.map(d => d.id);

    const loadValidation = () => {
        setIsValidating(true);
        validateExtraction(extraction?.id ?? 'ext-001')
            .then((v) => { setValidation(v); setIsValidating(false); })
            .catch(() => setIsValidating(false));
    };

    useEffect(() => { if (!validation) loadValidation(); }, []);

    const allFindings = validation?.findings.filter((f) => !dismissedFindings.includes(f.id)) ?? [];

    // Filter by severity tab
    const afterSeverity = severityTab === 0 ? allFindings : allFindings.filter((f) => f.severity === severityFilters[severityTab]);

    // Filter by domain tab
    const filtered = domainTab === 0 ? afterSeverity : afterSeverity.filter((f) => f.domain === domainFilters[domainTab]);

    const counts = {
        blocker: allFindings.filter((f) => f.severity === 'blocker').length,
        warning: allFindings.filter((f) => f.severity === 'warning').length,
        info: allFindings.filter((f) => f.severity === 'info').length,
    };

    const domainCounts = domainFilters.reduce((acc, d) => {
        acc[d] = allFindings.filter((f) => f.domain === d).length;
        return acc;
    }, {} as Record<string, number>);

    const isReady = counts.blocker === 0;

    return (
        <PageShell>
            <Breadcrumbs separator={<NavigateNext fontSize="small" sx={{ color: '#9CA3AF' }} />} sx={{ mb: 1 }}>
                <Typography component="a" href="/" sx={{ fontSize: '0.8125rem', color: 'text.secondary', textDecoration: 'none' }}>Dashboard</Typography>
                <Typography component="a" href="/extract" onClick={(e) => { e.preventDefault(); navigate('/extract'); }} sx={{ fontSize: '0.8125rem', color: 'text.secondary', textDecoration: 'none', cursor: 'pointer' }}>Upload & Extract</Typography>
                <Typography sx={{ fontSize: '0.8125rem', color: 'text.primary', fontWeight: 500 }}>Validation</Typography>
            </Breadcrumbs>

            <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 4, flexWrap: 'wrap', gap: 2 }}>
                <Box>
                    <Typography variant="h1" sx={{ fontSize: { xs: '1.375rem', md: '1.75rem' }, fontWeight: 600, mb: 0.5 }}>Validation Report</Typography>
                    <Typography variant="body2" color="text.secondary">Prerequisite compatibility findings grouped by domain and severity.</Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button startIcon={<ArrowBack sx={{ fontSize: 14 }} />} onClick={() => navigate('/extract')} size="small" variant="outlined" sx={{ borderColor: '#E4E7EC', color: 'text.secondary' }}>Back to Review</Button>
                    <Button startIcon={<Refresh sx={{ fontSize: 14 }} />} onClick={loadValidation} disabled={isValidating} size="small" variant="outlined" sx={{ borderColor: '#E4E7EC', color: 'text.secondary' }}>Re-run</Button>
                </Box>
            </Box>

            {isValidating && (
                <Card sx={{ mb: 3 }}>
                    <CardContent sx={{ p: 3 }}>
                        <Typography variant="body2" gutterBottom>Validating extracted fields against AI Assist prerequisites…</Typography>
                        <LinearProgress />
                    </CardContent>
                </Card>
            )}

            {!isValidating && validation && (
                <>
                    {/* Readiness banner */}
                    <Alert severity={isReady ? 'success' : 'error'} icon={isReady ? <CheckCircle /> : <ErrorOutline />}
                        sx={{ mb: 3, borderRadius: 2, fontWeight: 500, borderLeft: `4px solid ${isReady ? '#10B981' : '#EF4444'}` }}>
                        {isReady
                            ? 'Deployment Ready — No critical blockers found. You can proceed with deployment.'
                            : `Not Ready — ${counts.blocker} blocker${counts.blocker > 1 ? 's' : ''} must be resolved before deployment.`}
                    </Alert>

                    {/* Severity KPI cards */}
                    <Grid container spacing={3} sx={{ mb: 3 }}>
                        {(['blocker', 'warning', 'info'] as const).map((sev) => {
                            const cfg = SEVERITY_CONFIG[sev];
                            return (
                                <Grid key={sev} size={{ xs: 12, sm: 4 }}>
                                    <Card sx={{ cursor: 'pointer', border: `1px solid ${severityTab === severityFilters.indexOf(sev) ? cfg.color : 'transparent'}`, transition: 'border 150ms' }}
                                        onClick={() => setSeverityTab(severityFilters.indexOf(sev))}>
                                        <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2.5 }}>
                                            <Box sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: cfg.color }}>{cfg.icon}</Box>
                                            <Box>
                                                <Typography variant="h4" sx={{ fontSize: '1.5rem', fontWeight: 700, color: cfg.color }}>{counts[sev]}</Typography>
                                                <Typography variant="body2" fontWeight={500}>{cfg.label}s</Typography>
                                            </Box>
                                        </CardContent>
                                    </Card>
                                </Grid>
                            );
                        })}
                    </Grid>

                    {/* Main findings panel */}
                    <Card>
                        <CardContent sx={{ p: 0 }}>
                            <Box sx={{ px: 3, pt: 2.5, borderBottom: '1px solid #F3F4F6' }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                                    <Typography variant="h5">Findings</Typography>
                                    <Typography variant="caption" color="text.secondary">{filtered.length} of {allFindings.length}</Typography>
                                </Box>

                                {/* Severity tabs */}
                                <Tabs value={severityTab} onChange={(_, v) => setSeverityTab(v)} sx={{ minHeight: 36, mb: 0 }}>
                                    {['All', 'Blockers', 'Warnings', 'Info'].map((label, i) => (
                                        <Tab key={label}
                                            label={`${label} ${i === 0 ? `(${allFindings.length})` : `(${counts[severityFilters[i] as keyof typeof counts]})`}`}
                                            sx={{ fontSize: '0.8125rem', minHeight: 36, textTransform: 'none' }} />
                                    ))}
                                </Tabs>
                            </Box>

                            {/* Domain tabs */}
                            <Box sx={{ px: 3, pt: 1.5, pb: 1, borderBottom: '1px solid #F3F4F6', display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                                {FINDING_DOMAINS.map((d, i) => (
                                    <Chip
                                        key={d.id}
                                        label={`${DOMAIN_ICONS[d.id as FindingDomain]} ${d.label}${i > 0 && domainCounts[d.id] !== undefined ? ` (${domainCounts[d.id]})` : ''}`}
                                        onClick={() => setDomainTab(i)}
                                        size="small"
                                        sx={{
                                            cursor: 'pointer',
                                            bgcolor: domainTab === i ? '#2563EB' : '#F3F4F6',
                                            color: domainTab === i ? '#fff' : '#6B7280',
                                            fontWeight: domainTab === i ? 700 : 400,
                                            '&:hover': { bgcolor: domainTab === i ? '#1D4ED8' : '#E5E7EB' },
                                            transition: 'all 120ms',
                                            fontSize: '0.75rem',
                                        }}
                                    />
                                ))}
                            </Box>

                            {/* Findings list */}
                            <Box sx={{ p: 2 }}>
                                {filtered.length === 0 ? (
                                    <Box sx={{ py: 5, textAlign: 'center', color: '#9CA3AF' }}>
                                        <CheckCircle sx={{ fontSize: 40, color: '#10B981', mb: 1 }} />
                                        <Typography>No findings in this category.</Typography>
                                    </Box>
                                ) : filtered.map((finding) => {
                                    const cfg = SEVERITY_CONFIG[finding.severity];
                                    return (
                                        <Accordion key={finding.id} elevation={0}
                                            sx={{ border: '1px solid #F3F4F6', borderRadius: '8px !important', mb: 1, '&:before': { display: 'none' } }}>
                                            <AccordionSummary expandIcon={<ExpandMore />} sx={{ px: 2.5 }}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', flex: 1 }}>
                                                    <Chip icon={cfg.icon as any} label={cfg.label} size="small"
                                                        sx={{ bgcolor: cfg.bg, color: cfg.color, fontWeight: 600, borderRadius: 1, border: 'none', minWidth: 80 }} />
                                                    <Chip
                                                        label={`${DOMAIN_ICONS[finding.domain as FindingDomain]} ${finding.domain}`}
                                                        size="small"
                                                        sx={{ bgcolor: '#F3F4F6', color: '#6B7280', fontSize: '0.6875rem', borderRadius: 1, textTransform: 'capitalize' }}
                                                    />
                                                    <Typography variant="body2" fontWeight={600} sx={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>{finding.field}</Typography>
                                                    <Typography variant="body2" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>— {finding.message}</Typography>
                                                </Box>
                                            </AccordionSummary>
                                            <AccordionDetails sx={{ px: 2.5, pt: 0 }}>
                                                <Divider sx={{ mb: 2 }} />
                                                <Typography variant="body2" color="text.secondary" gutterBottom>{finding.message}</Typography>
                                                <Box sx={{ mt: 2, p: 2, bgcolor: '#F0FDF4', borderRadius: 1, border: '1px solid #BBF7D0' }}>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                                        <Shield sx={{ fontSize: 14, color: '#059669' }} />
                                                        <Typography variant="overline" sx={{ color: '#059669' }}>Remediation</Typography>
                                                    </Box>
                                                    <Typography variant="body2" color="#1A1D23">{finding.remediation}</Typography>
                                                </Box>
                                            </AccordionDetails>
                                        </Accordion>
                                    );
                                })}
                            </Box>
                        </CardContent>
                    </Card>
                </>
            )}
        </PageShell>
    );
};

export default Validation;
