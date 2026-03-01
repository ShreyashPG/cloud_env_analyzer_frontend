import React, { useCallback, useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import {
    Box, Card, CardContent, Typography, Button, Select, MenuItem,
    FormControl, InputLabel, Divider, Tooltip, Stepper, Step,
    StepLabel, IconButton, Chip,
} from '@mui/material';
import {
    CloudUpload, InfoOutlined, ArrowForward, ArrowBack, CheckCircle,
} from '@mui/icons-material';
import { useExtractionStore } from '../../store/extractionStore';
import { getTemplates, uploadConfigFile, triggerExtraction } from '../../api/extraction';
import type { CloudTemplate } from '../../api/types';
import { CLOUD_PROVIDERS, STEPS, SUPPORTED_FORMATS, MAX_FILE_SIZE_MB } from '../../lib/constants';
import { useSnackbar } from 'notistack';
import { getMimeTypeLabel } from '../../lib/utils';

const DocUploader: React.FC = () => {
    const {
        selectedTemplate, setTemplate, setFile, setPhase,
        setUploadProgress, setExtractProgress, setElapsedSeconds, setExtraction, setError,
        prereqExtraction,
    } = useExtractionStore();
    const { enqueueSnackbar } = useSnackbar();

    const [templates, setTemplates] = useState<CloudTemplate[]>([]);
    const [isDragOver, setIsDragOver] = useState(false);
    const [localFile, setLocalFile] = useState<File | null>(null);

    useEffect(() => {
        getTemplates().then(setTemplates).catch(() => {
            setTemplates([
                { id: 'aws', name: 'AWS Environment', provider: 'aws', fields: [] },
                { id: 'gcp', name: 'GCP Environment', provider: 'gcp', fields: [] },
                { id: 'azure', name: 'Azure Environment', provider: 'azure', fields: [] },
            ]);
        });
    }, []);

    // Auto-select template if prereq step already set the provider
    useEffect(() => {
        if (selectedTemplate && templates.length > 0) return;
        if (prereqExtraction && templates.length > 0) {
            const match = templates.find(t => t.provider === prereqExtraction.provider);
            if (match) setTemplate(match);
        }
    }, [templates, prereqExtraction]);

    const handleFile = useCallback((file: File) => {
        if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
            enqueueSnackbar(`File too large. Max ${MAX_FILE_SIZE_MB}MB allowed.`, { variant: 'error' });
            return;
        }
        setLocalFile(file);
        setFile(file);
    }, [setFile, enqueueSnackbar]);

    const onDrop = useCallback((accepted: File[]) => {
        if (accepted.length > 0) handleFile(accepted[0]);
        setIsDragOver(false);
    }, [handleFile]);

    const { getRootProps, getInputProps, open } = useDropzone({
        onDrop,
        noClick: true,
        multiple: false,
        onDragEnter: () => setIsDragOver(true),
        onDragLeave: () => setIsDragOver(false),
    });

    const handleUseSample = () => {
        const providerConfigs: Record<string, object> = {
            aws: { region: 'us-east-1', accountId: '123456789012', vpcId: 'vpc-0abc123def456789', eksClusterName: 'my-eks-cluster', s3BucketName: 'my-production-data-bucket' },
            gcp: { projectId: 'my-gcp-project-prod', region: 'us-central1', gkeClusternName: 'gke-cluster-prod', gcsBucketName: 'my-gcs-data-bucket' },
            azure: { subscriptionId: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', resourceGroupName: 'prod-rg', aksClusterName: 'aks-cluster-prod', keyVaultUri: 'https://my-vault.vault.azure.net/' },
        };
        const pid = selectedTemplate?.provider ?? 'aws';
        const content = JSON.stringify(providerConfigs[pid] ?? providerConfigs.aws, null, 2);
        const blob = new Blob([content], { type: 'application/json' });
        const f = new File([blob], `${pid}-sample-config.json`, { type: 'application/json' });
        handleFile(f);
        enqueueSnackbar('Sample config loaded!', { variant: 'info' });
    };

    const handleStartUpload = async () => {
        if (!localFile || !selectedTemplate) {
            enqueueSnackbar('Please select a template and upload a config file.', { variant: 'warning' });
            return;
        }
        setPhase('uploading');
        let elapsed = 0;
        const timer = setInterval(() => { elapsed++; setElapsedSeconds(elapsed); }, 1000);
        try {
            await uploadConfigFile(localFile, setUploadProgress, selectedTemplate.id);
            setPhase('extracting');
            setUploadProgress(100);
            const extraction = await triggerExtraction('', selectedTemplate.id, setExtractProgress);
            clearInterval(timer);
            setExtraction(extraction);
            setPhase('extracted');
            enqueueSnackbar('Extraction complete!', { variant: 'success' });
        } catch (err) {
            clearInterval(timer);
            setError((err as Error).message);
            setPhase('failed');
            enqueueSnackbar('Extraction failed. Please try again.', { variant: 'error' });
        }
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <Card sx={{ width: '100%', maxWidth: 640 }}>
                <CardContent sx={{ p: 5 }}>
                    {/* Back link */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5 }}>
                        <Button size="small" startIcon={<ArrowBack sx={{ fontSize: 14 }} />} onClick={() => setPhase('prereq')} sx={{ color: 'text.secondary', fontSize: '0.8125rem', pl: 0 }}>
                            Back to Prerequisites
                        </Button>
                        {prereqExtraction && (
                            <Chip
                                icon={<CheckCircle sx={{ fontSize: '14px !important', color: '#065F46 !important' }} />}
                                label={`${prereqExtraction.cloudFields.length} fields from doc`}
                                size="small"
                                sx={{ bgcolor: '#D1FAE5', color: '#065F46', fontWeight: 600, borderRadius: 99 }}
                            />
                        )}
                    </Box>

                    {/* Template selector */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap', fontWeight: 500 }}>Template:</Typography>
                        <FormControl size="small" sx={{ width: 220 }}>
                            <InputLabel sx={{ fontSize: '0.875rem' }}>Select provider template…</InputLabel>
                            <Select
                                value={selectedTemplate?.id ?? ''}
                                label="Select provider template…"
                                onChange={(e) => { const t = templates.find((t) => t.id === e.target.value) ?? null; setTemplate(t); }}
                                sx={{ borderRadius: '6px' }}
                            >
                                {templates.map((t) => {
                                    const provider = CLOUD_PROVIDERS.find((p) => p.id === t.provider);
                                    return (
                                        <MenuItem key={t.id} value={t.id}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: provider?.color ?? '#999' }} />
                                                {t.name}
                                            </Box>
                                        </MenuItem>
                                    );
                                })}
                            </Select>
                        </FormControl>
                        <Tooltip title="The template defines which fields are expected in your cloud environment config.">
                            <IconButton size="small" sx={{ color: 'text.disabled' }}><InfoOutlined sx={{ fontSize: 18 }} /></IconButton>
                        </Tooltip>
                    </Box>

                    <Divider sx={{ mb: 3 }} />

                    {/* Drop zone */}
                    <Box
                        {...getRootProps()}
                        sx={{
                            border: isDragOver ? '2px solid #2563EB' : '2px dashed #CBD5E1',
                            borderRadius: '10px',
                            bgcolor: isDragOver ? '#EFF6FF' : '#F8FAFF',
                            minHeight: 220, display: 'flex', flexDirection: 'column',
                            alignItems: 'center', justifyContent: 'center', gap: 2,
                            cursor: 'default', transition: 'all 150ms ease', p: 4,
                        }}
                    >
                        <input {...getInputProps()} />
                        <Box sx={{ width: 80, height: 80, borderRadius: '50%', bgcolor: isDragOver ? 'rgba(219,234,254,0.7)' : 'rgba(219,234,254,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 150ms ease' }}>
                            <CloudUpload sx={{ fontSize: 40, color: 'primary.main' }} />
                        </Box>
                        <Box sx={{ textAlign: 'center' }}>
                            <Typography variant="body1" fontWeight={600} color="text.primary" gutterBottom>
                                {localFile ? localFile.name : 'Drag & drop your cloud config file'}
                            </Typography>
                            {!localFile && <Typography variant="body2" color="text.disabled">or</Typography>}
                        </Box>
                        <Button variant="contained" size="medium" onClick={open} sx={{ borderRadius: '6px' }}>
                            {localFile ? 'Replace file' : 'Browse files'}
                        </Button>
                        {localFile && (
                            <Box sx={{ mt: 1, px: 2, py: 1, bgcolor: '#F0FDF4', borderRadius: 1, border: '1px solid #BBF7D0', display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#10B981' }} />
                                <Typography variant="body2" color="#065F46" fontWeight={500}>{getMimeTypeLabel(localFile)} · {(localFile.size / 1024).toFixed(0)} KB</Typography>
                            </Box>
                        )}
                    </Box>

                    {/* Helper text */}
                    <Box sx={{ textAlign: 'center', mt: 2 }}>
                        <Typography variant="caption" display="block" color="text.secondary">Supported: {SUPPORTED_FORMATS.join(', ')} · Max {MAX_FILE_SIZE_MB} MB</Typography>
                        <Typography variant="body2" sx={{ mt: 1, color: 'primary.main', cursor: 'pointer', '&:hover': { textDecoration: 'underline' }, fontSize: '0.8125rem' }} onClick={handleUseSample}>
                            Use sample config →
                        </Typography>
                    </Box>

                    {/* Start button */}
                    {localFile && selectedTemplate && (
                        <Button variant="contained" size="large" fullWidth onClick={handleStartUpload} endIcon={<ArrowForward />} sx={{ mt: 3, borderRadius: 2 }}>
                            Start Extraction
                        </Button>
                    )}
                </CardContent>
            </Card>

            {/* Step indicator */}
            <Box sx={{ width: '100%', maxWidth: 560 }}>
                <Stepper alternativeLabel activeStep={1}>
                    {STEPS.map((label, i) => (
                        <Step key={label} active={i === 1} completed={i < 1}>
                            <StepLabel>{label}</StepLabel>
                        </Step>
                    ))}
                </Stepper>
            </Box>
        </Box>
    );
};

export default DocUploader;
