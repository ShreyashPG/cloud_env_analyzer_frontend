import React from 'react';
import { Box, Typography, Breadcrumbs } from '@mui/material';
import { NavigateNext } from '@mui/icons-material';
import { useExtractionStore } from '../store/extractionStore';
import { UploadPhase, ExtractingPhase, ReviewPhase } from '../components/extraction/PrereqUploader';
import PageShell from '../components/layout/PageShell';

const Extraction: React.FC = () => {
    const { phase } = useExtractionStore();

    const phaseLabel: Record<string, string> = {
        idle: 'Upload Prerequisites',
        extracting: 'Extracting Fields',
        extracted: 'Review & Validate',
        failed: 'Upload Failed',
    };

    return (
        <PageShell>
            <Breadcrumbs separator={<NavigateNext fontSize="small" sx={{ color: '#9CA3AF' }} />} sx={{ mb: 1 }}>
                <Typography component="a" href="/" sx={{ fontSize: '0.8125rem', color: 'text.secondary', textDecoration: 'none' }}>Dashboard</Typography>
                <Typography sx={{ fontSize: '0.8125rem', color: 'text.primary', fontWeight: 500 }}>
                    {phaseLabel[phase]}
                </Typography>
            </Breadcrumbs>

            <Box sx={{ mb: 4 }}>
                <Typography variant="h1" sx={{ fontSize: { xs: '1.375rem', md: '1.75rem' }, fontWeight: 600, mb: 0.5 }}>
                    {phaseLabel[phase]}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    Upload your AI Assist prerequisites document to extract required fields, review them, and validate against your cloud provider.
                </Typography>
            </Box>

            {phase === 'idle' && <UploadPhase />}
            {phase === 'extracting' && <ExtractingPhase />}
            {phase === 'extracted' && <ReviewPhase />}
        </PageShell>
    );
};

export default Extraction;
