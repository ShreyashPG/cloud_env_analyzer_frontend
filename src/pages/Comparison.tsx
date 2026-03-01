import React, { useState, useMemo } from 'react';
import {
    Box, Card, CardContent, Typography, Button, Breadcrumbs,
    Chip, Divider, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, Tabs, Tab, Alert,
    Accordion, AccordionSummary, AccordionDetails, Select,
    MenuItem, FormControl, InputLabel, Badge,
} from '@mui/material';
import {
    NavigateNext, CheckCircle, Cancel, WarningAmber, Download,
    CompareArrows, ExpandMore, ErrorOutline,
    TravelExplore, Description, PictureAsPdf,
} from '@mui/icons-material';
import PageShell from '../components/layout/PageShell';
import { useExtractionStore } from '../store/extractionStore';
import { useScanStore } from '../store/scanStore';
import { GAP_CATEGORIES } from '../lib/constants';
import type { GapItem, GapCategory, GapSeverity } from '../api/types';

// ── Helpers ─────────────────────────────────────────────────────────────

type MatchStatus = 'match' | 'mismatch' | 'missing';

interface FieldComparison {
    field: string;
    prereqValue: string;
    scanValue: string | null;
    status: MatchStatus;
}

function buildComparison(
    prereqData: Record<string, unknown>,
    scanData: Record<string, unknown>,
): FieldComparison[] {
    return Object.entries(prereqData).map(([field, prereqValue]) => {
        const scanValue = scanData[field];
        let status: MatchStatus;
        if (scanValue === undefined || scanValue === null) status = 'missing';
        else if (String(scanValue) === String(prereqValue)) status = 'match';
        else status = 'mismatch';
        return { field, prereqValue: String(prereqValue), scanValue: scanValue != null ? String(scanValue) : null, status };
    });
}

function buildGaps(
    comparisons: FieldComparison[],
    scanPermissions: string[],
    scanRoles: string[],
    scanNetworkRules: Array<{ port: number; cidr: string; direction: string; allowed: boolean }>,
): GapItem[] {
    const gaps: GapItem[] = [];
    let gapId = 1;

    // Field gaps
    comparisons.filter(c => c.status === 'missing').forEach(c => {
        gaps.push({
            id: `gap-${gapId++}`,
            category: 'field_missing',
            field: c.field,
            prereqValue: c.prereqValue,
            scanValue: null,
            severity: 'blocker',
            description: `Field "${c.field}" required in prerequisites (value: ${c.prereqValue}) is not present in the live scan results.`,
            remediation: `Configure ${c.field} in the cloud environment and ensure the scanning role has read access to retrieve it.`,
        });
    });

    comparisons.filter(c => c.status === 'mismatch').forEach(c => {
        gaps.push({
            id: `gap-${gapId++}`,
            category: 'value_mismatch',
            field: c.field,
            prereqValue: c.prereqValue,
            scanValue: c.scanValue,
            severity: 'warning',
            description: `Value for "${c.field}" differs: expected "${c.prereqValue}" but found "${c.scanValue}".`,
            remediation: `Update the cloud environment value for ${c.field} to match the required value, or update the prerequisites document.`,
        });
    });

    // Required permissions not found
    const requiredPermissions = ['eks:DescribeCluster', 'eks:ListNodegroups', 'sts:AssumeRole', 'ecr:GetAuthorizationToken', 'logs:CreateLogGroup'];
    requiredPermissions.filter(p => !scanPermissions.includes(p)).forEach(perm => {
        gaps.push({
            id: `gap-${gapId++}`,
            category: 'permission',
            field: perm,
            prereqValue: perm,
            scanValue: null,
            severity: 'blocker',
            description: `Required IAM permission "${perm}" is not present in the scanned environment.`,
            remediation: `Attach a policy that includes "${perm}" to the deployment role.`,
        });
    });

    // Required roles
    const requiredRoles = ['AmazonEKSClusterPolicy', 'AmazonEKSWorkerNodePolicy', 'AmazonEKSVPCResourceController'];
    requiredRoles.filter(r => !scanRoles.includes(r)).forEach(role => {
        gaps.push({
            id: `gap-${gapId++}`,
            category: 'role',
            field: role,
            prereqValue: role,
            scanValue: null,
            severity: 'blocker',
            description: `Required IAM role policy "${role}" is not attached to any role in the scanned environment.`,
            remediation: `Attach "${role}" to the EKS worker node role (e.g. AIAssistDeployRole).`,
        });
    });

    // Network rules
    const blockedInboundPorts = scanNetworkRules.filter(r => r.direction === 'inbound' && !r.allowed);
    blockedInboundPorts.forEach(rule => {
        gaps.push({
            id: `gap-${gapId++}`,
            category: 'network_rule',
            field: `Port ${rule.port} inbound from ${rule.cidr}`,
            prereqValue: `TCP ${rule.port} from ${rule.cidr} ALLOWED`,
            scanValue: `TCP ${rule.port} from ${rule.cidr} BLOCKED`,
            severity: 'blocker',
            description: `Inbound port ${rule.port} from ${rule.cidr} is blocked in the security group, but required by AI Assist.`,
            remediation: `Add an inbound rule allowing TCP port ${rule.port} from ${rule.cidr} in the target security group.`,
        });
    });

    return gaps;
}

