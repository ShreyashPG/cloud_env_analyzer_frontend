import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import {
    Box, Card, CardContent, Typography, Button, Divider,
    Chip, Stepper, Step, StepLabel, Alert,
    Select, MenuItem, FormControl, InputLabel, TextField,
    InputAdornment, IconButton,
} from '@mui/material';
import {
    Description, CheckCircle, CloudUpload, AutoAwesome,
    FolderOpen, Close, Search, ContentCopy,
    Download, Add, Edit, WarningAmber, VerifiedUser,
} from '@mui/icons-material';
import { useExtractionStore } from '../../store/extractionStore';
import { CLOUD_PROVIDERS, PREREQ_FORMATS, MAX_FILE_SIZE_MB, STEPS, MOCK_PREREQ_DATA } from '../../lib/constants';
import { sleep } from '../../lib/utils';
import { useSnackbar } from 'notistack';
import type { CloudProvider, PrereqExtraction, CloudTemplate } from '../../api/types';
import { getTemplates } from '../../api/extraction';
import { validateExtraction } from '../../api/validation';
import { useNavigate } from 'react-router-dom';

// ── Syntax highlight helper ────────────────────────────────────────────────
function syntaxHighlight(json: string): string {
    return json
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
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
const JSON_SYNTAX_CSS = `.json-key{color:#93C5FD}.json-string{color:#86EFAC}.json-number{color:#FCA5A5}.json-bool{color:#C4B5FD}.json-null{color:#9CA3AF}`;

// ── Add Field Dialog ──────────────────────────────────────────────────────
import { Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';

const AddFieldDialog: React.FC<{ open: boolean; onClose: () => void; onAdd: (k: string, v: string) => void }> = ({ open, onClose, onAdd }) => {
    const [key, setKey] = useState(''); const [value, setValue] = useState('');
    const handle = () => { if (key.trim()) { onAdd(key.trim(), value); onClose(); setKey(''); setValue(''); } };
    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>Add Field</DialogTitle>
            <DialogContent>
                <TextField autoFocus fullWidth label="Field Key" value={key} onChange={e => setKey(e.target.value)} sx={{ mb: 2, mt: 1 }} placeholder="e.g. elasticacheEndpoint" />
                <TextField fullWidth label="Field Value" value={value} onChange={e => setValue(e.target.value)} placeholder="e.g. my-cache.use1.cache.amazonaws.com" />
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button variant="contained" onClick={handle} disabled={!key.trim()}>Add Field</Button>
            </DialogActions>
        </Dialog>
    );
};

const RenameFieldDialog: React.FC<{ open: boolean; field: string | null; onClose: () => void; onRename: (orig: string, nk: string) => void }> = ({ open, field, onClose, onRename }) => {
    const [nk, setNk] = useState(field ?? '');
    React.useEffect(() => setNk(field ?? ''), [field]);
    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>Rename Field</DialogTitle>
            <DialogContent>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Rename <code style={{ fontFamily: 'monospace', background: '#F3F4F6', padding: '2px 6px', borderRadius: 4 }}>{field}</code> to match the template.</Typography>
                <TextField autoFocus fullWidth label="New Field Name" value={nk} onChange={e => setNk(e.target.value)} sx={{ mt: 1 }} />
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button variant="contained" onClick={() => { if (field && nk.trim() && nk !== field) { onRename(field, nk.trim()); onClose(); } }} disabled={!nk.trim() || nk === field}>Rename</Button>
            </DialogActions>
        </Dialog>
    );
};

