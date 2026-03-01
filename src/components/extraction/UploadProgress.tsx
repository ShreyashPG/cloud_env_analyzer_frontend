import React from 'react';
import {
    Box, Card, CardContent, Typography, Chip, Button, Stepper, Step, StepLabel,
} from '@mui/material';
import { Cancel, InsertDriveFile, Refresh } from '@mui/icons-material';
import { useExtractionStore } from '../../store/extractionStore';
import { formatFileSize, formatElapsedTime } from '../../lib/formatters';
import { STEPS } from '../../lib/constants';

const UploadProgress: React.FC = () => {
    const {
        phase, file, selectedTemplate, uploadProgress, extractProgress,
        elapsedSeconds, setPhase, reset,
    } = useExtractionStore();

    const isUploading = phase === 'uploading';
    const progress = isUploading ? uploadProgress : extractProgress;
    const activeStep = isUploading ? 2 : 2;

    // Estimated time remaining (rough)
    const eta = progress > 5 ? Math.max(0, Math.round((100 - progress) * (elapsedSeconds / progress))) : null;

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <Card sx={{ width: '100%', maxWidth: 640 }}>
                <CardContent sx={{ p: 5 }}>
                    {/* File row */}
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, p: 2, bgcolor: '#F8FAFF', borderRadius: 2, border: '1px solid #E4E7EC' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <InsertDriveFile sx={{ color: '#2563EB', fontSize: 22 }} />
                            <Box>
                                <Typography variant="body2" fontWeight={600} noWrap sx={{ maxWidth: 280 }}>{file?.name ?? 'config.json'}</Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {file ? formatFileSize(file.size) : ''} · {selectedTemplate?.name ?? 'Unknown template'}
                                </Typography>
                            </Box>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                            {isUploading && (
                                <Button size="small" startIcon={<Cancel sx={{ fontSize: 14 }} />} onClick={reset}
                                    sx={{ color: 'text.secondary', fontSize: '0.75rem', borderColor: '#E4E7EC' }} variant="outlined">
                                    Cancel
                                </Button>
                            )}
                            <Button size="small" startIcon={<Refresh sx={{ fontSize: 14 }} />} onClick={() => setPhase('config')}
                                sx={{ color: 'text.secondary', fontSize: '0.75rem', borderColor: '#E4E7EC' }} variant="outlined">
                                Replace
                            </Button>
                        </Box>
                    </Box>

                    {/* Progress */}
                    <Box sx={{ mb: 1 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#2563EB', animation: 'pulseRing 1.5s infinite' }} />
                                <Typography variant="body2" fontWeight={500}>
                                    {isUploading ? 'Uploading…' : 'Extracting fields…'}
                                </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', align: 'center', gap: 1.5 }}>
                                {eta !== null && (
                                    <Typography variant="caption" color="text.secondary">~{eta}s remaining</Typography>
                                )}
                                <Typography variant="body2" fontWeight={700} color="primary.main">{progress}%</Typography>
                            </Box>
                        </Box>
                        <Box sx={{ position: 'relative', height: 8, borderRadius: 99, bgcolor: '#E4E7EC', overflow: 'hidden' }}>
                            <Box sx={{ height: '100%', borderRadius: 99, bgcolor: '#2563EB', width: `${progress}%`, transition: 'width 200ms ease', position: 'relative', overflow: 'hidden' }}>
                                <Box sx={{ position: 'absolute', top: 0, left: '-100%', width: '60%', height: '100%', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)', animation: 'shimmer 1.8s infinite ease-in-out' }} />
                            </Box>
                        </Box>
                    </Box>

                    {/* Sub-steps */}
                    <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
                        {[
                            { label: 'Upload', done: !isUploading, active: isUploading },
                            { label: 'Parse', done: !isUploading && progress > 30, active: !isUploading && progress <= 30 },
                            { label: 'Extract', done: !isUploading && progress >= 100, active: !isUploading && progress > 30 },
                        ].map((s) => (
                            <Chip
                                key={s.label}
                                label={s.label}
                                size="small"
                                sx={{
                                    bgcolor: s.done ? '#D1FAE5' : s.active ? '#EFF6FF' : '#F3F4F6',
                                    color: s.done ? '#065F46' : s.active ? '#2563EB' : '#9CA3AF',
                                    fontWeight: 600,
                                    fontSize: '0.75rem',
                                    borderRadius: 99,
                                    border: s.active ? '1px solid #BFDBFE' : 'none',
                                    animation: s.active ? 'pulseRing 2s infinite' : 'none',
                                }}
                            />
                        ))}
                    </Box>

                    {/* Elapsed */}
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
                        Elapsed: {formatElapsedTime(elapsedSeconds)}
                    </Typography>
                </CardContent>
            </Card>

            <Box sx={{ width: '100%', maxWidth: 560 }}>
                <Stepper alternativeLabel activeStep={activeStep}>
                    {STEPS.map((label, i) => (
                        <Step key={label} active={i === activeStep} completed={i < activeStep}>
                            <StepLabel>{label}</StepLabel>
                        </Step>
                    ))}
                </Stepper>
            </Box>
        </Box>
    );
};

export default UploadProgress;
