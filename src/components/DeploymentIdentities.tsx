import React, { useState } from 'react';
import { AzureConfig } from '../types';
import { useToast } from './ToastContext';
import { 
  ShieldCheck, 
  Copy, 
  Check, 
  Terminal, 
  FileCode, 
  HelpCircle, 
  ArrowRight, 
  Fingerprint, 
  CheckCircle,
  Loader2,
  Info,
  Layers
} from 'lucide-react';

interface DeploymentIdentitiesProps {
  config: AzureConfig;
  updateConfig: (updates: Partial<AzureConfig>) => void;
  onComplete: () => void;
}

export default function DeploymentIdentities({ config, updateConfig, onComplete }: DeploymentIdentitiesProps) {
  const { showToast } = useToast();
  const [copied, setCopied] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'cli' | 'bicep'>('cli');
  const [isCreatingIdentity, setIsCreatingIdentity] = useState(false);
  const [identityStep, setIdentityStep] = useState('');
  const [isCreated, setIsCreated] = useState(config.validationStatus?.identities?.isValidated || false);

  const [githubOrg, githubRepoName] = config.githubRepo.split('/');

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    showToast("Identity configuration commands copied to clipboard!", "success");
    setTimeout(() => setCopied(null), 2000);
  };

  // Generate Entra ID Federated Credentials commands
  const cliScript = `# 1. Create an Entra ID App Registration (Service Principal) for GitHub Actions
appId=$(az ad app create --display-name "github-actions-${githubRepoName || 'az-repo'}-oidc" --query appId --output tsv)

# Create Service Principal
az ad sp create --id $appId

# 2. Establish OIDC Federated Trust representing the GitHub Environments
# We map Federated Trust specifically for GitHub environments: "development" and "testing"

# Federated Credential for Development Environment
az ad app federation-credential create \\
  --id $appId \\
  --parameters '{
    "name": "github-env-development",
    "issuer": "https://token.actions.githubusercontent.com",
    "subject": "repo:${config.githubRepo || 'Global-Information-Systems/az-repo'}:environment:development",
    "description": "Federated credential for GitHub Actions development environment",
    "audiences": ["api://AzureADTokenExchange"]
  }'

# Federated Credential for Production Environment
az ad app federation-credential create \\
  --id $appId \\
  --parameters '{
    "name": "github-env-production",
    "issuer": "https://token.actions.githubusercontent.com",
    "subject": "repo:${config.githubRepo || 'Global-Information-Systems/az-repo'}:environment:production",
    "description": "Federated credential for GitHub Actions production environment",
    "audiences": ["api://AzureADTokenExchange"]
  }'

# 3. Grant Subscription / Resource Group 'Contributor' RBAC role to the Identity
az role assignment create \\
  --role "Contributor" \\
  --assignee $appId \\
  --scope "/subscriptions/${config.subscriptionId}/resourceGroups/${config.resourceGroupName}"

# 4. Grant DevCenter Project Environment Type owner permissions
az role assignment create \\
  --role "User Access Administrator" \\
  --assignee $appId \\
  --scope "/subscriptions/${config.subscriptionId}"`;

  // Bicep to create trust programmatically (User-assigned Managed Identity)
  const bicepScript = `// Bicep definition for User-assigned Managed Identity with Federated OIDC Credentials
param location string = '${config.location}'
param identityName string = 'id-github-actions-${githubRepoName || 'az-repo'}'
param githubRepo string = '${config.githubRepo || 'Global-Information-Systems/az-repo'}'

// Create User Assigned Identity
resource userAssignedIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: identityName
  location: location
}

// Federated Credential for GitHub Actions - Environment: development
resource fedCredDev 'Microsoft.ManagedIdentity/userAssignedIdentities/federatedIdentityCredentials@2023-01-31' = {
  parent: userAssignedIdentity
  name: 'fed-cred-dev'
  properties: {
    issuer: 'https://token.actions.githubusercontent.com'
    subject: 'repo:\${githubRepo}:environment:development'
    audiences: [
      'api://AzureADTokenExchange'
    ]
  }
}

// Federated Credential for GitHub Actions - Environment: production
resource fedCredProd 'Microsoft.ManagedIdentity/userAssignedIdentities/federatedIdentityCredentials@2023-01-31' = {
  parent: userAssignedIdentity
  name: 'fed-cred-prod'
  properties: {
    issuer: 'https://token.actions.githubusercontent.com'
    subject: 'repo:\${githubRepo}:environment:production'
    audiences: [
      'api://AzureADTokenExchange'
    ]
  }
}`;

  const handleCreateIdentity = async () => {
    setIsCreatingIdentity(true);
    setIdentityStep('Registering application in Entra ID directory...');
    showToast("Starting application registration in Entra ID directory...", "info");
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIdentityStep('Provisioning Enterprise Service Principal...');
    showToast("Creating enterprise service principal with contribution privileges...", "info");
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIdentityStep('Binding OIDC Federated Identity Credential to repository environments...');
    await new Promise(resolve => setTimeout(resolve, 1200));
    setIdentityStep('Configuring subscription role assignments (Contributor, Owner)...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsCreatingIdentity(false);
    setIsCreated(true);
    showToast(`OIDC Trust established successfully for ${config.githubRepo}!`, "success");
    if (config.validationStatus) {
      updateConfig({
        validationStatus: {
          ...config.validationStatus,
          identities: {
            isValidated: true,
            validatedAt: new Date().toLocaleTimeString(),
            details: `Entra ID OIDC setup verified for GitHub repository [${config.githubRepo}]. Client ID: ${config.clientId}.`
          }
        }
      });
    }
  };

  return (
    <div className="space-y-6" id="identities-panel">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-indigo-600" />
            Configure Deployment Identities
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Establish passwordless OpenID Connect (OIDC) federated credentials trust between GitHub Actions and Microsoft Entra ID.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isCreated && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 border border-emerald-100">
              <CheckCircle className="h-3.5 w-3.5 text-emerald-500" /> Identity Armed
            </span>
          )}
          <button
            onClick={onComplete}
            className="rounded bg-slate-800 hover:bg-slate-700 px-4 py-2 text-xs font-bold text-white uppercase tracking-wider transition"
          >
            Next Step
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Settings Panel */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-3 flex items-center gap-2">
              <Fingerprint className="h-4.5 w-4.5 text-slate-500" /> OIDC trust coordinates
            </h3>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">
                    Client ID (App ID)
                  </label>
                  <input
                    type="text"
                    value={config.clientId}
                    onChange={(e) => updateConfig({ clientId: e.target.value })}
                    placeholder="00000000-0000-0000-0000-000000000000"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-950 bg-white focus:border-indigo-500 focus:outline-hidden font-mono transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">
                    Tenant ID
                  </label>
                  <input
                    type="text"
                    value={config.tenantId}
                    onChange={(e) => updateConfig({ tenantId: e.target.value })}
                    placeholder="00000000-0000-0000-0000-000000000000"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-950 bg-white focus:border-indigo-500 focus:outline-hidden font-mono transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">
                  GitHub Repository Reference
                </label>
                <input
                  type="text"
                  value={config.githubRepo}
                  onChange={(e) => updateConfig({ githubRepo: e.target.value })}
                  placeholder="Owner/repo-name"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-950 bg-white focus:border-indigo-500 focus:outline-hidden font-mono transition"
                />
                <p className="text-[11px] text-slate-400 mt-1.5">
                  Format: <code className="text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">OrganizationName/RepoName</code>. Used for defining subject claims.
                </p>
              </div>
            </div>
          </div>

          {/* OIDC flow explanation */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-3">How OpenID Connect (OIDC) Auth Flow Operates</h3>
            
            <div className="relative border-l-2 border-indigo-200 pl-4 space-y-4 text-xs text-slate-600">
              <div className="relative">
                <div className="absolute -left-[21px] top-1 bg-indigo-600 h-2 w-2 rounded-full border border-white"></div>
                <p className="font-bold text-slate-900">1. GitHub Actions runner requests a secure ID token</p>
                <p className="text-slate-500">The Runner requests an OpenID Connect JSON Web Token (JWT) matching the repository environment context (e.g. environment:development).</p>
              </div>
              <div className="relative">
                <div className="absolute -left-[21px] top-1 bg-indigo-600 h-2 w-2 rounded-full border border-white"></div>
                <p className="font-bold text-slate-900">2. Microsoft Entra ID validates the OIDC JWT trust</p>
                <p className="text-slate-500">Azure checks if the token issuer matches <code className="bg-slate-100 px-1 rounded">token.actions.githubusercontent.com</code> and the subject claim matches the repository and environment settings.</p>
              </div>
              <div className="relative">
                <div className="absolute -left-[21px] top-1 bg-indigo-600 h-2 w-2 rounded-full border border-white"></div>
                <p className="font-bold text-slate-900">3. Entra ID returns a transient access token</p>
                <p className="text-slate-500">If validated, Azure returns a temporary OAuth access token (valid 1 hour) mapped to the Service Principal, completely bypassing passwords/secrets.</p>
              </div>
            </div>
          </div>

          {/* Interactive Simulator */}
          <div className="bg-slate-900 rounded-xl p-5 border border-slate-800 text-slate-200 space-y-3">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-indigo-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-white">Federated Identity Setup</span>
              </div>
              <button
                onClick={handleCreateIdentity}
                disabled={isCreatingIdentity}
                className="flex items-center gap-1 rounded bg-indigo-600 hover:bg-indigo-500 px-3.5 py-1.5 text-xs font-bold text-white uppercase tracking-wider transition disabled:bg-slate-800 disabled:text-slate-500"
              >
                {isCreatingIdentity ? (
                  <>
                    <Loader2 className="h-3 w-3.5 animate-spin" /> Provisioning...
                  </>
                ) : (
                  'Establish Trust'
                )}
              </button>
            </div>

            {isCreatingIdentity || identityStep ? (
              <div className="p-3 bg-slate-950 rounded border border-slate-800 font-mono text-xs text-indigo-300">
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>{identityStep}</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400">
                Registering the identity creates secure credentials in Entra ID directory.
              </p>
            )}
          </div>
        </div>

        {/* Script view */}
        <div className="flex flex-col bg-slate-950 rounded-xl border border-slate-800 overflow-hidden shadow-lg h-[650px]">
          <div className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800">
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab('cli')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold uppercase tracking-wider transition ${
                  activeTab === 'cli' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Terminal className="h-3.5 w-3.5" />
                Azure CLI Setup
              </button>
              <button
                onClick={() => setActiveTab('bicep')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold uppercase tracking-wider transition ${
                  activeTab === 'bicep' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileCode className="h-3.5 w-3.5" />
                Bicep Template
              </button>
            </div>
            <button
              onClick={() => copyToClipboard(activeTab === 'cli' ? cliScript : bicepScript, activeTab)}
              className="text-slate-400 hover:text-white p-1.5 rounded hover:bg-slate-800 transition"
              title="Copy code"
            >
              {copied === activeTab ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>

          <div className="flex-1 overflow-auto p-4 font-mono text-xs text-slate-300 leading-relaxed scrollbar-thin">
            <pre>{activeTab === 'cli' ? cliScript : bicepScript}</pre>
          </div>

          <div className="bg-slate-900 px-4 py-3 border-t border-slate-800 flex items-center gap-2 text-xs text-slate-400">
            <Info className="h-4 w-4 text-indigo-400 shrink-0" />
            <span>GitHub recommends OIDC for secure deployments as it avoids credentials management.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