// ── JSON Viewer ───────────────────────────────────────────────────────────
const JsonViewer: React.FC<{ data: Record<string, unknown>; mismatchFields: string[]; removedFields: string[]; renamedFields: Record<string, string>; search: string }> = ({ data, mismatchFields, removedFields, renamedFields, search }) => {
    const lines = JSON.stringify(data, null, 2).split('\n');
    return (
        <Box sx={{ bgcolor: '#1E2330', fontFamily: '"JetBrains Mono","Fira Code",Consolas,monospace', fontSize: 13, lineHeight: '22px', overflowX: 'auto', overflowY: 'auto', maxHeight: 380, minHeight: 300, display: 'flex' }}>
            <style>{JSON_SYNTAX_CSS}</style>
            <Box sx={{ width: 40, minWidth: 40, bgcolor: '#181C27', color: '#4B5563', textAlign: 'right', userSelect: 'none', flexShrink: 0, pt: 2, pb: 2 }}>
                {lines.map((_, i) => <Box key={i} sx={{ lineHeight: '22px', px: 1 }}>{i + 1}</Box>)}
            </Box>
            <Box sx={{ flexGrow: 1, px: 2.5, py: 2, overflowX: 'auto' }}>
                {lines.map((line, i) => {
                    const isMismatch = mismatchFields.some(f => !removedFields.includes(f) && line.includes(`"${f}"`));
                    const isSearchMatch = search.length > 1 && line.toLowerCase().includes(search.toLowerCase());
                    return <Box key={i} sx={{ lineHeight: '22px', whiteSpace: 'pre', px: 0.5, borderLeft: isMismatch ? '3px solid #F59E0B' : '3px solid transparent', bgcolor: isMismatch ? 'rgba(45,36,16,0.7)' : isSearchMatch ? 'rgba(37,99,235,0.15)' : 'transparent' }} dangerouslySetInnerHTML={{ __html: syntaxHighlight(line) }} />;
                })}
            </Box>
        </Box>
    );
};

