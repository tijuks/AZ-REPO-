import React, { useState } from 'react';
import { AzureConfig } from '../types';
import { useToast } from './ToastContext';
import { 
  Building2, 
  Copy, 
  Check, 
  Terminal, 
  FileCode, 
  HelpCircle, 
  Play, 
  CheckCircle, 
  Loader2 
} from 'lucide-react';

interface DevCenterSetupProps {
  config: AzureConfig;
  updateConfig: (updates: Partial<AzureConfig>) => void;
  onComplete: () => void;
}

export default function DevCenterSetup({ config, updateConfig, onComplete }: DevCenterSetupProps) {
  const { showToast } = useToast();
  const [copied, setCopied] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'cli' | 'bicep'>('cli');
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [provisionProgress, setProvisionProgress] = useState<number>(0);
  const [provisionStep, setProvisionStep] = useState<string>('');
  const [isProvisioned, setIsProvisioned] = useState(config.validationStatus?.devcenter?.isValidated || false);


  const [projectName, setProjectName] = useState('E-Commerce-Platform');
  const [envTypes, setEnvTypes] = useState<string[]>(['Development', 'Testing', 'Production']);
  const [newEnvType, setNewEnvType] = useState('');

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    showToast("Provisioning script copied to clipboard!", "success");
    setTimeout(() => setCopied(null), 2000);
  };

  const handleAddEnvType = () => {
    if (newEnvType && !envTypes.includes(newEnvType)) {
      setEnvTypes([...envTypes, newEnvType]);
      showToast(`Added environment type: ${newEnvType}`, "info");
      setNewEnvType('');
    }
  };

  const handleRemoveEnvType = (type: string) => {
    setEnvTypes(envTypes.filter(t => t !== type));
    showToast(`Removed environment type: ${type}`, "warning");
  };

  // Generate CLI Script dynamically
  const cliScript = `# 1. Create a Resource Group
az group create --name ${config.resourceGroupName} --location ${config.location}

# 2. Create the Dev Center
az devcenter admin devcenter create \\
  --name ${config.devCenterName} \\
  --resource-group ${config.resourceGroupName} \\
  --location ${config.location}

# 3. Create the Dev Center Project
az devcenter admin project create \\
  --name ${projectName} \\
  --devcenter-name ${config.devCenterName} \\
  --resource-group ${config.resourceGroupName} \\
  --description "Project environment container for deployment pipelines"

# 4. Create the Environment Types
${envTypes.map(et => `az devcenter admin environment-type create \\
  --name ${et} \\
  --devcenter-name ${config.devCenterName} \\
  --resource-group ${config.resourceGroupName}`).join('\n\n')}

# 5. Map Environment Type to Project
${envTypes.map(et => `az devcenter admin project-environment-type create \\
  --name ${et} \\
  --project-name ${projectName} \\
  --resource-group ${config.resourceGroupName} \\
  --roles "Owner" \\
  --deployment-target-id "/subscriptions/${config.subscriptionId}" \\
  --status Enabled`).join('\n\n')}`;

  // Generate Bicep Template dynamically
  const bicepTemplate = `// Bicep deployment for Azure Dev Center and Projects
targetScope = 'resourceGroup'

param location string = '${config.location}'
param devCenterName string = '${config.devCenterName}'
param projectName string = '${projectName}'

// Dev Center
resource devCenter 'Microsoft.DevCenter/devcenters@2023-04-01' = {
  name: devCenterName
  location: location
  properties: {}
}

// Environment Types
${envTypes.map((et, index) => `resource envType${index} 'Microsoft.DevCenter/devcenters/environmentTypes@2023-04-01' = {
  parent: devCenter
  name: '${et}'
  properties: {}
}`).join('\n\n')}

// Dev Center Project
resource project 'Microsoft.DevCenter/projects@2023-04-01' = {
  name: projectName
  location: location
  properties: {
    devCenterId: devCenter.id
    description: 'DevCenter project container for deployment pipelines'
  }
}

// Project Environment Types Mapping
${envTypes.map((et, index) => `resource projEnvType${index} 'Microsoft.DevCenter/projects/environmentTypes@2023-04-01' = {
  parent: project
  name: '${et}'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    deploymentTargetId: '/subscriptions/${config.subscriptionId}'
    status: 'Enabled'
    creatorRoleAssignment: {
      roles: {
        '8e0bd0f1-618e-4b53-b391-b1e48f654b90': {} // Owner Role
      }
    }
  }
}`).join('\n\n')}`;

  const simulateProvisioning = async () => {
    setIsProvisioning(true);
    setProvisionProgress(10);
    setProvisionStep('Initializing Azure Resource Manager connection...');
    showToast("Initiating Dev Center resource deployment on subscription...", "info");

    const steps = [
      { p: 25, s: `Creating Resource Group [${config.resourceGroupName}] in ${config.location.toUpperCase()}...` },
      { p: 45, s: `Provisioning Azure Dev Center [${config.devCenterName}] (takes standard ~45s in real Azure)...` },
      { p: 65, s: `Configuring Dev Center Projects: Creating Project [${projectName}]...` },
      { p: 80, s: `Registering Environment Types: ${envTypes.join(', ')}...` },
      { p: 95, s: `Mapping Project Environment Types and establishing subscription role assignments...` },
      { p: 100, s: 'Provisioning completed successfully!' }
    ];

    for (const step of steps) {
      await new Promise(resolve => setTimeout(resolve, 1200));
      setProvisionProgress(step.p);
      setProvisionStep(step.s);
      if (step.p === 45 || step.p === 80) {
        showToast(step.s, "info");
      }
    }

    setIsProvisioning(false);
    setIsProvisioned(true);
    showToast(`Azure Dev Center "${config.devCenterName}" successfully validated!`, "success");
    if (config.validationStatus) {
      updateConfig({
        validationStatus: {
          ...config.validationStatus,
          devcenter: {
            isValidated: true,
            validatedAt: new Date().toLocaleTimeString(),
            details: `Dev Center [${config.devCenterName}] with Project [${projectName}] and Environment Types [${envTypes.join(', ')}] deployed & validated.`
          }
        }
      });
    }
  };

  return (
    <div className="space-y-6" id="dev-center-panel">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Building2 className="h-5 w-5 text-indigo-600" />
            Create & Configure Azure Dev Center
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Configure the central administrative hub where DevCenter Projects and Environment Types are managed.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isProvisioned && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 border border-emerald-100">
              <CheckCircle className="h-3.5 w-3.5 text-emerald-500" /> Provisioned
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
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-3">Dev Center Definition</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">
                  Subscription ID
                </label>
                <input
                  type="text"
                  value={config.subscriptionId}
                  onChange={(e) => updateConfig({ subscriptionId: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-950 bg-white focus:border-indigo-500 focus:outline-hidden transition"
                  placeholder="00000000-0000-0000-0000-000000000000"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">
                  Resource Group Name
                </label>
                <input
                  type="text"
                  value={config.resourceGroupName}
                  onChange={(e) => updateConfig({ resourceGroupName: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-950 bg-white focus:border-indigo-500 focus:outline-hidden transition"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">
                  Dev Center Name
                </label>
                <input
                  type="text"
                  value={config.devCenterName}
                  onChange={(e) => updateConfig({ devCenterName: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-950 bg-white focus:border-indigo-500 focus:outline-hidden transition"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">
                  Location
                </label>
                <select
                  value={config.location}
                  onChange={(e) => updateConfig({ location: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-950 bg-white focus:border-indigo-500 focus:outline-hidden transition"
                >
                  <option value="eastus2">East US 2</option>
                  <option value="westeurope">West Europe</option>
                  <option value="westus3">West US 3</option>
                  <option value="southeastasia">Southeast Asia</option>
                </select>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">
                Associated DevCenter Project Name
              </label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-950 bg-white focus:border-indigo-500 focus:outline-hidden transition"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                A project acts as an environment isolation boundary linked to developers.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Environment Types</h3>
              <span className="text-[10px] uppercase font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded tracking-wide">
                ADE Environments
              </span>
            </div>

            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. Staging, Sandbox"
                  value={newEnvType}
                  onChange={(e) => setNewEnvType(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddEnvType()}
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-950 bg-white focus:border-indigo-500 focus:outline-hidden transition"
                />
                <button
                  type="button"
                  onClick={handleAddEnvType}
                  className="rounded bg-slate-800 hover:bg-slate-700 px-4 text-xs font-bold text-white uppercase tracking-wide transition"
                >
                  Add
                </button>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                {envTypes.map((type) => (
                  <span
                    key={type}
                    className="inline-flex items-center gap-1.5 rounded-md bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 border border-indigo-100"
                  >
                    {type}
                    <button
                      type="button"
                      onClick={() => handleRemoveEnvType(type)}
                      className="group relative -mr-1 h-3.5 w-3.5 rounded-xs hover:bg-indigo-200 flex items-center justify-center text-indigo-500 hover:text-indigo-950"
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Interactive Cloud Provisioning Simulator */}
          <div className="bg-slate-900 text-slate-200 rounded-xl p-6 shadow-md border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-indigo-400 animate-pulse"></span>
                <span className="text-xs uppercase font-bold text-white tracking-wider">Azure Resource simulator</span>
              </div>
              <button
                onClick={simulateProvisioning}
                disabled={isProvisioning}
                className="flex items-center gap-1.5 rounded bg-indigo-600 hover:bg-indigo-500 px-3.5 py-2 text-xs font-bold text-white uppercase tracking-wider transition disabled:bg-slate-800 disabled:text-slate-500"
              >
                {isProvisioning ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Provisioning...
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5 fill-current" />
                    Deploy to Azure
                  </>
                )}
              </button>
            </div>

            {isProvisioning || provisionStep ? (
              <div className="space-y-2">
                <div className="w-full bg-slate-800 rounded-full h-2">
                  <div
                    className="bg-indigo-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${provisionProgress}%` }}
                  ></div>
                </div>
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="text-slate-400">{provisionStep}</span>
                  <span className="text-indigo-400 font-semibold">{provisionProgress}%</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400">
                Click "Deploy to Azure" to test and simulate Azure deployment environment workflows.
              </p>
            )}
          </div>
        </div>

        {/* Code View Panel */}
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
                Azure CLI
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
              onClick={() => copyToClipboard(activeTab === 'cli' ? cliScript : bicepTemplate, activeTab)}
              className="text-slate-400 hover:text-white p-1.5 rounded hover:bg-slate-800 transition"
              title="Copy code"
            >
              {copied === activeTab ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>

          <div className="flex-1 overflow-auto p-4 font-mono text-xs text-slate-300 leading-relaxed scrollbar-thin">
            <pre>{activeTab === 'cli' ? cliScript : bicepTemplate}</pre>
          </div>

          <div className="bg-slate-900 px-4 py-3 border-t border-slate-800 flex items-center gap-2 text-xs text-slate-400">
            <HelpCircle className="h-4 w-4 text-indigo-400 shrink-0" />
            <span>This script creates DevCenter, Environment Types, and Projects.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