// Report generators
function downloadJSON(gaps: GapItem[], metadata: Record<string, string>) {
    const report = {
        generatedAt: new Date().toISOString(),
        ...metadata,
        summary: {
            total: gaps.length,
            blockers: gaps.filter(g => g.severity === 'blocker').length,
            warnings: gaps.filter(g => g.severity === 'warning').length,
        },
        categories: {
            permissions: gaps.filter(g => g.category === 'permission'),
            roles: gaps.filter(g => g.category === 'role'),
            networkRules: gaps.filter(g => g.category === 'network_rule'),
            missingFields: gaps.filter(g => g.category === 'field_missing'),
            valueMismatches: gaps.filter(g => g.category === 'value_mismatch'),
        },
        gaps,
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = `gap-report-${Date.now()}.json`; a.click(); URL.revokeObjectURL(url);
}

function downloadTextReport(gaps: GapItem[], metadata: Record<string, string>) {
    const blockers = gaps.filter(g => g.severity === 'blocker');
    const warnings = gaps.filter(g => g.severity === 'warning');
    const lines: string[] = [
        '=========================================',
        ' Cloud Environment Gap Analysis Report',
        '=========================================',
        `Generated:   ${new Date().toLocaleString()}`,
        `Provider:    ${metadata.provider ?? '—'}`,
        `Environment: ${metadata.environment ?? '—'}`,
        `Document:    ${metadata.document ?? '—'}`,
        '',
        `SUMMARY: ${gaps.length} total gaps — ${blockers.length} blockers, ${warnings.length} warnings`,
        '',
        '─── BLOCKERS (must be resolved before deployment) ──────────',
        ...blockers.map((g, i) => [
            `${i + 1}. [${g.category.toUpperCase()}] ${g.field}`,
            `   Required:    ${g.prereqValue}`,
            `   Found:       ${g.scanValue ?? 'NOT FOUND'}`,
            `   Issue:       ${g.description}`,
            `   Remediation: ${g.remediation}`,
            '',
        ].join('\n')),
        '─── WARNINGS ───────────────────────────────────────────────',
        ...warnings.map((g, i) => [
            `${i + 1}. [${g.category.toUpperCase()}] ${g.field}`,
            `   Required:    ${g.prereqValue}`,
            `   Found:       ${g.scanValue ?? 'NOT FOUND'}`,
            `   Issue:       ${g.description}`,
            `   Remediation: ${g.remediation}`,
            '',
        ].join('\n')),
        '=========================================',
        ' End of Report',
        '=========================================',
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = `gap-report-${Date.now()}.txt`; a.click(); URL.revokeObjectURL(url);
}

// ── MOCK scan result (when no real scan in store) ──────────────────────
const MOCK_SCAN_DATA: Record<string, unknown> = {
    region: 'us-east-1',
    accountId: '123456789012',
    vpcId: 'vpc-0abc123def456789',
    subnetId: 'subnet-0abc123def456789',
    securityGroupId: 'sg-0abc123def456789',
    iamRoleArn: 'arn:aws:iam::123456789012:role/AIAssistDeployRole',
    s3BucketName: 'aiassist-production-data',
    eksClusterName: 'aiassist-eks-prod',
    rdsEndpoint: 'aiassist-db.cluster-xyz.us-east-1.rds.amazonaws.com',
    kmsKeyId: 'arn:aws:kms:us-east-1:123456789012:key/abc123-def456',
    // snsTopicArn and cloudwatchLogGroupName intentionally missing for demo
};
const MOCK_SCAN_PERMISSIONS = ['s3:GetObject', 's3:PutObject', 's3:ListBucket', 'ec2:DescribeVpcs', 'ec2:DescribeSubnets', 'logs:CreateLogGroup', 'logs:PutLogEvents'];
const MOCK_SCAN_ROLES = ['AIAssistDeployRole', 'AmazonEKSWorkerNodePolicy'];
const MOCK_SCAN_NETWORK_RULES = [
    { port: 443, cidr: '0.0.0.0/0', direction: 'outbound', allowed: true },
    { port: 443, cidr: '10.0.0.0/8', direction: 'inbound', allowed: false },
    { port: 22, cidr: '10.0.0.0/8', direction: 'inbound', allowed: false },
];

// ── Severity badges ──────────────────────────────────────────────────────
const SeverityBadge: React.FC<{ severity: GapSeverity }> = ({ severity }) => (
    <Chip size="small" label={severity === 'blocker' ? 'Blocker' : 'Warning'}
        icon={severity === 'blocker' ? <ErrorOutline sx={{ fontSize: '14px !important' }} /> : <WarningAmber sx={{ fontSize: '14px !important' }} />}
        sx={{ bgcolor: severity === 'blocker' ? '#FEF2F2' : '#FFFBEB', color: severity === 'blocker' ? '#EF4444' : '#D97706', borderRadius: 99, fontWeight: 700, fontSize: '0.75rem' }} />
);

const CategoryBadge: React.FC<{ category: GapCategory }> = ({ category }) => {
    const cfg = GAP_CATEGORIES.find(c => c.id === category);
    return <Chip size="small" label={cfg?.label ?? category} sx={{ bgcolor: '#F3F4F6', color: '#374151', fontWeight: 600, fontSize: '0.6875rem', borderRadius: 99 }} />;
};

// ── Status cell in field comparison table ────────────────────────────────
const StatusChip: React.FC<{ status: MatchStatus }> = ({ status }) => {
    const cfg = {
        match: { label: 'Match', color: '#065F46', bg: '#D1FAE5', icon: <CheckCircle sx={{ fontSize: '14px !important' }} /> },
        mismatch: { label: 'Mismatch', color: '#D97706', bg: '#FEF3C7', icon: <WarningAmber sx={{ fontSize: '14px !important' }} /> },
        missing: { label: 'Missing', color: '#EF4444', bg: '#FEF2F2', icon: <Cancel sx={{ fontSize: '14px !important' }} /> },
    }[status];
    return <Chip size="small" icon={cfg.icon} label={cfg.label} sx={{ bgcolor: cfg.bg, color: cfg.color, fontWeight: 700, borderRadius: 99, fontSize: '0.75rem' }} />;
};

type ComparisonState = 'idle' | 'running' | 'done';

const COMPARISON_STEPS = [
    { label: 'Loading Sources', desc: 'Reading prerequisites document and scan results…' },
    { label: 'Comparing Fields', desc: 'Matching extracted fields against live scan data…' },
    { label: 'Analyzing Gaps', desc: 'Identifying missing permissions, roles, and rules…' },
    { label: 'Generating Report', desc: 'Compiling gap analysis and remediation steps…' },
];

// ── MAIN COMPARISON PAGE ─────────────────────────────────────────────────
const Comparison: React.FC = () => {
    const { prereqExtraction } = useExtractionStore();
    const { scanResult, scans } = useScanStore();
    const [compState, setCompState] = useState<ComparisonState>('idle');
    const [runProgress, setRunProgress] = useState(0);
    const [runStep, setRunStep] = useState(0);
    const [tab, setTab] = useState(0);
    const [catFilter, setCatFilter] = useState<GapCategory | 'all'>('all');
    const [sevFilter, setSevFilter] = useState<GapSeverity | 'all'>('all');

    const prereqData = useMemo(() => {
        if (prereqExtraction?.data) return prereqExtraction.data as Record<string, unknown>;
        return MOCK_SCAN_DATA;
    }, [prereqExtraction]);

    const scanData = useMemo(() => scanResult?.data ?? MOCK_SCAN_DATA, [scanResult]);
    const scanPermissions = scanResult?.permissions ?? MOCK_SCAN_PERMISSIONS;
    const scanRoles = scanResult?.roles ?? MOCK_SCAN_ROLES;
    const scanNetworkRules = scanResult?.networkRules ?? (MOCK_SCAN_NETWORK_RULES as typeof MOCK_SCAN_NETWORK_RULES);

    // Only computed after the user triggers comparison
    const [comparisons, setComparisons] = useState<ReturnType<typeof buildComparison>>([]);
    const [gaps, setGaps] = useState<GapItem[]>([]);

    const filteredGaps = gaps
        .filter(g => catFilter === 'all' || g.category === catFilter)
        .filter(g => sevFilter === 'all' || g.severity === sevFilter);

    const matchCount = comparisons.filter(c => c.status === 'match').length;
    const mismatchCount = comparisons.filter(c => c.status === 'mismatch').length;
    const missingCount = comparisons.filter(c => c.status === 'missing').length;
    const blockerCount = gaps.filter(g => g.severity === 'blocker').length;
    const warningCount = gaps.filter(g => g.severity === 'warning').length;
    const deployReady = blockerCount === 0 && compState === 'done';

    const latestScan = scans[0];
    const metadata = {
        provider: latestScan?.provider ?? prereqExtraction?.provider ?? 'aws',
        environment: latestScan?.environment ?? 'production',
        document: prereqExtraction?.filename ?? 'AI-Assist-Prerequisites.pdf',
    };

    // ── Run comparison flow ──────────────────────────────────────────────
    const handleRunComparison = async () => {
        setCompState('running');
        setRunProgress(0);
        setRunStep(0);

        for (let step = 0; step < COMPARISON_STEPS.length; step++) {
            setRunStep(step);
            // Animate progress within each step
            const baseProgress = (step / COMPARISON_STEPS.length) * 100;
            const nextBase = ((step + 1) / COMPARISON_STEPS.length) * 100;
            for (let p = baseProgress; p < nextBase; p += 2) {
                await new Promise(r => setTimeout(r, 40));
                setRunProgress(Math.min(p, 99));
            }
        }

        // Compute results
        const c = buildComparison(prereqData, scanData);
        const g = buildGaps(c, scanPermissions, scanRoles, scanNetworkRules);
        setComparisons(c);
        setGaps(g);
        setRunProgress(100);
        await new Promise(r => setTimeout(r, 400));
        setCompState('done');
    };

    // ── Page header — always shown ───────────────────────────────────────
    const header = (
        <>
            <Breadcrumbs separator={<NavigateNext fontSize="small" sx={{ color: '#9CA3AF' }} />} sx={{ mb: 1 }}>
                <Typography component="a" href="/" sx={{ fontSize: '0.8125rem', color: 'text.secondary', textDecoration: 'none' }}>Dashboard</Typography>
                <Typography sx={{ fontSize: '0.8125rem', color: 'text.primary', fontWeight: 500 }}>Comparison</Typography>
            </Breadcrumbs>
            <Box sx={{ mb: 3, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
                <Box>
                    <Typography variant="h1" sx={{ fontSize: { xs: '1.375rem', md: '1.75rem' }, fontWeight: 600, mb: 0.5 }}>Gap Analysis</Typography>
                    <Typography variant="body2" color="text.secondary">Compare the extracted prerequisites against live scan results to identify deployment gaps</Typography>
                </Box>
                {compState === 'done' && (
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button variant="outlined" size="small" startIcon={<Download />} onClick={() => downloadJSON(gaps, metadata)} sx={{ borderColor: '#D1D5DB', color: 'text.primary', fontWeight: 500 }}>Download JSON</Button>
                        <Button variant="contained" size="small" startIcon={<PictureAsPdf sx={{ fontSize: 16 }} />} onClick={() => downloadTextReport(gaps, metadata)}>Download Report</Button>
                        <Button variant="outlined" size="small" startIcon={<CompareArrows />} onClick={() => { setCompState('idle'); setComparisons([]); setGaps([]); }} sx={{ borderColor: '#D1D5DB', color: 'text.secondary' }}>Re-run</Button>
                    </Box>
                )}
            </Box>
        </>
    );

    // ── Source summary cards ─────────────────────────────────────────────
    const sourceCards = (
        <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap', alignItems: 'center' }}>
            <Card sx={{ flex: 1, minWidth: 240 }}>
                <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                        <Description sx={{ color: '#EF4444', fontSize: 20 }} />
                        <Typography variant="body2" fontWeight={600}>Prerequisites Document</Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        {prereqExtraction?.filename ?? 'AI-Assist-Prerequisites.pdf'}
                    </Typography>
                    <Chip label={`${Object.keys(prereqData).length} fields`} size="small" sx={{ mt: 1, bgcolor: '#EFF6FF', color: '#1D4ED8', fontWeight: 600, fontSize: '0.75rem' }} />
                </CardContent>
            </Card>
            <Box sx={{ display: 'flex', alignItems: 'center', color: '#9CA3AF' }}>
                <CompareArrows sx={{ fontSize: 28 }} />
            </Box>
            <Card sx={{ flex: 1, minWidth: 240 }}>
                <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                        <TravelExplore sx={{ color: '#10B981', fontSize: 20 }} />
                        <Typography variant="body2" fontWeight={600}>Live Scan Results</Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        {latestScan ? `${latestScan.provider.toUpperCase()} / ${latestScan.environment}` : 'Mock scan data'}
                    </Typography>
                    <Chip label={`${Object.keys(scanData).length} fields`} size="small" sx={{ mt: 1, bgcolor: '#F0FDF4', color: '#065F46', fontWeight: 600, fontSize: '0.75rem' }} />
                </CardContent>
            </Card>
        </Box>
    );

    // ══════════════════════════════════════════════════════════════════════
    // STATE: idle — show trigger screen
    // ══════════════════════════════════════════════════════════════════════
    if (compState === 'idle') {
        return (
            <PageShell>
                {header}

                {sourceCards}

                {/* What will be compared */}
                <Card sx={{ mb: 3 }}>
                    <CardContent sx={{ p: 3.5 }}>
                        <Typography variant="h5" sx={{ mb: 2 }}>What the comparison checks</Typography>
                        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                            {[
                                { icon: <CheckCircle sx={{ fontSize: 18, color: '#10B981' }} />, label: 'Field Values', desc: 'Match each field in the prerequisites against the live scan environment' },
                                { icon: <ErrorOutline sx={{ fontSize: 18, color: '#EF4444' }} />, label: 'IAM Permissions', desc: 'Verify all required IAM/service-account permissions are present' },
                                { icon: <ErrorOutline sx={{ fontSize: 18, color: '#EF4444' }} />, label: 'Roles & Policies', desc: 'Confirm required roles and managed policies are attached' },
                                { icon: <WarningAmber sx={{ fontSize: 18, color: '#F59E0B' }} />, label: 'Network Rules', desc: 'Check security group / firewall rules allow required traffic' },
                            ].map(item => (
                                <Box key={item.label} sx={{ flex: '1 1 200px', display: 'flex', gap: 1.5, alignItems: 'flex-start', p: 2, bgcolor: '#F8FAFF', borderRadius: 1.5, border: '1px solid #E4E7EC' }}>
                                    {item.icon}
                                    <Box>
                                        <Typography variant="body2" fontWeight={600} sx={{ mb: 0.25 }}>{item.label}</Typography>
                                        <Typography variant="caption" color="text.secondary">{item.desc}</Typography>
                                    </Box>
                                </Box>
                            ))}
                        </Box>
                    </CardContent>
                </Card>

                {/* Run button */}
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5, py: 2 }}>
                    <Button
                        variant="contained"
                        size="large"
                        startIcon={<CompareArrows />}
                        onClick={handleRunComparison}
                        sx={{ px: 5, py: 1.5, borderRadius: 2, fontSize: '1rem', fontWeight: 600, background: 'linear-gradient(135deg, #2563EB, #1D4ED8)', boxShadow: '0 4px 14px rgba(37,99,235,0.3)', '&:hover': { boxShadow: '0 6px 20px rgba(37,99,235,0.4)' } }}
                    >
                        Run Comparison
                    </Button>
                    <Typography variant="caption" color="text.secondary">
                        This will compare {Object.keys(prereqData).length} prerequisite fields against the scan results
                    </Typography>
                </Box>
            </PageShell>
        );
    }

    // ══════════════════════════════════════════════════════════════════════
    // STATE: running — show animated progress
    // ══════════════════════════════════════════════════════════════════════
    if (compState === 'running') {
        return (
            <PageShell>
                {header}
                <Box sx={{ display: 'flex', justifyContent: 'center', pt: 4 }}>
                    <Card sx={{ width: '100%', maxWidth: 560 }}>
                        <CardContent sx={{ p: 5 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
                                <Box sx={{
                                    width: 10, height: 10, borderRadius: '50%', bgcolor: '#2563EB', flexShrink: 0,
                                    animation: 'pulseRing 1.2s ease-in-out infinite',
                                    '@keyframes pulseRing': { '0%,100%': { opacity: 1, transform: 'scale(1)' }, '50%': { opacity: 0.5, transform: 'scale(1.5)' } }
                                }} />
                                <Typography variant="h6" fontWeight={600} color="primary.main">Analyzing…</Typography>
                            </Box>

                            {/* Step list */}
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 3.5 }}>
                                {COMPARISON_STEPS.map((step, idx) => {
                                    const done = idx < runStep;
                                    const active = idx === runStep;
                                    return (
                                        <Box key={step.label} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, opacity: done || active ? 1 : 0.35, transition: 'opacity 300ms' }}>
                                            <Box sx={{
                                                width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                                bgcolor: done ? '#D1FAE5' : active ? '#DBEAFE' : '#F3F4F6',
                                                border: `2px solid ${done ? '#10B981' : active ? '#2563EB' : '#E4E7EC'}`,
                                                transition: 'all 300ms',
                                            }}>
                                                {done
                                                    ? <CheckCircle sx={{ fontSize: 15, color: '#10B981' }} />
                                                    : <Typography variant="caption" sx={{ fontWeight: 700, color: active ? '#2563EB' : '#9CA3AF', fontSize: 11 }}>{idx + 1}</Typography>}
                                            </Box>
                                            <Box sx={{ flex: 1 }}>
                                                <Typography variant="body2" fontWeight={active || done ? 600 : 400} color={done ? '#065F46' : active ? 'primary.main' : 'text.secondary'}>{step.label}</Typography>
                                                {active && <Typography variant="caption" color="text.secondary">{step.desc}</Typography>}
                                            </Box>
                                        </Box>
                                    );
                                })}
                            </Box>

                            {/* Progress bar */}
                            <Box sx={{ mb: 1 }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
                                    <Typography variant="caption" color="text.secondary">{COMPARISON_STEPS[Math.min(runStep, 3)].label}</Typography>
                                    <Typography variant="caption" fontWeight={700} color="primary.main">{Math.round(runProgress)}%</Typography>
                                </Box>
                                <Box sx={{ height: 6, borderRadius: 99, bgcolor: '#E4E7EC', overflow: 'hidden' }}>
                                    <Box sx={{ height: '100%', borderRadius: 99, bgcolor: '#2563EB', width: `${runProgress}%`, transition: 'width 80ms linear', position: 'relative', overflow: 'hidden' }}>
                                        <Box sx={{
                                            position: 'absolute', top: 0, left: '-100%', width: '60%', height: '100%', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)',
                                            animation: 'shimmer 1.6s infinite ease-in-out',
                                            '@keyframes shimmer': { '0%': { left: '-100%' }, '100%': { left: '200%' } }
                                        }} />
                                    </Box>
                                </Box>
                            </Box>
                        </CardContent>
                    </Card>
                </Box>
            </PageShell>
        );
    }

    // ══════════════════════════════════════════════════════════════════════
    // STATE: done — show full results
    // ══════════════════════════════════════════════════════════════════════
    return (
        <PageShell>
            {header}

            {/* Readiness banner */}
            <Alert severity={deployReady ? 'success' : 'error'} icon={deployReady ? <CheckCircle /> : <ErrorOutline />}
                sx={{ mb: 3, borderRadius: 2, '& .MuiAlert-message': { fontWeight: 500 } }}>
                {deployReady
                    ? '✅ Environment is ready — all required fields, permissions, roles and network rules are present.'
                    : `🚫 Not ready for deployment — ${blockerCount} blocker${blockerCount > 1 ? 's' : ''} must be resolved before proceeding.`}
            </Alert>

            {/* KPI row */}
            <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
                {[
                    { label: 'Matched Fields', value: matchCount, color: '#10B981', icon: <CheckCircle sx={{ fontSize: 18, color: '#10B981' }} /> },
                    { label: 'Value Mismatches', value: mismatchCount, color: '#F59E0B', icon: <WarningAmber sx={{ fontSize: 18, color: '#F59E0B' }} /> },
                    { label: 'Missing Fields', value: missingCount, color: '#EF4444', icon: <Cancel sx={{ fontSize: 18, color: '#EF4444' }} /> },
                    { label: 'Total Gaps', value: gaps.length, color: '#6B7280', icon: <CompareArrows sx={{ fontSize: 18, color: '#6B7280' }} /> },
                    { label: 'Blockers', value: blockerCount, color: '#EF4444', icon: <ErrorOutline sx={{ fontSize: 18, color: '#EF4444' }} /> },
                    { label: 'Warnings', value: warningCount, color: '#F59E0B', icon: <WarningAmber sx={{ fontSize: 18, color: '#F59E0B' }} /> },
                ].map(({ label, value, color, icon }) => (
                    <Card key={label} sx={{ flex: '1 1 120px', minWidth: 100 }}>
                        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>{icon}<Typography variant="caption" color="text.secondary">{label}</Typography></Box>
                            <Typography variant="h4" fontWeight={700} sx={{ fontSize: '1.5rem', color }}>{value}</Typography>
                        </CardContent>
                    </Card>
                ))}
            </Box>

            {sourceCards}

            {/* Tabs */}
            <Box sx={{ borderBottom: '1px solid #F3F4F6', mb: 3 }}>
                <Tabs value={tab} onChange={(_, v) => setTab(v)}>
                    <Tab label={<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>Field Comparison <Chip label={comparisons.length} size="small" sx={{ ml: 0.5, height: 18, fontSize: '0.625rem', fontWeight: 700 }} /></Box>} sx={{ textTransform: 'none', fontSize: '0.875rem' }} />
                    <Tab label={<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>Gap Report <Badge badgeContent={gaps.length} color="error" sx={{ '& .MuiBadge-badge': { fontSize: '0.625rem', height: 16, minWidth: 16 } }}><Box sx={{ ml: 1 }} /></Badge></Box>} sx={{ textTransform: 'none', fontSize: '0.875rem' }} />
                </Tabs>
            </Box>

            {/* Tab 0: Field Comparison */}
            {tab === 0 && (
                <Card>
                    <CardContent sx={{ p: 0 }}>
                        <Box sx={{ px: 3, py: 2.5, borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Typography variant="h5">Field-by-Field Comparison</Typography>
                            <Chip label={`${matchCount} match`} size="small" sx={{ bgcolor: '#D1FAE5', color: '#065F46', fontWeight: 700, fontSize: '0.75rem' }} />
                            <Chip label={`${mismatchCount} mismatch`} size="small" sx={{ bgcolor: '#FEF3C7', color: '#D97706', fontWeight: 700, fontSize: '0.75rem' }} />
                            <Chip label={`${missingCount} missing`} size="small" sx={{ bgcolor: '#FEF2F2', color: '#EF4444', fontWeight: 700, fontSize: '0.75rem' }} />
                        </Box>
                        <TableContainer>
                            <Table>
                                <TableHead>
                                    <TableRow>
                                        <TableCell sx={{ fontWeight: 600, color: '#6B7280', fontSize: '0.75rem' }}>Field</TableCell>
                                        <TableCell sx={{ fontWeight: 600, color: '#6B7280', fontSize: '0.75rem' }}>Prerequisites Value</TableCell>
                                        <TableCell sx={{ fontWeight: 600, color: '#6B7280', fontSize: '0.75rem' }}>Scan Value</TableCell>
                                        <TableCell sx={{ fontWeight: 600, color: '#6B7280', fontSize: '0.75rem' }}>Status</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {comparisons.map(c => (
                                        <TableRow key={c.field} hover sx={{ bgcolor: c.status === 'missing' ? 'rgba(239,68,68,0.02)' : c.status === 'mismatch' ? 'rgba(245,158,11,0.02)' : 'inherit' }}>
                                            <TableCell><Typography variant="caption" sx={{ fontFamily: 'monospace', fontWeight: 600, color: '#374151', fontSize: '0.8125rem' }}>{c.field}</Typography></TableCell>
                                            <TableCell><Typography variant="caption" sx={{ fontFamily: 'monospace', color: '#1A1D23', fontSize: '0.8125rem' }}>{c.prereqValue}</Typography></TableCell>
                                            <TableCell>
                                                {c.scanValue
                                                    ? <Typography variant="caption" sx={{ fontFamily: 'monospace', color: c.status === 'mismatch' ? '#D97706' : '#065F46', fontSize: '0.8125rem' }}>{c.scanValue}</Typography>
                                                    : <Typography variant="caption" sx={{ color: '#9CA3AF', fontStyle: 'italic' }}>not found</Typography>}
                                            </TableCell>
                                            <TableCell><StatusChip status={c.status} /></TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </CardContent>
                </Card>
            )}

            {/* Tab 1: Gap Report */}
            {tab === 1 && (
                <Box>
                    <Box sx={{ display: 'flex', gap: 1.5, mb: 2.5, flexWrap: 'wrap' }}>
                        <FormControl size="small" sx={{ minWidth: 180 }}>
                            <InputLabel>Category</InputLabel>
                            <Select value={catFilter} label="Category" onChange={e => setCatFilter(e.target.value as any)}>
                                <MenuItem value="all">All Categories</MenuItem>
                                {GAP_CATEGORIES.map(c => <MenuItem key={c.id} value={c.id}>{c.label}</MenuItem>)}
                            </Select>
                        </FormControl>
                        <FormControl size="small" sx={{ minWidth: 140 }}>
                            <InputLabel>Severity</InputLabel>
                            <Select value={sevFilter} label="Severity" onChange={e => setSevFilter(e.target.value as any)}>
                                <MenuItem value="all">All</MenuItem>
                                <MenuItem value="blocker">Blockers</MenuItem>
                                <MenuItem value="warning">Warnings</MenuItem>
                            </Select>
                        </FormControl>
                        <Box sx={{ flex: 1, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                            <Button variant="outlined" size="small" startIcon={<Download sx={{ fontSize: 14 }} />} onClick={() => downloadJSON(gaps, metadata)} sx={{ borderColor: '#D1D5DB', color: 'text.secondary' }}>JSON</Button>
                            <Button variant="contained" size="small" startIcon={<PictureAsPdf sx={{ fontSize: 14 }} />} onClick={() => downloadTextReport(gaps, metadata)}>Report (.txt)</Button>
                        </Box>
                    </Box>

                    {filteredGaps.length === 0 ? (
                        <Card><CardContent sx={{ py: 6, textAlign: 'center', color: '#9CA3AF' }}>
                            <CheckCircle sx={{ fontSize: 36, mb: 1, color: '#10B981' }} />
                            <Typography>No gaps found for the selected filters.</Typography>
                        </CardContent></Card>
                    ) : (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                            {filteredGaps.map(gap => (
                                <Accordion key={gap.id} disableGutters sx={{ border: '1px solid', borderColor: gap.severity === 'blocker' ? '#FECACA' : '#FDE68A', borderRadius: '8px !important', boxShadow: 'none', '&:before': { display: 'none' } }}>
                                    <AccordionSummary expandIcon={<ExpandMore />} sx={{ px: 2.5, py: 0.5 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1, flexWrap: 'wrap' }}>
                                            <SeverityBadge severity={gap.severity} />
                                            <CategoryBadge category={gap.category} />
                                            <Typography variant="body2" fontWeight={600} sx={{ fontFamily: 'monospace' }}>{gap.field}</Typography>
                                        </Box>
                                    </AccordionSummary>
                                    <AccordionDetails sx={{ pt: 0, px: 2.5, pb: 2 }}>
                                        <Divider sx={{ mb: 2 }} />
                                        <Box sx={{ display: 'flex', gap: 4, mb: 2, flexWrap: 'wrap' }}>
                                            <Box sx={{ flex: 1, minWidth: 200 }}>
                                                <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ display: 'block', mb: 0.5 }}>REQUIRED (Prerequisites)</Typography>
                                                <Box sx={{ bgcolor: '#F8FAFF', border: '1px solid #DBEAFE', borderRadius: 1, px: 2, py: 1.25 }}>
                                                    <Typography variant="body2" sx={{ fontFamily: 'monospace', color: '#1D4ED8' }}>{gap.prereqValue}</Typography>
                                                </Box>
                                            </Box>
                                            <Box sx={{ flex: 1, minWidth: 200 }}>
                                                <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ display: 'block', mb: 0.5 }}>FOUND (Scan)</Typography>
                                                <Box sx={{ bgcolor: gap.scanValue ? '#FFFBEB' : '#FEF2F2', border: `1px solid ${gap.scanValue ? '#FDE68A' : '#FECACA'}`, borderRadius: 1, px: 2, py: 1.25 }}>
                                                    <Typography variant="body2" sx={{ fontFamily: 'monospace', color: gap.scanValue ? '#D97706' : '#EF4444', fontStyle: gap.scanValue ? 'normal' : 'italic' }}>
                                                        {gap.scanValue ?? 'NOT FOUND'}
                                                    </Typography>
                                                </Box>
                                            </Box>
                                        </Box>
                                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>{gap.description}</Typography>
                                        <Box sx={{ bgcolor: '#F0FDF4', borderLeft: '3px solid #10B981', px: 2, py: 1.25, borderRadius: 1 }}>
                                            <Typography variant="caption" color="#065F46" fontWeight={700} sx={{ display: 'block', mb: 0.25 }}>REMEDIATION</Typography>
                                            <Typography variant="body2" color="#065F46">{gap.remediation}</Typography>
                                        </Box>
                                    </AccordionDetails>
                                </Accordion>
                            ))}
                        </Box>
                    )}
                </Box>
            )}
        </PageShell>
    );
};

export default Comparison;

