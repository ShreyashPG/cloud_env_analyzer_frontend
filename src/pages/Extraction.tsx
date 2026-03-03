import React, { useCallback, useState } from 'react';
import {
    Box, Card, CardContent, Typography, Button, LinearProgress,
    Chip, Alert, Breadcrumbs, Divider,
    Table, TableBody, TableCell, TableHead, TableRow,
    Accordion, AccordionSummary, AccordionDetails,
} from '@mui/material';
import {
    NavigateNext, UploadFile, CheckCircle, ErrorOutline,
    ExpandMore, HourglassEmpty, RateReview, TravelExplore,
} from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';
import { useSnackbar } from 'notistack';
import { useNavigate } from 'react-router-dom';
import PageShell from '../components/layout/PageShell';
import { uploadDocument } from '../api/extraction';
import { pollJobUntilDone } from '../api/jobs';
import { listReviewItems, resolveReviewItem } from '../api/validation';
import { useExtractionStore } from '../store/extractionStore';
import { useReviewStore } from '../store/reviewStore';
import type { Prerequisite, ReviewItem } from '../api/types';

const SEVERITY_COLOR: Record<string, string> = {
    critical: '#EF4444', high: '#F59E0B', medium: '#2563EB', low: '#10B981',
};
const SEVERITY_BG: Record<string, string> = {
    critical: '#FEF2F2', high: '#FFFBEB', medium: '#EFF6FF', low: '#ECFDF5',
};
const INTENT_LABEL: Record<string, string> = {
    must_exist_before: 'Must exist',
    will_be_created: 'Will be created',
    must_not_exist: 'Must not exist',
    optional: 'Optional',
};

// ─── Upload Drop Zone ──────────────────────────────────────────────────────────
const UploadZone: React.FC = () => {
    const { enqueueSnackbar } = useSnackbar();
    const { setPhase, setDocumentId, setJobId, setFilename, setProgress, setResults, setError } = useExtractionStore();

    const fetchPrereqs = async (docId: string) => {
        const { getPrerequisites } = await import('../api/extraction');
        return getPrerequisites(docId);
    };

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        const file = acceptedFiles[0];
        if (!file) return;

        const ext = file.name.split('.').pop()?.toLowerCase();
        if (!['pdf', 'docx'].includes(ext ?? '')) {
            enqueueSnackbar('Only PDF and DOCX files are supported.', { variant: 'warning' });
            return;
        }
        if (file.size > 50 * 1024 * 1024) {
            enqueueSnackbar('File is too large. Maximum size is 50 MB.', { variant: 'warning' });
            return;
        }

        setFilename(file.name);
        setPhase('uploading');
        setError(null);

        try {
            const uploadRes = await uploadDocument(file);
            setDocumentId(uploadRes.document_id);
            setJobId(uploadRes.job_id);
            setPhase('extracting');

            await pollJobUntilDone(
                uploadRes.job_id,
                (job) => {
                    setProgress(job.progress_pct, job.current_step);
                },
                2000,
                300_000
            );

            // Fetch prerequisites from the backend
            const prereqs = await fetchPrereqs(uploadRes.document_id);
            setResults(prereqs.approved, prereqs.pending_review, prereqs.total);
            setPhase('done');
            enqueueSnackbar(
                `Extracted ${prereqs.total} prerequisites (${prereqs.pending_review.length} need review).`,
                { variant: 'success' }
            );
        } catch (err: any) {
            setPhase('failed');
            setError(err.message ?? 'Extraction failed');
            enqueueSnackbar(err.message ?? 'Extraction failed', { variant: 'error' });
        }
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        multiple: false,
        accept: {
            'application/pdf': ['.pdf'],
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
        },
    });

    return (
        <Box
            {...getRootProps()}
            sx={{
                border: '2px dashed',
                borderColor: isDragActive ? 'primary.main' : '#D1D5DB',
                borderRadius: 3,
                p: { xs: 4, md: 8 },
                textAlign: 'center',
                cursor: 'pointer',
                background: isDragActive ? '#EFF6FF' : '#FAFAFA',
                transition: 'all 200ms',
                '&:hover': { borderColor: 'primary.main', background: '#F0F7FF' },
            }}
        >
            <input {...getInputProps()} />
            <UploadFile sx={{ fontSize: 48, color: isDragActive ? 'primary.main' : '#9CA3AF', mb: 2 }} />
            <Typography variant="h6" fontWeight={600} mb={0.5}>
                {isDragActive ? 'Drop your file here' : 'Drag & drop your prerequisites document'}
            </Typography>
            <Typography variant="body2" color="text.secondary" mb={3}>
                Supports PDF and DOCX files up to 50 MB
            </Typography>
            <Button variant="contained" component="span">Browse Files</Button>
        </Box>
    );
};

