import React, { useState } from 'react';
import { AzureConfig, KeyVaultSecret } from '../types';
import { useToast } from './ToastContext';
import { 
  Key, 
  Copy, 
  Check, 
  Terminal, 
  FileCode, 
  Eye, 
  EyeOff, 
  Plus, 
  Trash, 
  Lock, 
  CheckCircle,
  Loader2,
  ShieldAlert,
  Sliders
} from 'lucide-react';

interface KeyVaultSetupProps {
  config: AzureConfig;
  updateConfig: (updates: Partial<AzureConfig>) => void;
  onComplete: () => void;
}

export default function KeyVaultSetup({ config, updateConfig, onComplete }: KeyVaultSetupProps) {
  const { showToast } = useToast();
  const [copied, setCopied] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'cli' | 'bicep'>('cli');
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [provisionProgress, setProvisionProgress] = useState(0);
  const [provisionStep, setProvisionStep] = useState('');
  const [isProvisioned, setIsProvisioned] = useState(config.validationStatus?.keyvault?.isValidated || false);

  // Secret visibility state
  const [showSecrets, setShowSecrets] = useState<{ [key: string]: boolean }>({});

  // Dynamic Key Vault configuration
  const [skuName, setSkuName] = useState<'standard' | 'premium'>('standard');
  const [enablePurgeProtection, setEnablePurgeProtection] = useState(true);

  // Secrets stored in Key Vault
  const [secrets, setSecrets] = useState<KeyVaultSecret[]>([
    { name: 'AZURE-SUBSCRIPTION-ID', value: config.subscriptionId, description: 'ID of the target Azure Subscription', isConfigured: true },
    { name: 'AZURE-TENANT-ID', value: config.tenantId || '72f988bf-86f1-41af-91ab-2d7cd011db47', description: 'Azure Active Directory Tenant ID', isConfigured: true },
    { name: 'AZURE-CLIENT-ID', value: config.clientId || '00000000-0000-0000-0000-000000000000', description: 'Service Principal Client App ID', isConfigured: true },
    { name: 'AZURE-CLIENT-SECRET', value: config.clientSecret || '••••••••••••••••••••••••••••', description: 'Client secret used for authentication', isConfigured: !!config.clientSecret },
    { name: 'GITHUB-PAT', value: 'ghp_••••••••••••••••••••••••••••', description: 'GitHub Token to import the private az-repo', isConfigured: true }
  ]);

  const [newSecretName, setNewSecretName] = useState('');
  const [newSecretValue, setNewSecretValue] = useState('');
  const [newSecretDesc, setNewSecretDesc] = useState('');

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    showToast("Key Vault scripting copied to clipboard!", "success");
    setTimeout(() => setCopied(null), 2000);
  };

  const handleAddSecret = () => {
    if (newSecretName && newSecretValue) {
      const sanitizedName = newSecretName.toUpperCase().replace(/[^A-Z0-9-]/g, '-');
      setSecrets([
        ...secrets,
        { name: sanitizedName, value: newSecretValue, description: newSecretDesc || 'Custom Secret', isConfigured: true }
      ]);
      showToast(`Added secret variable: ${sanitizedName}`, "info");
      setNewSecretName('');
      setNewSecretValue('');
      setNewSecretDesc('');
    }
  };

  const handleRemoveSecret = (name: string) => {
    setSecrets(secrets.filter(s => s.name !== name));
    showToast(`Removed secret variable: ${name}`, "warning");
  };

  const toggleSecretVisibility = (name: string) => {
    setShowSecrets(prev => ({ ...prev, [name]: !prev[name] }));
  };

  // Generate dynamic Azure CLI script
  const cliScript = `# 1. Create the Key Vault
az keyvault create \\
  --name "${config.keyVaultName}" \\
  --resource-group "${config.resourceGroupName}" \\
  --location "${config.location}" \\
  --sku ${skuName} \\
  --enable-purge-protection ${enablePurgeProtection}

# 2. Add Secrets to the Key Vault
${secrets.map(sec => `az keyvault secret set \\
  --vault-name "${config.keyVaultName}" \\
  --name "${sec.name}" \\
  --value "${sec.value}" \\
  --description "${sec.description}"`).join('\n\n')}

# 3. Configure Key Vault Access Policy (e.g., granting DevCenter Project Identity access)
# Dev Center Project needs "Get" and "List" secrets permissions
# Replace <dev-center-identity-object-id> with actual Identity Object ID
# az keyvault set-policy \\
#   --name "${config.keyVaultName}" \\
#   --object-id "<dev-center-identity-object-id>" \\
#   --secret-permissions get list`;

  // Generate Bicep script
  const bicepScript = `// Key Vault Deployment with Secrets
param location string = '${config.location}'
param keyVaultName string = '${config.keyVaultName}'
param skuName string = '${skuName}'
param enablePurgeProtection bool = ${enablePurgeProtection}

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: keyVaultName
  location: location
  properties: {
    enabledForDeployment: true
    enabledForTemplateDeployment: true
    enabledForDiskEncryption: false
    tenantId: subscription().tenantId
    sku: {
      name: skuName
      family: 'A'
    }
    enableSoftDelete: true
    softDeleteRetentionInDays: 90
    enablePurgeProtection: enablePurgeProtection ? true : null
    accessPolicies: [] // Updated via Deployment Identities RBAC / Federated credentials
  }
}

// Secrets
${secrets.map((sec, i) => `resource secret_${i} 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: '${sec.name}'
  properties: {
    value: '${sec.value.includes('••') ? 'PLACEHOLDER_SECRET_VALUE' : sec.value}'
    contentType: 'text/plain'
  }
}`).join('\n\n')}`;

  const simulateProvisioning = async () => {
    setIsProvisioning(true);
    setProvisionProgress(10);
    setProvisionStep('Connecting to Azure Cloud Key Vault Manager...');
    showToast("Connecting to Azure Key Vault Manager...", "info");

    const steps = [
      { p: 30, s: `Validating Vault Name availability for [${config.keyVaultName}] globally...` },
      { p: 50, s: `Deploying Key Vault with SKU [${skuName.toUpperCase()}] and Purge Protection: ${enablePurgeProtection}...` },
      { p: 75, s: `Setting ${secrets.length} secure variables in Key Vault...` },
      { p: 90, s: 'Verifying Secret storage and encrypting data at rest (FIPS 140-2 Level 2)...' },
      { p: 100, s: 'Azure Key Vault created and secrets stored safely!' }
    ];

    for (const step of steps) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      setProvisionProgress(step.p);
      setProvisionStep(step.s);
      if (step.p === 50 || step.p === 75) {
        showToast(step.s, "info");
      }
    }

    setIsProvisioning(false);
    setIsProvisioned(true);
    showToast(`Key Vault "${config.keyVaultName}" successfully validated!`, "success");
    if (config.validationStatus) {
      updateConfig({
        validationStatus: {
          ...config.validationStatus,
          keyvault: {
            isValidated: true,
            validatedAt: new Date().toLocaleTimeString(),
            details: `Key Vault [${config.keyVaultName}] deployed with SKU [${skuName.toUpperCase()}] containing ${secrets.length} secure secrets.`
          }
        }
      });
    }
  };

  return (
    <div className="space-y-6" id="key-vault-panel">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Key className="h-5 w-5 text-indigo-600" />
            Create & Configure Key Vault
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Store subscription secrets, deploy IDs, and GitHub access credentials in a secure, central hardware security module (HSM).
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isProvisioned && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 border border-emerald-100">
              <CheckCircle className="h-3.5 w-3.5 text-emerald-500" /> Configured & Armed
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
        {/* Secrets Management Table */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Key Vault Configuration</h3>
              <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
                <Sliders className="h-4 w-4 text-slate-400" /> Settings
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">
                  Key Vault Name
                </label>
                <input
                  type="text"
                  value={config.keyVaultName}
                  onChange={(e) => updateConfig({ keyVaultName: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-950 bg-white focus:border-indigo-500 focus:outline-hidden transition"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">
                  Key Vault SKU
                </label>
                <select
                  value={skuName}
                  onChange={(e) => setSkuName(e.target.value as 'standard' | 'premium')}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-950 bg-white focus:border-indigo-500 focus:outline-hidden transition"
                >
                  <option value="standard">Standard (Software Keys)</option>
                  <option value="premium">Premium (Hardware HSM Keys)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
              <input
                id="purge"
                type="checkbox"
                checked={enablePurgeProtection}
                onChange={(e) => setEnablePurgeProtection(e.target.checked)}
                className="h-4 w-4 rounded-xs border-slate-300 text-indigo-600 focus:ring-indigo-600 cursor-pointer"
              />
              <label htmlFor="purge" className="text-xs text-slate-600 cursor-pointer">
                <strong>Enable Purge Protection</strong> (protects secrets from accidental permanent deletion)
              </label>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-3 flex items-center justify-between">
              <span>Secrets Vault Manager</span>
              <span className="text-xs font-bold text-indigo-600 font-mono uppercase">
                {secrets.length} Secrets Locked
              </span>
            </h3>

            {/* Secret adding form */}
            <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 space-y-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Add Custom Key Vault Secret</span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="SECRET-NAME (uppercase)"
                  value={newSecretName}
                  onChange={(e) => setNewSecretName(e.target.value)}
                  className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs text-slate-950 bg-white focus:border-indigo-500 focus:outline-hidden transition"
                />
                <input
                  type="text"
                  placeholder="Secret Value"
                  value={newSecretValue}
                  onChange={(e) => setNewSecretValue(e.target.value)}
                  className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs text-slate-950 bg-white focus:border-indigo-500 focus:outline-hidden transition"
                />
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Optional Description..."
                  value={newSecretDesc}
                  onChange={(e) => setNewSecretDesc(e.target.value)}
                  className="flex-1 rounded-md border border-slate-300 px-2.5 py-1.5 text-xs text-slate-950 bg-white focus:border-indigo-500 focus:outline-hidden transition"
                />
                <button
                  type="button"
                  onClick={handleAddSecret}
                  className="rounded bg-slate-800 hover:bg-slate-700 px-3 text-xs font-bold text-white uppercase tracking-wider transition flex items-center gap-1 shrink-0"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Secret
                </button>
              </div>
            </div>

            {/* Secrets List */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 uppercase tracking-wider">
                    <th className="px-3 py-2 font-bold">Name</th>
                    <th className="px-3 py-2 font-bold">Value</th>
                    <th className="px-3 py-2 font-bold">Description</th>
                    <th className="px-3 py-2 text-right font-bold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {secrets.map((sec) => (
                    <tr key={sec.name} className="hover:bg-slate-50">
                      <td className="px-3 py-2.5 font-mono text-slate-900 font-bold">{sec.name}</td>
                      <td className="px-3 py-2.5 font-mono text-slate-600">
                        <div className="flex items-center gap-1.5">
                          {showSecrets[sec.name] ? (
                            <span className="bg-slate-100 px-1 py-0.5 rounded border border-slate-200 break-all">{sec.value}</span>
                          ) : (
                            <span className="text-slate-400">••••••••••••••••</span>
                          )}
                          <button
                            onClick={() => toggleSecretVisibility(sec.name)}
                            className="text-slate-400 hover:text-slate-600 p-0.5 transition"
                          >
                            {showSecrets[sec.name] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-slate-500 max-w-[150px] truncate" title={sec.description}>
                        {sec.description}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <button
                          onClick={() => handleRemoveSecret(sec.name)}
                          className="text-slate-400 hover:text-rose-600 transition"
                          title="Delete secret"
                        >
                          <Trash className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Simulate Action Block */}
          <div className="bg-slate-900 rounded-xl p-5 border border-slate-800 text-slate-200 space-y-3">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-indigo-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-white">Key Vault Deployment simulator</span>
              </div>
              <button
                onClick={simulateProvisioning}
                disabled={isProvisioning}
                className="flex items-center gap-1 rounded bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-xs font-bold text-white uppercase tracking-wider transition disabled:bg-slate-800 disabled:text-slate-500"
              >
                {isProvisioning ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Preparing...
                  </>
                ) : (
                  'Deploy Key Vault'
                )}
              </button>
            </div>

            {isProvisioning || provisionStep ? (
              <div className="space-y-1.5">
                <div className="w-full bg-slate-800 rounded-full h-1.5">
                  <div
                    className="bg-indigo-500 h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${provisionProgress}%` }}
                  ></div>
                </div>
                <div className="flex justify-between items-center text-[11px] font-mono">
                  <span className="text-slate-400">{provisionStep}</span>
                  <span className="text-indigo-400 font-semibold">{provisionProgress}%</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400">
                Deploying will package secrets securely in HSM devices.
              </p>
            )}
          </div>
        </div>

        {/* Generated Script / Template Panel */}
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
            <ShieldAlert className="h-4 w-4 text-rose-400 shrink-0" />
            <span>Never commit actual client secrets or PATs to public git repositories!</span>
          </div>
        </div>
      </div>
    </div>
  );
}
