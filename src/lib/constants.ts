// Brand colors & design tokens
export const COLORS = {
  primary: '#2563EB',
  primaryDark: '#1D4ED8',
  primaryLight: '#DBEAFE',
  primaryFaint: '#EFF6FF',
  secondary: '#10B981',
  secondaryLight: '#D1FAE5',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  warningFaint: '#FFFBEB',
  error: '#EF4444',
  errorLight: '#FEF2F2',
  surface: '#FFFFFF',
  background: '#F7F8FA',
  border: '#E4E7EC',
  borderLight: '#F3F4F6',
  textPrimary: '#1A1D23',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  textDisabled: '#D1D5DB',
  amber900: '#92400E',
  amber800: '#78350F',
  amber700: '#B45309',
  amber600: '#D97706',
};

export const CLOUD_PROVIDERS = [
  { id: 'aws', label: 'AWS Environment', color: '#FF9900', bgColor: '#FFF3E0' },
  { id: 'gcp', label: 'GCP Environment', color: '#4285F4', bgColor: '#E8F0FE' },
  { id: 'azure', label: 'Azure Environment', color: '#0078D4', bgColor: '#E3F2FD' },
] as const;

// Prerequisites doc formats (DOCX/PDF only)
export const PREREQ_FORMATS = ['DOCX', 'PDF'];
export const PREREQ_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/pdf',
];

export const MAX_FILE_SIZE_MB = 50;

export const API_BASE_URL = 'http://localhost:3001';

// 3-step workflow
export const STEPS = ['Upload', 'Extract', 'Validate'];

// Validation finding domains for drill-down grouping
export const FINDING_DOMAINS = [
  { id: 'all', label: 'All' },
  { id: 'identity', label: 'Identity / IAM' },
  { id: 'network', label: 'Network' },
  { id: 'policy', label: 'Policy' },
  { id: 'resources', label: 'Resources' },
  { id: 'services', label: 'Services' },
] as const;

// Gap report categories for Comparison page
export const GAP_CATEGORIES = [
  { id: 'permission', label: 'Missing Permissions' },
  { id: 'role', label: 'Missing Roles' },
  { id: 'network_rule', label: 'Network Rules' },
  { id: 'field_missing', label: 'Missing Fields' },
  { id: 'value_mismatch', label: 'Value Mismatches' },
] as const;

// Mock extracted data per provider (key: value pairs from prerequisites doc)
export const MOCK_PREREQ_DATA: Record<string, Record<string, string>> = {
  aws: {
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
    snsTopicArn: 'arn:aws:sns:us-east-1:123456789012:AIAssistAlerts',
    cloudwatchLogGroupName: '/aws/eks/aiassist-eks-prod',
  },
  gcp: {
    projectId: 'aiassist-prod-001',
    region: 'us-central1',
    zone: 'us-central1-a',
    serviceAccountEmail: 'aiassist-sa@aiassist-prod-001.iam.gserviceaccount.com',
    vpcNetworkName: 'aiassist-vpc',
    subnetName: 'aiassist-subnet-prod',
    gkeClusternName: 'aiassist-gke-prod',
    gcsBucketName: 'aiassist-data-prod',
    secretManagerSecretName: 'aiassist-api-key',
  },
  azure: {
    subscriptionId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    tenantId: 'ffffffff-gggg-hhhh-iiii-jjjjjjjjjjjj',
    clientId: '11111111-2222-3333-4444-555555555555',
    resourceGroupName: 'aiassist-prod-rg',
    location: 'eastus',
    vnetName: 'aiassist-vnet',
    subnetName: 'aiassist-subnet',
    aksClusterName: 'aiassist-aks-prod',
    acrLoginServer: 'aiassistprod.azurecr.io',
    keyVaultUri: 'https://aiassist-kv.vault.azure.net/',
    logAnalyticsWorkspaceId: '/subscriptions/aaa.../resourceGroups/aiassist-prod-rg/providers/microsoft.operationalinsights/workspaces/aiassist-logs',
    applicationInsightsKey: 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff',
  },
};