// ── PHASE A: Upload ───────────────────────────────────────────────────────
export const UploadPhase: React.FC = () => {
    const { setPrereqFile, setSelectedProvider, setPhase, setElapsedSeconds, setExtractProgress, setPrereqExtraction, setTemplate } = useExtractionStore();
    const { enqueueSnackbar } = useSnackbar();
    const [localFile, setLocalFile] = useState<File | null>(null);
    const [provider, setProvider] = useState<CloudProvider>('azure');
    const [isDragOver, setIsDragOver] = useState(false);
    const [isExtracting, setIsExtracting] = useState(false);

    const handleFile = useCallback((file: File) => {
        const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
        if (!['docx', 'pdf'].includes(ext)) { enqueueSnackbar('Only DOCX or PDF files are supported.', { variant: 'error' }); return; }
        if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) { enqueueSnackbar(`Max file size is ${MAX_FILE_SIZE_MB} MB.`, { variant: 'error' }); return; }
        setLocalFile(file);
    }, []);

    const { getRootProps, getInputProps, open } = useDropzone({
        onDrop: (accepted) => { if (accepted[0]) handleFile(accepted[0]); setIsDragOver(false); },
        noClick: true, multiple: false,
        accept: { 'application/pdf': ['.pdf'], 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'] },
        onDragEnter: () => setIsDragOver(true),
        onDragLeave: () => setIsDragOver(false),
    });

    const handleUseSample = () => {
        const blob = new Blob(['[AI Assist Prerequisites Document]'], { type: 'application/pdf' });
        const f = new File([blob], `AI-Assist-Prerequisites-${provider.toUpperCase()}.pdf`, { type: 'application/pdf' });
        setLocalFile(f); enqueueSnackbar('Sample document loaded.', { variant: 'info' });
    };

    const handleExtract = async () => {
        if (!localFile) { enqueueSnackbar('Please upload a prerequisites document first.', { variant: 'warning' }); return; }
        setIsExtracting(true);
        setPrereqFile(localFile);
        setSelectedProvider(provider);

        // Fetch template for chosen provider
        let template: CloudTemplate | null = null;
        try {
            const templates = await getTemplates();
            template = templates.find(t => t.provider === provider) ?? null;
        } catch { template = { id: provider, name: `${provider.toUpperCase()} Environment`, provider, fields: [] }; }
        setTemplate(template);

        setPhase('extracting');
        const startTime = Date.now();

        // Simulate extraction progress
        for (let pct = 0; pct <= 100; pct += 4) {
            await sleep(80);
            setExtractProgress(Math.min(pct, 100));
            setElapsedSeconds(Math.round((Date.now() - startTime) / 1000));
        }

        // Build extraction result using mock data + template mismatch detection
        const prereqData = MOCK_PREREQ_DATA[provider] ?? MOCK_PREREQ_DATA.azure;
        const templateFields = (template?.fields ?? []) as string[];
        const mismatches = Object.keys(prereqData).filter(k => !templateFields.includes(k));

        const extraction: PrereqExtraction = {
            id: `prereq-${Date.now()}`,
            filename: localFile.name,
            extractedAt: new Date().toISOString(),
            provider,
            data: prereqData,
            mismatches,
        };

        setPrereqExtraction(extraction);
        setIsExtracting(false);
        setPhase('extracted');
        enqueueSnackbar(`Extracted ${Object.keys(prereqData).length} fields from document.`, { variant: 'success' });
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <Card sx={{ width: '100%', maxWidth: 660 }}>
                <CardContent sx={{ p: 5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
                        <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563EB' }}><Description /></Box>
                        <Box>
                            <Typography variant="h5" fontWeight={600}>Upload Prerequisites Document</Typography>
                            <Typography variant="body2" color="text.secondary">AI Assist deployment prerequisite document (DOCX or PDF)</Typography>
                        </Box>
                    </Box>

                    <Alert severity="info" sx={{ mb: 3, fontSize: '0.8125rem', borderRadius: 1.5 }}>
                        Upload the <strong>AI Assist Prerequisites</strong> document. All required cloud configuration fields and values will be automatically extracted and validated against the selected cloud provider.
                    </Alert>

                    <FormControl size="small" sx={{ mb: 3, minWidth: 240 }}>
                        <InputLabel>Target Cloud Provider</InputLabel>
                        <Select value={provider} label="Target Cloud Provider" onChange={e => setProvider(e.target.value as CloudProvider)}>
                            {CLOUD_PROVIDERS.map(p => (
                                <MenuItem key={p.id} value={p.id}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: p.color }} />{p.label}
                                    </Box>
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    <Divider sx={{ mb: 3 }} />

                    <Box {...getRootProps()} sx={{ border: isDragOver ? '2px solid #2563EB' : '2px dashed #CBD5E1', borderRadius: '10px', bgcolor: isDragOver ? '#EFF6FF' : '#F8FAFF', minHeight: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, cursor: 'default', transition: 'all 150ms ease', p: 4 }}>
                        <input {...getInputProps()} />
                        <Box sx={{ width: 72, height: 72, borderRadius: '50%', bgcolor: 'rgba(219,234,254,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {localFile ? <Description sx={{ fontSize: 38, color: localFile.name.endsWith('.pdf') ? '#EF4444' : '#2563EB' }} /> : <CloudUpload sx={{ fontSize: 38, color: '#2563EB' }} />}
                        </Box>
                        <Typography variant="body1" fontWeight={600}>{localFile ? localFile.name : 'Drag & drop your prerequisites document'}</Typography>
                        {localFile ? (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, bgcolor: '#F0FDF4', px: 2, py: 0.75, borderRadius: 1, border: '1px solid #BBF7D0' }}>
                                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#10B981' }} />
                                <Typography variant="caption" color="#065F46" fontWeight={500}>{localFile.name.endsWith('.pdf') ? 'PDF Document' : 'Word Document'} · {(localFile.size / 1024).toFixed(0)} KB</Typography>
                            </Box>
                        ) : <Typography variant="body2" color="text.disabled">or</Typography>}
                        <Button variant="contained" size="medium" onClick={open} startIcon={<FolderOpen />} sx={{ borderRadius: '6px' }}>{localFile ? 'Replace file' : 'Browse files'}</Button>
                        <Typography variant="caption" color="text.secondary">Supported: {PREREQ_FORMATS.join(', ')} · Max {MAX_FILE_SIZE_MB} MB</Typography>
                    </Box>

                    <Box sx={{ textAlign: 'center', mt: 1, mb: 2 }}>
                        <Typography variant="body2" sx={{ color: 'primary.main', cursor: 'pointer', '&:hover': { textDecoration: 'underline' }, fontSize: '0.8125rem' }} onClick={handleUseSample}>
                            Use sample prerequisites document →
                        </Typography>
                    </Box>

                    <Button variant="contained" size="large" fullWidth onClick={handleExtract} disabled={!localFile || isExtracting} startIcon={<AutoAwesome />} sx={{ borderRadius: 2 }}>
                        Extract & Validate
                    </Button>
                </CardContent>
            </Card>
            <Box sx={{ width: '100%', maxWidth: 560 }}>
                <Stepper alternativeLabel activeStep={0}>
                    {STEPS.map((label, i) => <Step key={label} active={i === 0}><StepLabel>{label}</StepLabel></Step>)}
                </Stepper>
            </Box>
        </Box>
    );
};

// ── PHASE B: Review extracted JSON + Validate ─────────────────────────────
export const ReviewPhase: React.FC = () => {
    const { prereqExtraction, selectedTemplate, removedFields, removeField, removeAllMismatchFields,
        addedFields, addCustomField, renamedFields, renameField, setPhase, setValidation } = useExtractionStore();
    const { enqueueSnackbar } = useSnackbar();
    const navigate = useNavigate();

    const [search, setSearch] = useState('');
    const [bannerDismissed, setBannerDismissed] = useState(false);
    const [addOpen, setAddOpen] = useState(false);
    const [renameDialog, setRenameDialog] = useState<{ open: boolean; field: string | null }>({ open: false, field: null });
    const [isValidating, setIsValidating] = useState(false);

    const mismatchFields = prereqExtraction?.mismatches ?? [];
    const activeChips = mismatchFields.filter(f => !removedFields.includes(f));

    const effectiveData = React.useMemo(() => {
        const base = { ...(prereqExtraction?.data ?? {}) } as Record<string, unknown>;
        Object.entries(renamedFields).forEach(([orig, nk]) => { if (orig in base) { base[nk] = base[orig]; delete base[orig]; } });
        Object.entries(addedFields).forEach(([k, v]) => { base[k] = v; });
        return base;
    }, [prereqExtraction, renamedFields, addedFields]);

    const handleCopy = () => { navigator.clipboard.writeText(JSON.stringify(effectiveData, null, 2)); enqueueSnackbar('Copied!', { variant: 'info', autoHideDuration: 2000 }); };
    const handleExport = () => {
        const blob = new Blob([JSON.stringify(effectiveData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob); const a = document.createElement('a');
        a.href = url; a.download = `prereq-extracted-${Date.now()}.json`; a.click(); URL.revokeObjectURL(url);
    };

    const handleValidate = async () => {
        setIsValidating(true);
        try {
            const v = await validateExtraction(prereqExtraction?.id ?? 'val-aws-001');
            setValidation(v);
        } catch { /* use mock */ }
        setIsValidating(false);
        navigate('/validation');
    };

    if (!prereqExtraction) return null;

    return (
        <Box>
            <Box sx={{ display: 'flex', gap: 3, flexDirection: { xs: 'column', lg: 'row' } }}>
                {/* Left panel: details + actions */}
                <Box sx={{ width: { xs: '100%', lg: 320 }, flexShrink: 0 }}>
                    <Card sx={{ height: '100%' }}>
                        <CardContent sx={{ p: 3.5 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                                <Typography variant="h5">Extraction Summary</Typography>
                                <Chip icon={<CheckCircle sx={{ fontSize: '14px !important', color: '#065F46 !important' }} />} label="Extracted" size="small" sx={{ bgcolor: '#D1FAE5', color: '#065F46', fontWeight: 700, borderRadius: 99 }} />
                            </Box>
                            <Divider sx={{ mb: 2.5 }} />
                            {[
                                { label: 'Document', value: prereqExtraction.filename },
                                { label: 'Provider', value: selectedTemplate?.name ?? prereqExtraction.provider.toUpperCase() },
                                { label: 'Extracted Fields', value: `${Object.keys(prereqExtraction.data).length}` },
                                { label: 'Custom Fields Added', value: `${Object.keys(addedFields).length}` },
                                { label: 'Fields Renamed', value: `${Object.keys(renamedFields).length}` },
                                { label: 'Mismatches', value: `${activeChips.length} remaining` },
                            ].map(({ label, value }, i, arr) => (
                                <Box key={label}>
                                    <Box sx={{ py: 1.25 }}>
                                        <Typography variant="overline" sx={{ color: '#9CA3AF', display: 'block', mb: 0.25 }}>{label}</Typography>
                                        <Typography variant="body2" fontWeight={500}>{value}</Typography>
                                    </Box>
                                    {i < arr.length - 1 && <Divider sx={{ borderColor: '#F3F4F6' }} />}
                                </Box>
                            ))}
                            <Divider sx={{ mt: 2, mb: 2.5 }} />
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                <Button variant="contained" size="large" fullWidth endIcon={<VerifiedUser />} onClick={handleValidate} disabled={isValidating} sx={{ borderRadius: 2 }}>
                                    {isValidating ? 'Validating…' : 'Validate Against Template'}
                                </Button>
                                {activeChips.length > 0 && <Alert severity="warning" sx={{ fontSize: '0.75rem', py: 0.5 }}>{activeChips.length} mismatch{activeChips.length > 1 ? 'es' : ''} pending</Alert>}
                                <Button variant="outlined" size="large" fullWidth startIcon={<Add />} onClick={() => setAddOpen(true)} sx={{ borderRadius: 2, borderColor: '#D1D5DB' }}>Add Field</Button>
                                <Button size="large" fullWidth onClick={() => setPhase('idle')} sx={{ color: 'text.secondary' }}>Start Over</Button>
                            </Box>
                        </CardContent>
                    </Card>
                </Box>

                {/* Right panel: JSON Viewer + mismatch banner */}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Card sx={{ overflow: 'hidden' }}>
                        <Box sx={{ px: 3, py: 2.5, borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
                            <Box>
                                <Typography variant="h5">Extracted Prerequisites JSON</Typography>
                                <Typography variant="body2" color="text.secondary">{Object.keys(effectiveData).length} fields</Typography>
                            </Box>
                            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                <TextField size="small" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)}
                                    InputProps={{ startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 16, color: '#9CA3AF' }} /></InputAdornment> }}
                                    sx={{ width: 180 }} />
                                <Button variant="outlined" size="small" startIcon={<ContentCopy sx={{ fontSize: 14 }} />} onClick={handleCopy} sx={{ borderColor: '#D1D5DB', color: 'text.secondary' }}>Copy</Button>
                                <Button variant="outlined" size="small" startIcon={<Download sx={{ fontSize: 14 }} />} onClick={handleExport} sx={{ borderColor: '#D1D5DB', color: 'text.secondary' }}>Export</Button>
                            </Box>
                        </Box>

                        <JsonViewer data={effectiveData} mismatchFields={mismatchFields} removedFields={removedFields} renamedFields={renamedFields} search={search} />

                        {/* Added fields bar */}
                        {Object.keys(addedFields).length > 0 && (
                            <>
                                <Divider />
                                <Box sx={{ px: 3, py: 1.5, bgcolor: '#F0FDF4', borderLeft: '4px solid #10B981', display: 'flex', flexWrap: 'wrap', gap: 0.75, alignItems: 'center' }}>
                                    <Typography variant="caption" color="#065F46" fontWeight={600} sx={{ mr: 0.5 }}>Added fields:</Typography>
                                    {Object.entries(addedFields).map(([k, v]) => (
                                        <Chip key={k} label={`${k}: ${v}`} size="small" sx={{ fontFamily: 'monospace', fontSize: '0.75rem', bgcolor: '#D1FAE5', color: '#065F46', border: '1px solid #BBF7D0' }} />
                                    ))}
                                </Box>
                            </>
                        )}

                        {/* Mismatch banner */}
                        {activeChips.length > 0 && !bannerDismissed && (
                            <>
                                <Divider />
                                <Box sx={{ bgcolor: '#FFFBEB', borderLeft: '4px solid #F59E0B', px: 3, py: 2.5 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <WarningAmber sx={{ color: '#F59E0B', fontSize: 18 }} />
                                            <Typography variant="body1" fontWeight={600} color="#92400E">Fields not in template</Typography>
                                        </Box>
                                        <IconButton size="small" onClick={() => setBannerDismissed(true)} sx={{ color: '#9CA3AF' }}><Close sx={{ fontSize: 16 }} /></IconButton>
                                    </Box>
                                    <Typography variant="body2" color="#78350F" sx={{ mb: 1.5 }}>
                                        {activeChips.length} field{activeChips.length > 1 ? 's are' : ' is'} not defined in the <strong>{selectedTemplate?.name}</strong> template. Remove or rename them before validating.
                                    </Typography>
                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 2 }}>
                                        {activeChips.map(field => (
                                            <Chip key={field} label={renamedFields[field] ? `${field} → ${renamedFields[field]}` : field} size="small"
                                                onDelete={() => removeField(field)}
                                                onClick={() => setRenameDialog({ open: true, field })}
                                                deleteIcon={<Close sx={{ fontSize: '12px !important', color: '#B45309 !important' }} />}
                                                icon={<Edit sx={{ fontSize: '12px !important', color: '#B45309 !important' }} />}
                                                sx={{ bgcolor: '#FEF3C7', border: '1px solid #FDE68A', color: '#92400E', fontWeight: 600, borderRadius: 99, cursor: 'pointer', '&:hover': { bgcolor: '#FDE68A' } }} />
                                        ))}
                                    </Box>
                                    <Box sx={{ display: 'flex', gap: 1 }}>
                                        <Button size="small" variant="contained" onClick={removeAllMismatchFields} sx={{ bgcolor: '#D97706', '&:hover': { bgcolor: '#B45309' } }}>Remove all</Button>
                                        <Button size="small" variant="outlined" onClick={() => setBannerDismissed(true)} sx={{ borderColor: '#FDE68A', color: '#92400E' }}>Ignore</Button>
                                    </Box>
                                    <Typography variant="caption" color="#92400E" sx={{ display: 'block', mt: 1 }}>💡 Click a chip to rename it to match the template</Typography>
                                </Box>
                            </>
                        )}

                        {activeChips.length === 0 && mismatchFields.length > 0 && (
                            <>
                                <Divider />
                                <Box sx={{ bgcolor: '#F0FDF4', borderLeft: '4px solid #10B981', px: 3, py: 1.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                    <CheckCircle sx={{ color: '#10B981', fontSize: 18 }} />
                                    <Typography variant="body2" color="#065F46" fontWeight={500}>All mismatches resolved — ready to validate.</Typography>
                                </Box>
                            </>
                        )}
                    </Card>
                </Box>
            </Box>

            {/* Step indicator */}
            <Box sx={{ mt: 4, maxWidth: 560, mx: 'auto' }}>
                <Stepper alternativeLabel activeStep={1}>
                    {STEPS.map((label, i) => <Step key={label} completed={i < 1}><StepLabel>{label}</StepLabel></Step>)}
                </Stepper>
            </Box>

            <AddFieldDialog open={addOpen} onClose={() => setAddOpen(false)} onAdd={(k, v) => { addCustomField(k, v); enqueueSnackbar(`Field "${k}" added.`, { variant: 'success' }); }} />
            <RenameFieldDialog open={renameDialog.open} field={renameDialog.field} onClose={() => setRenameDialog({ open: false, field: null })} onRename={(orig, nk) => { renameField(orig, nk); enqueueSnackbar(`Renamed "${orig}" → "${nk}".`, { variant: 'success' }); }} />
        </Box>
    );
};

// ── PHASE C: Extracting progress ──────────────────────────────────────────
export const ExtractingPhase: React.FC = () => {
    const { extractProgress, elapsedSeconds, prereqFile } = useExtractionStore();
    const eta = extractProgress > 5 ? Math.max(0, Math.round((100 - extractProgress) * (elapsedSeconds / extractProgress))) : null;
    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <Card sx={{ width: '100%', maxWidth: 640 }}>
                <CardContent sx={{ p: 5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.5, p: 2, bgcolor: '#F8FAFF', borderRadius: 2, border: '1px solid #E4E7EC' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Description sx={{ color: '#EF4444', fontSize: 22 }} />
                            <Box>
                                <Typography variant="body2" fontWeight={600}>{prereqFile?.name ?? 'prerequisites.pdf'}</Typography>
                                <Typography variant="caption" color="text.secondary">{prereqFile ? `${(prereqFile.size / 1024).toFixed(0)} KB` : ''}</Typography>
                            </Box>
                        </Box>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#2563EB', animation: 'pulseRing 1.5s infinite' }} />
                            <Typography variant="body2" fontWeight={500}>Extracting fields from document…</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            {eta !== null && <Typography variant="caption" color="text.secondary">~{eta}s remaining</Typography>}
                            <Typography variant="body2" fontWeight={700} color="primary.main">{extractProgress}%</Typography>
                        </Box>
                    </Box>
                    <Box sx={{ position: 'relative', height: 8, borderRadius: 99, bgcolor: '#E4E7EC', overflow: 'hidden', mb: 2 }}>
                        <Box sx={{ height: '100%', borderRadius: 99, bgcolor: '#2563EB', width: `${extractProgress}%`, transition: 'width 200ms ease', position: 'relative', overflow: 'hidden' }}>
                            <Box sx={{ position: 'absolute', top: 0, left: '-100%', width: '60%', height: '100%', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)', animation: 'shimmer 1.8s infinite ease-in-out' }} />
                        </Box>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1.5 }}>
                        {['Parsing Document', 'NLP Analysis', 'Field Extraction'].map((s, i) => (
                            <Chip key={s} label={s} size="small" sx={{ bgcolor: extractProgress > i * 33 ? '#D1FAE5' : '#F3F4F6', color: extractProgress > i * 33 ? '#065F46' : '#9CA3AF', fontWeight: 600, fontSize: '0.75rem', borderRadius: 99 }} />
                        ))}
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>Elapsed: {elapsedSeconds}s</Typography>
                </CardContent>
            </Card>
            <Box sx={{ width: '100%', maxWidth: 560 }}>
                <Stepper alternativeLabel activeStep={1}>
                    {STEPS.map((label, i) => <Step key={label} active={i === 1} completed={i < 1}><StepLabel>{label}</StepLabel></Step>)}
                </Stepper>
            </Box>
        </Box>
    );
};