// ─── Progress Card ─────────────────────────────────────────────────────────────
const ProgressCard: React.FC = () => {
    const { phase, progress, currentStep, filename } = useExtractionStore();
    const isUploading = phase === 'uploading';

    return (
        <Card>
            <CardContent sx={{ p: 3.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                    <HourglassEmpty sx={{ color: 'primary.main', animation: 'spin 2s linear infinite', '@keyframes spin': { '100%': { transform: 'rotate(360deg)' } } }} />
                    <Typography variant="h5">
                        {isUploading ? `Uploading ${filename ?? 'file'}…` : 'Extracting prerequisites…'}
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
                    <Typography variant="body2" color="text.secondary">
                        {currentStep || (isUploading ? 'Uploading file…' : 'Parsing document…')}
                    </Typography>
                    <Typography variant="body2" fontWeight={700} color="primary.main">
                        {progress}%
                    </Typography>
                </Box>
                <LinearProgress
                    variant="determinate"
                    value={progress}
                    sx={{ height: 8, borderRadius: 99, '& .MuiLinearProgress-bar': { borderRadius: 99 } }}
                />
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                    Please keep this page open. Extraction may take 1–3 minutes for large documents.
                </Typography>
            </CardContent>
        </Card>
    );
};

// ─── Prerequisite Card ─────────────────────────────────────────────────────────
const PrerequisiteCard: React.FC<{ prereq: Prerequisite; showReviewBadge?: boolean }> = ({ prereq, showReviewBadge }) => {
    const sColor = SEVERITY_COLOR[prereq.severity] ?? '#6B7280';
    const sBg = SEVERITY_BG[prereq.severity] ?? '#F3F4F6';

    return (
        <Accordion elevation={0} sx={{ border: '1px solid #F3F4F6', borderRadius: '8px !important', mb: 1, '&:before': { display: 'none' } }}>
            <AccordionSummary expandIcon={<ExpandMore />} sx={{ px: 2.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1, flexWrap: 'wrap', pr: 1 }}>
                    <Chip
                        label={prereq.severity}
                        size="small"
                        sx={{ bgcolor: sBg, color: sColor, fontWeight: 700, borderRadius: 1, fontSize: '0.6875rem', textTransform: 'uppercase' }}
                    />
                    <Chip
                        label={prereq.resource_type.replace(/_/g, ' ')}
                        size="small"
                        sx={{ bgcolor: '#F3F4F6', color: '#374151', fontSize: '0.6875rem', borderRadius: 1, textTransform: 'capitalize' }}
                    />
                    <Chip
                        label={INTENT_LABEL[prereq.intent] ?? prereq.intent}
                        size="small"
                        variant="outlined"
                        sx={{ fontSize: '0.6875rem', borderRadius: 1 }}
                    />
                    {showReviewBadge && (
                        <Chip label="Needs Review" size="small" color="warning" sx={{ fontSize: '0.6875rem', borderRadius: 1 }} />
                    )}
                    <Typography variant="body2" color="text.secondary" sx={{ flex: 1, display: { xs: 'none', sm: 'block' } }}>
                        — {prereq.conditions.length} condition{prereq.conditions.length !== 1 ? 's' : ''}
                    </Typography>
                    <Chip
                        label={`${Math.round(prereq.confidence * 100)}% confidence`}
                        size="small"
                        sx={{
                            bgcolor: prereq.confidence >= 0.9 ? '#D1FAE5' : prereq.confidence >= 0.75 ? '#FEF3C7' : '#FEF2F2',
                            color: prereq.confidence >= 0.9 ? '#065F46' : prereq.confidence >= 0.75 ? '#92400E' : '#991B1B',
                            fontSize: '0.6875rem', borderRadius: 1,
                        }}
                    />
                </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ px: 2.5, pt: 0 }}>
                <Divider sx={{ mb: 2 }} />
                <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" mb={1}>
                    SOURCE TEXT
                </Typography>
                <Typography variant="body2" sx={{ fontStyle: 'italic', color: '#4B5563', mb: 2, p: 1.5, bgcolor: '#F9FAFB', borderRadius: 1, borderLeft: '3px solid #D1D5DB' }}>
                    "{prereq.source_text}"
                </Typography>
                <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" mb={1}>
                    CONDITIONS
                </Typography>
                <Table size="small" sx={{ mb: 1 }}>
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{ fontWeight: 700, fontSize: '0.6875rem' }}>Attribute</TableCell>
                            <TableCell sx={{ fontWeight: 700, fontSize: '0.6875rem' }}>Operator</TableCell>
                            <TableCell sx={{ fontWeight: 700, fontSize: '0.6875rem' }}>Expected Value</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {prereq.conditions.map((c, i) => (
                            <TableRow key={i}>
                                <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>{c.attribute}</TableCell>
                                <TableCell>
                                    <Chip label={c.operator} size="small" sx={{ bgcolor: '#EFF6FF', color: '#1D4ED8', fontWeight: 600, borderRadius: 1, fontSize: '0.6875rem' }} />
                                </TableCell>
                                <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>
                                    {c.expected_value === null ? <em style={{ color: '#9CA3AF' }}>exists</em> : String(c.expected_value)}
                                    {c.unit ? <Typography component="span" variant="caption" color="text.secondary"> {c.unit}</Typography> : null}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                {prereq.review_reason && (
                    <Alert severity="warning" sx={{ mt: 1, fontSize: '0.8125rem' }}>
                        <strong>Review note:</strong> {prereq.review_reason}
                    </Alert>
                )}
            </AccordionDetails>
        </Accordion>
    );
};

// ─── Review Queue ──────────────────────────────────────────────────────────────
const ReviewQueue: React.FC = () => {
    const { pendingReview, approveItem } = useExtractionStore();
    const { enqueueSnackbar } = useSnackbar();
    const [resolving, setResolving] = useState<string | null>(null);
    const { items: reviewItems, setItems, setIsLoading } = useReviewStore();

    React.useEffect(() => {
        // Load review items from backend
        const load = async () => {
            setIsLoading(true);
            try {
                const items = await listReviewItems();
                setItems(items);
            } catch {
                // fall through — use local pendingReview list
            } finally {
                setIsLoading(false);
            }
        };
        load();
    }, []);

    const handleApprove = async (item: ReviewItem) => {
        setResolving(item.id);
        try {
            await resolveReviewItem(item.id, 'approved');
            approveItem(item.prerequisite_id);
            enqueueSnackbar('Prerequisite approved and added to scan scope.', { variant: 'success' });
        } catch (err: any) {
            enqueueSnackbar(err.message ?? 'Failed to approve', { variant: 'error' });
        } finally {
            setResolving(null);
        }
    };

    const handleReject = async (item: ReviewItem) => {
        setResolving(item.id);
        try {
            await resolveReviewItem(item.id, 'rejected', 'Rejected by user — not applicable');
            enqueueSnackbar('Prerequisite excluded from scan scope.', { variant: 'info' });
        } catch (err: any) {
            enqueueSnackbar(err.message ?? 'Failed to reject', { variant: 'error' });
        } finally {
            setResolving(null);
        }
    };

    if (pendingReview.length === 0 && reviewItems.length === 0) {
        return (
            <Alert severity="success" icon={<CheckCircle />} sx={{ mt: 2 }}>
                No prerequisites require review — all {useExtractionStore.getState().approved.length} items are approved.
            </Alert>
        );
    }

    const displayItems: ReviewItem[] = reviewItems.length > 0
        ? reviewItems.filter((i) => !i.resolved)
        : pendingReview.map((p) => ({
            id: `local-${p.id}`,
            prerequisite_id: p.id,
            reason: p.review_reason ?? 'Flagged for review',
            resolved: false,
            created_at: '',
            prerequisite: p,
        }));

    return (
        <Box>
            {displayItems.map((item) => (
                <Card key={item.id} sx={{ mb: 2, border: '1px solid #FDE68A', bgcolor: '#FFFBEB' }}>
                    <CardContent sx={{ p: 2.5 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
                            <Box>
                                <Typography variant="body2" fontWeight={700} mb={0.25}>
                                    {item.prerequisite?.resource_type?.replace(/_/g, ' ') ?? 'Unknown Resource'}
                                </Typography>
                                <Typography variant="caption" color="warning.main">
                                    ⚠ {item.reason}
                                </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', gap: 1 }}>
                                <Button
                                    size="small"
                                    variant="outlined"
                                    color="error"
                                    disabled={resolving === item.id}
                                    onClick={() => handleReject(item)}
                                    sx={{ fontSize: '0.75rem' }}
                                >
                                    Exclude
                                </Button>
                                <Button
                                    size="small"
                                    variant="contained"
                                    color="success"
                                    disabled={resolving === item.id}
                                    onClick={() => handleApprove(item)}
                                    sx={{ fontSize: '0.75rem' }}
                                >
                                    {resolving === item.id ? 'Saving…' : 'Approve'}
                                </Button>
                            </Box>
                        </Box>
                        {item.prerequisite && (
                            <PrerequisiteCard prereq={item.prerequisite} />
                        )}
                    </CardContent>
                </Card>
            ))}
        </Box>
    );
};

// ─── Results Panel ─────────────────────────────────────────────────────────────
const ResultsPanel: React.FC = () => {
    const { approved, pendingReview, total, documentId, reset } = useExtractionStore();
    const navigate = useNavigate();

    const canScan = approved.length > 0;

    return (
        <Box>
            {/* Summary chips */}
            <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
                <Chip icon={<CheckCircle sx={{ fontSize: '14px !important' }} />} label={`${approved.length} Approved`} color="success" sx={{ fontWeight: 600 }} />
                {pendingReview.length > 0 && (
                    <Chip icon={<RateReview sx={{ fontSize: '14px !important' }} />} label={`${pendingReview.length} Need Review`} color="warning" sx={{ fontWeight: 600 }} />
                )}
                <Chip label={`${total} Total`} variant="outlined" sx={{ fontWeight: 600 }} />
            </Box>

            {/* Review queue */}
            {pendingReview.length > 0 && (
                <Box sx={{ mb: 3 }}>
                    <Typography variant="h6" mb={1.5} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <RateReview sx={{ color: 'warning.main', fontSize: 20 }} />
                        Items Needing Review ({pendingReview.length})
                    </Typography>
                    <ReviewQueue />
                </Box>
            )}

            {/* Approved prerequisites */}
            {approved.length > 0 && (
                <Box sx={{ mb: 3 }}>
                    <Typography variant="h6" mb={1.5} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CheckCircle sx={{ color: 'success.main', fontSize: 20 }} />
                        Approved Prerequisites ({approved.length})
                    </Typography>
                    {approved.map((p) => (
                        <PrerequisiteCard key={p.id} prereq={p} />
                    ))}
                </Box>
            )}

            {/* Action buttons */}
            <Box sx={{ display: 'flex', gap: 2, mt: 3, flexWrap: 'wrap' }}>
                <Button
                    variant="contained"
                    size="large"
                    startIcon={<TravelExplore />}
                    disabled={!canScan}
                    onClick={() => navigate('/scan', { state: { documentId } })}
                >
                    Run Azure Scan
                </Button>
                <Button variant="outlined" onClick={reset} sx={{ borderColor: '#D1D5DB', color: 'text.secondary' }}>
                    Upload New Document
                </Button>
            </Box>
            {!canScan && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                    Approve at least one prerequisite before running a scan.
                </Typography>
            )}
        </Box>
    );
};

// ─── Main Page ─────────────────────────────────────────────────────────────────
const Extraction: React.FC = () => {
    const { phase, error, reset } = useExtractionStore();

    const phaseLabel: Record<string, string> = {
        idle: 'Upload Prerequisites',
        uploading: 'Uploading…',
        extracting: 'Extracting Fields',
        done: 'Review & Approve',
        failed: 'Extraction Failed',
    };

    return (
        <PageShell>
            <Breadcrumbs separator={<NavigateNext fontSize="small" sx={{ color: '#9CA3AF' }} />} sx={{ mb: 1 }}>
                <Typography component="a" href="/" sx={{ fontSize: '0.8125rem', color: 'text.secondary', textDecoration: 'none' }}>Dashboard</Typography>
                <Typography sx={{ fontSize: '0.8125rem', color: 'text.primary', fontWeight: 500 }}>{phaseLabel[phase]}</Typography>
            </Breadcrumbs>

            <Box sx={{ mb: 4 }}>
                <Typography variant="h1" sx={{ fontSize: { xs: '1.375rem', md: '1.75rem' }, fontWeight: 600, mb: 0.5 }}>
                    {phaseLabel[phase]}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    Upload a PDF or DOCX prerequisites document. AI Assist will extract all infra requirements and prepare them for Azure scanning.
                </Typography>
            </Box>

            {phase === 'idle' && <UploadZone />}
            {(phase === 'uploading' || phase === 'extracting') && <ProgressCard />}
            {phase === 'failed' && (
                <Box>
                    <Alert severity="error" icon={<ErrorOutline />} sx={{ mb: 2 }}>
                        <strong>Extraction failed:</strong> {error ?? 'Unknown error'}. Please check your document format and try again.
                    </Alert>
                    <Button variant="outlined" onClick={reset}>Try Again</Button>
                </Box>
            )}
            {phase === 'done' && <ResultsPanel />}
        </PageShell>
    );
};

export default Extraction;
