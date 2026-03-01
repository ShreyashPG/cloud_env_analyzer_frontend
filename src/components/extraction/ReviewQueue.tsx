import React, { useState } from 'react';
import {
    Box, Card, CardContent, Typography, Button, Divider,
    Chip, IconButton, Tooltip, InputAdornment, TextField,
    Stepper, Step, StepLabel, Dialog, DialogTitle, DialogContent,
    DialogActions, Alert,
} from '@mui/material';
import { Grid } from '@mui/material';
import {
    CheckCircle, Refresh, UploadFile, ArrowForward,
    WarningAmber, Close, Search, ContentCopy, Download,
    Add, Edit, VerifiedUser,
} from '@mui/icons-material';
import { useExtractionStore } from '../../store/extractionStore';
import { removeMismatchField } from '../../api/extraction';
import { validateExtraction } from '../../api/validation';
import { useValidationStore } from '../../store/validationStore';
import { formatDateTime, formatFileSize, truncateString } from '../../lib/formatters';
import { CLOUD_PROVIDERS, STEPS } from '../../lib/constants';
import { useSnackbar } from 'notistack';
import { useNavigate } from 'react-router-dom';

// ── Syntax highlight helper ──────────────────────────────────────────────────
function syntaxHighlight(json: string): string {
    return json
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(
            /(\"(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*\"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
            (match) => {
                let cls = 'json-number';
                if (/^"/.test(match)) cls = /:$/.test(match) ? 'json-key' : 'json-string';
                else if (/true|false/.test(match)) cls = 'json-bool';
                else if (/null/.test(match)) cls = 'json-null';
                return `<span class="${cls}">${match}</span>`;
            }
        );
}

const JSON_SYNTAX_CSS = `
.json-key   { color: #93C5FD; }
.json-string{ color: #86EFAC; }
.json-number{ color: #FCA5A5; }
.json-bool  { color: #C4B5FD; }
.json-null  { color: #9CA3AF; }
`;

interface JsonViewerProps { data: Record<string, unknown>; mismatchFields: string[]; removedFields: string[]; renamedFields: Record<string, string>; search: string; }
const JsonViewer: React.FC<JsonViewerProps> = ({ data, mismatchFields, removedFields, renamedFields, search }) => {
    const lines = JSON.stringify(data, null, 2).split('\n');
    return (
        <Box sx={{ bgcolor: '#1E2330', fontFamily: '"JetBrains Mono","Fira Code",Consolas,monospace', fontSize: 13, lineHeight: '22px', overflowX: 'auto', overflowY: 'auto', maxHeight: 420, minHeight: 340, display: 'flex' }}>
            <style>{JSON_SYNTAX_CSS}</style>
            <Box sx={{ width: 44, minWidth: 44, bgcolor: '#181C27', color: '#4B5563', textAlign: 'right', userSelect: 'none', flexShrink: 0, pt: 2, pb: 2, pr: 1 }}>
                {lines.map((_, i) => <Box key={i} sx={{ lineHeight: '22px', px: 1 }}>{i + 1}</Box>)}
            </Box>
            <Box sx={{ flexGrow: 1, px: 2.5, py: 2, overflowX: 'auto' }}>
                {lines.map((line, i) => {
                    const effectiveKey = Object.entries(renamedFields).find(([_, nk]) => line.includes(`"${nk}"`));
                    const isMismatch = mismatchFields.some((f) => !removedFields.includes(f) && (line.includes(`"${f}"`) || effectiveKey));
                    const isSearchMatch = search.length > 1 && line.toLowerCase().includes(search.toLowerCase());
                    return (
                        <Box key={i} sx={{ lineHeight: '22px', whiteSpace: 'pre', px: 0.5, borderLeft: isMismatch ? '3px solid #F59E0B' : '3px solid transparent', bgcolor: isMismatch ? 'rgba(45,36,16,0.7)' : isSearchMatch ? 'rgba(37,99,235,0.15)' : 'transparent', transition: 'background 150ms ease' }}
                            dangerouslySetInnerHTML={{ __html: syntaxHighlight(line) }} />
                    );
                })}
            </Box>
        </Box>
    );
};

// ── Add Field Dialog ─────────────────────────────────────────────────────────
const AddFieldDialog: React.FC<{ open: boolean; onClose: () => void; onAdd: (k: string, v: string) => void }> = ({ open, onClose, onAdd }) => {
    const [key, setKey] = useState(''); const [value, setValue] = useState('');
    const handleAdd = () => { if (key.trim()) { onAdd(key.trim(), value); onClose(); setKey(''); setValue(''); } };
    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>Add Custom Field</DialogTitle>
            <DialogContent>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Add a configuration field that isn't in the extracted data but is required by the template.
                </Typography>
                <TextField autoFocus fullWidth label="Field Key" value={key} onChange={(e) => setKey(e.target.value)} sx={{ mb: 2 }} placeholder="e.g. route53HostedZoneId" />
                <TextField fullWidth label="Field Value" value={value} onChange={(e) => setValue(e.target.value)} placeholder="e.g. Z1234567890ABCDEF" />
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button variant="contained" onClick={handleAdd} disabled={!key.trim()}>Add Field</Button>
            </DialogActions>
        </Dialog>
    );
};

// ── Rename Field Dialog ───────────────────────────────────────────────────────
const RenameFieldDialog: React.FC<{ open: boolean; field: string | null; onClose: () => void; onRename: (orig: string, newKey: string) => void }> = ({ open, field, onClose, onRename }) => {
    const [newKey, setNewKey] = useState(field ?? '');
    React.useEffect(() => setNewKey(field ?? ''), [field]);
    const handleRename = () => { if (field && newKey.trim() && newKey !== field) { onRename(field, newKey.trim()); onClose(); } };
    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>Rename Field</DialogTitle>
            <DialogContent>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Rename <code style={{ fontFamily: 'monospace', background: '#F3F4F6', padding: '2px 6px', borderRadius: 4 }}>{field}</code> to a key that matches the template.
                </Typography>
                <TextField autoFocus fullWidth label="New Field Name" value={newKey} onChange={(e) => setNewKey(e.target.value)} />
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button variant="contained" onClick={handleRename} disabled={!newKey.trim() || newKey === field}>Rename</Button>
            </DialogActions>
        </Dialog>
    );
};

