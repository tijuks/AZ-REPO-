export interface StepValidation {
  isValidated: boolean;
  validatedAt?: string;
  details?: string;
}

export interface AzureConfig {
  subscriptionId: string;
  resourceGroupName: string;
  location: string;
  devCenterName: string;
  keyVaultName: string;
  catalogRepoUrl: string;
  catalogBranch: string;
  catalogPath: string;
  githubRepo: string;
  useOidc: boolean;
  tenantId: string;
  clientId: string;
  clientSecret: string;
  validationStatus?: {
    devcenter: StepValidation;
    keyvault: StepValidation;
    catalog: StepValidation;
    identities: StepValidation;
    environments: StepValidation;
    pipeline: StepValidation;
    export: StepValidation;
  };
}

export interface SetupStep {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  iconName: string;
}

export interface KeyVaultSecret {
  name: string;
  value: string;
  description: string;
  isConfigured: boolean;
}

export interface EnvironmentDefinition {
  name: string;
  templatePath: string;
  description: string;
  parameters: { name: string; type: string; defaultValue: string; description: string }[];
}

export interface PipelineLog {
  id: string;
  timestamp: string;
  level: 'info' | 'warning' | 'error' | 'success';
  message: string;
  stepId?: string;
}

export interface PipelineStepState {
  id: string;
  name: string;
  status: 'idle' | 'running' | 'success' | 'failed';
  duration?: number; // in seconds
}