// ── Main ReviewQueue ─────────────────────────────────────────────────────────
const ReviewQueue: React.FC = () => {
    const {
        extraction, selectedTemplate, file,
        removedFields, removeField, removeAllMismatchFields,
        addedFields, addCustomField, renamedFields, renameField,
        reset, setPhase,
    } = useExtractionStore();
    const { setValidation, setIsValidating } = useValidationStore();
    const { enqueueSnackbar } = useSnackbar();
    const navigate = useNavigate();

    const [search, setSearch] = useState('');
    const [bannerDismissed, setBannerDismissed] = useState(false);
    const [addDialogOpen, setAddDialogOpen] = useState(false);
    const [renameDialog, setRenameDialog] = useState<{ open: boolean; field: string | null }>({ open: false, field: null });
    const [isReverifying, setIsReverifying] = useState(false);

    const mismatchFields = extraction?.mismatches ?? [];
    const activeChips = mismatchFields.filter((f) => !removedFields.includes(f));
    const provider = CLOUD_PROVIDERS.find((p) => p.id === selectedTemplate?.provider);

    // Build effective data (with renames + additions)
    const effectiveData = React.useMemo(() => {
        const base = { ...(extraction?.data ?? {}) };
        // Apply renames
        Object.entries(renamedFields).forEach(([orig, nk]) => { if (orig in base) { base[nk] = base[orig]; delete base[orig]; } });
        // Apply additions
        Object.entries(addedFields).forEach(([k, v]) => { base[k] = v; });
        return base;
    }, [extraction, renamedFields, addedFields]);

    const handleRemoveChip = async (field: string) => {
        removeField(field);
        if (extraction) await removeMismatchField(extraction.id, field);
        enqueueSnackbar(`Field "${field}" removed.`, { variant: 'success', autoHideDuration: 3000 });
    };
    const handleRemoveAll = () => { removeAllMismatchFields(); enqueueSnackbar('All extra fields removed.', { variant: 'success' }); };

    const handleCopyJson = () => { navigator.clipboard.writeText(JSON.stringify(effectiveData, null, 2)); enqueueSnackbar('JSON copied!', { variant: 'info', autoHideDuration: 2000 }); };
    const handleExportJson = () => {
        const blob = new Blob([JSON.stringify(effectiveData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob); const a = document.createElement('a');
        a.href = url; a.download = `extracted-config-${Date.now()}.json`; a.click(); URL.revokeObjectURL(url);
    };

    const handleAddField = (key: string, value: string) => {
        addCustomField(key, value);
        enqueueSnackbar(`Field "${key}" added.`, { variant: 'success' });
    };

    const handleRenameField = (orig: string, newKey: string) => {
        renameField(orig, newKey);
        enqueueSnackbar(`Field renamed: "${orig}" → "${newKey}".`, { variant: 'success' });
    };

    const handleReverify = async () => {
        setIsReverifying(true);
        setIsValidating(true);
        enqueueSnackbar('Re-running validation…', { variant: 'info', autoHideDuration: 2000 });
        try {
            const v = await validateExtraction(extraction?.id ?? 'ext-001');
            setValidation(v);
        } catch {
            // Use mock validation
        } finally {
            setIsReverifying(false);
            setIsValidating(false);
        }
        navigate('/validation');
    };

    if (!extraction) return null;

    return (
        <Box>
            <Grid container spacing={4} alignItems="flex-start">
                {/* LEFT: Config Details */}
                <Grid size={{ xs: 12, lg: 4 }}>
                    <Card sx={{ height: '100%' }}>
                        <CardContent sx={{ p: 3.5 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                                <Typography variant="h5">Config Details</Typography>
                                <Chip icon={<CheckCircle sx={{ fontSize: '14px !important', color: '#065F46 !important' }} />} label="Extracted" size="small" sx={{ bgcolor: '#D1FAE5', color: '#065F46', fontWeight: 700, borderRadius: 99 }} />
                            </Box>
                            <Divider sx={{ mb: 2.5 }} />

                            {[
                                { label: 'File Name', value: truncateString(file?.name ?? extraction.fileId, 28) },
                                { label: 'Uploaded', value: formatDateTime(extraction.extractedAt ?? new Date().toISOString()) },
                                { label: 'Template', value: selectedTemplate?.name ?? 'Unknown' },
                                { label: 'Provider', value: provider?.label ?? 'Unknown' },
                                { label: 'Extracted Fields', value: `${extraction.totalFields} fields` },
                                { label: 'Custom Fields Added', value: `${Object.keys(addedFields).length}` },
                                { label: 'Fields Renamed', value: `${Object.keys(renamedFields).length}` },
                                { label: 'Mismatches', value: `${activeChips.length} remaining` },
                                ...(file ? [{ label: 'File Size', value: formatFileSize(file.size) }] : []),
                            ].map(({ label, value }, i, arr) => (
                                <Box key={label}>
                                    <Box sx={{ py: 1.5 }}>
                                        <Typography variant="overline" sx={{ color: '#9CA3AF', display: 'block', mb: 0.25 }}>{label}</Typography>
                                        <Typography variant="body2" fontWeight={500} color={label === 'Template' ? 'primary.main' : 'text.primary'}>
                                            {value}
                                        </Typography>
                                    </Box>
                                    {i < arr.length - 1 && <Divider sx={{ borderColor: '#F3F4F6' }} />}
                                </Box>
                            ))}

                            <Divider sx={{ mt: 2, mb: 3 }} />

                            {/* Action buttons */}
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                <Button variant="contained" size="large" fullWidth endIcon={<VerifiedUser />} onClick={handleReverify} disabled={isReverifying} sx={{ borderRadius: 2 }}>
                                    {isReverifying ? 'Validating…' : 'Validate & Continue'}
                                </Button>
                                {activeChips.length > 0 && (
                                    <Alert severity="warning" sx={{ fontSize: '0.75rem', py: 0.5 }}>
                                        {activeChips.length} mismatch{activeChips.length > 1 ? 'es' : ''} still pending
                                    </Alert>
                                )}
                                <Button variant="outlined" size="large" fullWidth startIcon={<Add />} onClick={() => setAddDialogOpen(true)} sx={{ borderRadius: 2, borderColor: '#D1D5DB', color: '#374151' }}>
                                    Add Missing Field
                                </Button>
                                <Button variant="outlined" size="large" fullWidth startIcon={<Refresh />} onClick={() => setPhase('config')} sx={{ borderRadius: 2, borderColor: '#D1D5DB', color: '#374151' }}>
                                    Re-extract
                                </Button>
                                <Button size="large" fullWidth startIcon={<UploadFile />} onClick={reset} sx={{ borderRadius: 2, color: 'text.secondary', '&:hover': { color: 'text.primary' } }}>
                                    Start over
                                </Button>
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>

                {/* RIGHT: JSON Viewer */}
                <Grid size={{ xs: 12, lg: 8 }}>
                    <Card sx={{ overflow: 'hidden' }}>
                        {/* Header */}
                        <Box sx={{ px: 3.5, py: 2.5, borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
                            <Box>
                                <Typography variant="h5">Extracted JSON</Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                                    {Object.keys(effectiveData).length} fields · {Object.keys(addedFields).length} added · {Object.keys(renamedFields).length} renamed
                                </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                                <TextField size="small" placeholder="Search keys / values…" value={search} onChange={(e) => setSearch(e.target.value)}
                                    InputProps={{ startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 16, color: '#9CA3AF' }} /></InputAdornment> }}
                                    sx={{ width: 200, '& .MuiInputBase-input': { fontSize: '0.8125rem' } }} />
                                <Button variant="outlined" size="small" startIcon={<ContentCopy sx={{ fontSize: 14 }} />} onClick={handleCopyJson} sx={{ borderColor: '#D1D5DB', color: 'text.secondary', fontSize: '0.8125rem' }}>Copy</Button>
                                <Button variant="outlined" size="small" startIcon={<Download sx={{ fontSize: 14 }} />} onClick={handleExportJson} sx={{ borderColor: '#D1D5DB', color: 'text.secondary', fontSize: '0.8125rem' }}>Export</Button>
                            </Box>
                        </Box>

                        {/* JSON Viewer */}
                        <JsonViewer data={effectiveData as Record<string, unknown>} mismatchFields={mismatchFields} removedFields={removedFields} renamedFields={renamedFields} search={search} />

                        {/* Custom added fields summary */}
                        {Object.keys(addedFields).length > 0 && (
                            <>
                                <Divider />
                                <Box sx={{ px: 3, py: 2, bgcolor: '#F0FDF4', borderLeft: '4px solid #10B981', display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
                                    <Typography variant="caption" color="#065F46" fontWeight={600} sx={{ mr: 1 }}>Added fields:</Typography>
                                    {Object.entries(addedFields).map(([k, v]) => (
                                        <Chip key={k} label={`${k}: ${v}`} size="small" sx={{ fontFamily: 'monospace', fontSize: '0.75rem', bgcolor: '#D1FAE5', color: '#065F46', border: '1px solid #BBF7D0' }} />
                                    ))}
                                </Box>
                            </>
                        )}

                        {/* Mismatch Banner */}
                        {activeChips.length > 0 && !bannerDismissed && (
                            <>
                                <Divider />
                                <Box sx={{ bgcolor: '#FFFBEB', borderLeft: '4px solid #F59E0B', px: 3, py: 3 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <WarningAmber sx={{ color: '#F59E0B', fontSize: 18 }} />
                                            <Typography variant="body1" fontWeight={600} color="#92400E">Template mismatch detected</Typography>
                                        </Box>
                                        <Tooltip title="Dismiss banner">
                                            <IconButton size="small" onClick={() => setBannerDismissed(true)} sx={{ color: '#9CA3AF' }}><Close sx={{ fontSize: 16 }} /></IconButton>
                                        </Tooltip>
                                    </Box>
                                    <Typography variant="body2" color="#78350F" sx={{ mb: 1.5 }}>
                                        {activeChips.length} field{activeChips.length > 1 ? 's are' : ' is'} not in the <strong>{selectedTemplate?.name}</strong> template. Remove, rename, or ignore each field.
                                    </Typography>
                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 2 }}>
                                        {activeChips.map((field) => (
                                            <Chip
                                                key={field}
                                                label={renamedFields[field] ? `${field} → ${renamedFields[field]}` : field}
                                                size="small"
                                                onDelete={() => handleRemoveChip(field)}
                                                onClick={() => setRenameDialog({ open: true, field })}
                                                deleteIcon={<Close sx={{ fontSize: '12px !important', color: '#B45309 !important' }} />}
                                                sx={{ bgcolor: '#FEF3C7', border: '1px solid #FDE68A', color: '#92400E', fontWeight: 600, borderRadius: 99, cursor: 'pointer', '&:hover': { bgcolor: '#FDE68A' }, '& .MuiChip-deleteIcon:hover': { color: '#92400E !important' } }}
                                                icon={<Edit sx={{ fontSize: '12px !important', color: '#B45309 !important' }} />}
                                            />
                                        ))}
                                    </Box>
                                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                        <Button size="small" variant="contained" onClick={handleRemoveAll} sx={{ bgcolor: '#D97706', '&:hover': { bgcolor: '#B45309' }, fontSize: '0.8125rem', height: 36, px: 2 }}>Remove all</Button>
                                        <Button size="small" variant="outlined" onClick={() => setBannerDismissed(true)} sx={{ borderColor: '#FDE68A', color: '#92400E', fontSize: '0.8125rem', height: 36, px: 2 }}>Ignore</Button>
                                    </Box>
                                    <Typography variant="caption" color="#92400E" sx={{ display: 'block', mt: 1 }}>💡 Click a chip to rename the field to match the template</Typography>
                                </Box>
                            </>
                        )}

                        {/* All resolved */}
                        {activeChips.length === 0 && mismatchFields.length > 0 && (
                            <>
                                <Divider />
                                <Box sx={{ bgcolor: '#F0FDF4', borderLeft: '4px solid #10B981', px: 3, py: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                    <CheckCircle sx={{ color: '#10B981', fontSize: 18 }} />
                                    <Typography variant="body2" color="#065F46" fontWeight={500}>All mismatches resolved. Click "Validate & Continue" to proceed.</Typography>
                                </Box>
                            </>
                        )}
                    </Card>
                </Grid>
            </Grid>

            {/* Step indicator */}
            <Box sx={{ mt: 4, maxWidth: 560, mx: 'auto' }}>
                <Stepper alternativeLabel activeStep={3}>
                    {STEPS.map((label, i) => <Step key={label} completed={i < 3}><StepLabel>{label}</StepLabel></Step>)}
                </Stepper>
            </Box>

            {/* Dialogs */}
            <AddFieldDialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)} onAdd={handleAddField} />
            <RenameFieldDialog open={renameDialog.open} field={renameDialog.field} onClose={() => setRenameDialog({ open: false, field: null })} onRename={handleRenameField} />
        </Box>
    );
};

function getMimeTypeFromFile(file: File | null): string {
    if (!file) return 'Config File';
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    const map: Record<string, string> = { json: 'JSON', yaml: 'YAML', yml: 'YAML', env: 'ENV', toml: 'TOML', txt: 'Text', xml: 'XML' };
    return map[ext] ?? 'Config File';
}

export default ReviewQueue;
