import React, { useState } from 'react';
import { AzureConfig } from '../types';
import { useToast } from './ToastContext';
import { 
  Github, 
  Copy, 
  Check, 
  Terminal, 
  Eye, 
  EyeOff, 
  Users, 
  Clock, 
  ShieldCheck, 
  CheckCircle,
  Loader2,
  Lock,
  Compass
} from 'lucide-react';

interface GitHubEnvironmentsProps {
  config: AzureConfig;
  updateConfig: (updates: Partial<AzureConfig>) => void;
  onComplete: () => void;
}

export default function GitHubEnvironments({ config, updateConfig, onComplete }: GitHubEnvironmentsProps) {
  const { showToast } = useToast();
  const [copied, setCopied] = useState<string | null>(null);
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [provisionProgress, setProvisionProgress] = useState(0);
  const [provisionStep, setProvisionStep] = useState('');
  const [isProvisioned, setIsProvisioned] = useState(config.validationStatus?.environments?.isValidated || false);

  const [activeEnv, setActiveEnv] = useState<'development' | 'testing' | 'production'>('development');

  // Environment state configurations
  const [envSettings, setEnvSettings] = useState({
    development: {
      requiredReviewers: false,
      waitTimer: 0,
      selectedBranch: 'Any branch'
    },
    testing: {
      requiredReviewers: false,
      waitTimer: 5, // minutes
      selectedBranch: 'Any branch'
    },
    production: {
      requiredReviewers: true,
      waitTimer: 0,
      selectedBranch: 'Protected branches only'
    }
  });

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    showToast("GitHub environments script copied to clipboard!", "success");
    setTimeout(() => setCopied(null), 2000);
  };

  const updateEnvSetting = (env: 'development' | 'testing' | 'production', updates: any) => {
    setEnvSettings(prev => ({
      ...prev,
      [env]: { ...prev[env], ...updates }
    }));
    showToast(`Updated settings for environment: ${env}`, "info");
  };

  // Generate GitHub CLI (gh) script to configure environments programmatically
  const ghCliScript = `# 1. Create GitHub environments and secrets using GitHub CLI (gh)

# --- DEVELOPMENT ENVIRONMENT ---
gh api -X PUT repos/${config.githubRepo}/environments/development \\
  -f "deployment_branch_policy={\\"protected_branches\\":false,\\"custom_branch_policies\\":false}"

gh secret set AZURE_CLIENT_ID --repo ${config.githubRepo} --env development --body "${config.clientId}"
gh secret set AZURE_TENANT_ID --repo ${config.githubRepo} --env development --body "${config.tenantId}"
gh secret set AZURE_SUBSCRIPTION_ID --repo ${config.githubRepo} --env development --body "${config.subscriptionId}"
gh secret set AZURE_RESOURCE_GROUP --repo ${config.githubRepo} --env development --body "${config.resourceGroupName}"
gh secret set AZURE_DEVCENTER_NAME --repo ${config.githubRepo} --env development --body "${config.devCenterName}"
gh secret set AZURE_PROJECT_NAME --repo ${config.githubRepo} --env development --body "E-Commerce-Platform"
gh secret set AZURE_ENV_TYPE --repo ${config.githubRepo} --env development --body "Development"

# --- TESTING ENVIRONMENT ---
gh api -X PUT repos/${config.githubRepo}/environments/testing \\
  -f wait_timer=${envSettings.testing.waitTimer * 60}000

gh secret set AZURE_CLIENT_ID --repo ${config.githubRepo} --env testing --body "${config.clientId}"
gh secret set AZURE_TENANT_ID --repo ${config.githubRepo} --env testing --body "${config.tenantId}"
gh secret set AZURE_SUBSCRIPTION_ID --repo ${config.githubRepo} --env testing --body "${config.subscriptionId}"
gh secret set AZURE_RESOURCE_GROUP --repo ${config.githubRepo} --env testing --body "${config.resourceGroupName}"
gh secret set AZURE_DEVCENTER_NAME --repo ${config.githubRepo} --env testing --body "${config.devCenterName}"
gh secret set AZURE_PROJECT_NAME --repo ${config.githubRepo} --env testing --body "E-Commerce-Platform"
gh secret set AZURE_ENV_TYPE --repo ${config.githubRepo} --env testing --body "Testing"

# --- PRODUCTION ENVIRONMENT ---
gh api -X PUT repos/${config.githubRepo}/environments/production \\
  -f "deployment_branch_policy={\\"protected_branches\\":true,\\"custom_branch_policies\\":false}"

gh secret set AZURE_CLIENT_ID --repo ${config.githubRepo} --env production --body "${config.clientId}"
gh secret set AZURE_TENANT_ID --repo ${config.githubRepo} --env production --body "${config.tenantId}"
gh secret set AZURE_SUBSCRIPTION_ID --repo ${config.githubRepo} --env production --body "${config.subscriptionId}"
gh secret set AZURE_RESOURCE_GROUP --repo ${config.githubRepo} --env production --body "${config.resourceGroupName}"
gh secret set AZURE_DEVCENTER_NAME --repo ${config.githubRepo} --env production --body "${config.devCenterName}"
gh secret set AZURE_PROJECT_NAME --repo ${config.githubRepo} --env production --body "E-Commerce-Platform"
gh secret set AZURE_ENV_TYPE --repo ${config.githubRepo} --env production --body "Production"`;

  const handleCreateEnvironments = async () => {
    setIsProvisioning(true);
    setProvisionProgress(10);
    setProvisionStep('Connecting to GitHub API endpoint...');
    showToast("Connecting to GitHub API...", "info");

    const steps = [
      { p: 25, s: `Creating environment [development] for repo: ${config.githubRepo}...` },
      { p: 40, s: 'Setting environment secrets for [development] (AZURE_CLIENT_ID, etc.)...' },
      { p: 60, s: 'Creating environment [testing] with deployment wait timer...' },
      { p: 75, s: 'Creating environment [production] with manual approval gates...' },
      { p: 90, s: 'Verifying environment encryption and secrets binding...' },
      { p: 100, s: 'GitHub environments configured and encrypted safely!' }
    ];

    for (const step of steps) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      setProvisionProgress(step.p);
      setProvisionStep(step.s);
      if (step.p === 25 || step.p === 60 || step.p === 75) {
        showToast(step.s, "info");
      }
    }

    setIsProvisioning(false);
    setIsProvisioned(true);
    showToast(`GitHub Environments for ${config.githubRepo} successfully validated!`, "success");
    if (config.validationStatus) {
      updateConfig({
        validationStatus: {
          ...config.validationStatus,
          environments: {
            isValidated: true,
            validatedAt: new Date().toLocaleTimeString(),
            details: `GitHub Environments [development, testing, production] created and configured for repository [${config.githubRepo}].`
          }
        }
      });
    }
  };

  return (
    <div className="space-y-6" id="github-env-panel">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Github className="h-5 w-5 text-indigo-600" />
            Configure GitHub Environments
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Build isolated pipeline target environments, map deployment gates, and populate encrypted credentials.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isProvisioned && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 border border-emerald-100">
              <CheckCircle className="h-3.5 w-3.5 text-emerald-500" /> Environments Provisioned
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
        {/* Environment Configuration Designer */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex border-b border-slate-200">
              {(['development', 'testing', 'production'] as const).map((env) => (
                <button
                  key={env}
                  onClick={() => setActiveEnv(env)}
                  className={`flex-1 py-2.5 text-center border-b-2 text-xs font-bold uppercase tracking-wider transition ${
                    activeEnv === env
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {env}
                </button>
              ))}
            </div>

            {/* Current Environment Design Panel */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-widest">{activeEnv} Environment Design</h4>
                <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded uppercase font-bold">
                  Target Env
                </span>
              </div>

              {/* Secrets Card */}
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">
                  Bound Environment Secrets (Encrypted at rest)
                </span>
                <div className="space-y-1 text-xs font-mono">
                  <div className="flex justify-between p-1.5 bg-white border border-slate-200 rounded">
                    <span className="text-slate-600 font-bold">AZURE_CLIENT_ID</span>
                    <span className="text-indigo-600 font-semibold max-w-[150px] truncate">{config.clientId}</span>
                  </div>
                  <div className="flex justify-between p-1.5 bg-white border border-slate-200 rounded">
                    <span className="text-slate-600 font-bold">AZURE_TENANT_ID</span>
                    <span className="text-indigo-600 font-semibold max-w-[150px] truncate">{config.tenantId}</span>
                  </div>
                  <div className="flex justify-between p-1.5 bg-white border border-slate-200 rounded">
                    <span className="text-slate-600 font-bold">AZURE_SUBSCRIPTION_ID</span>
                    <span className="text-indigo-600 font-semibold max-w-[150px] truncate">{config.subscriptionId}</span>
                  </div>
                  <div className="flex justify-between p-1.5 bg-white border border-slate-200 rounded">
                    <span className="text-slate-600 font-bold">AZURE_ENV_TYPE</span>
                    <span className="text-amber-600 font-bold capitalize">{activeEnv}</span>
                  </div>
                </div>
              </div>

              {/* Deployment Protection Rules */}
              <div className="space-y-3 pt-2">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Deployment Protection Rules</span>
                
                <div className="space-y-3">
                  <label className="flex items-start gap-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={envSettings[activeEnv].requiredReviewers}
                      onChange={(e) => updateEnvSetting(activeEnv, { requiredReviewers: e.target.checked })}
                      className="h-4 w-4 rounded-xs border-slate-300 text-indigo-600 focus:ring-indigo-600 mt-0.5 cursor-pointer"
                    />
                    <div className="text-left">
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
                        <Users className="h-3.5 w-3.5 text-slate-500" />
                        Required Reviewers
                      </span>
                      <span className="text-[11px] text-slate-500 block mt-0.5">
                        Require approvals from team members (e.g. Lead DevOps Engineer) before a deployment starts.
                      </span>
                    </div>
                  </label>

                  <div className="p-3 border border-slate-200 rounded-lg space-y-2">
                    <div className="flex items-center justify-between text-left">
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 text-slate-500" />
                        Wait Timer
                      </span>
                      <span className="text-xs font-bold text-indigo-600 font-mono">
                        {envSettings[activeEnv].waitTimer} mins
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="30"
                      step="5"
                      value={envSettings[activeEnv].waitTimer}
                      onChange={(e) => updateEnvSetting(activeEnv, { waitTimer: parseInt(e.target.value) })}
                      className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    />
                    <span className="text-[11px] text-slate-500 block mt-0.5">
                      Delay deployments to this environment for a specified period after a job triggers.
                    </span>
                  </div>

                  <div className="p-3 border border-slate-200 rounded-lg text-left">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1 mb-2">
                      <ShieldCheck className="h-3.5 w-3.5 text-slate-500" />
                      Deployment Branch Restriction
                    </span>
                    <select
                      value={envSettings[activeEnv].selectedBranch}
                      onChange={(e) => updateEnvSetting(activeEnv, { selectedBranch: e.target.value })}
                      className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs text-slate-950 bg-white focus:border-indigo-500 focus:outline-hidden"
                    >
                      <option value="Any branch">Any branch</option>
                      <option value="Protected branches only">Protected branches only (e.g. main)</option>
                      <option value="Selected branches">Selected branches</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive simulator */}
          <div className="bg-slate-900 rounded-xl p-5 border border-slate-800 text-slate-200 space-y-3">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-indigo-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-white">GitHub Environment Setup simulator</span>
              </div>
              <button
                onClick={handleCreateEnvironments}
                disabled={isProvisioning}
                className="flex items-center gap-1 rounded bg-indigo-600 hover:bg-indigo-500 px-3.5 py-1.5 text-xs font-bold text-white uppercase tracking-wider transition disabled:bg-slate-800 disabled:text-slate-500"
              >
                {isProvisioning ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Provisioning...
                  </>
                ) : (
                  'Provision Environments'
                )}
              </button>
            </div>

            {isProvisioning || provisionStep ? (
              <div className="w-full space-y-1.5">
                <div className="w-full bg-slate-800 h-1.5 rounded-full">
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
                Creates environments on GitHub API with OIDC variables.
              </p>
            )}
          </div>
        </div>

        {/* Script code block */}
        <div className="flex flex-col bg-slate-950 rounded-xl border border-slate-800 overflow-hidden shadow-lg h-[650px]">
          <div className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800">
            <span className="text-xs font-bold text-slate-300 font-mono uppercase tracking-wider flex items-center gap-1.5">
              <Terminal className="h-4 w-4 text-indigo-400" /> GitHub CLI Script Setup
            </span>
            <button
              onClick={() => copyToClipboard(ghCliScript, 'gh')}
              className="text-slate-400 hover:text-white p-1.5 rounded hover:bg-slate-800 transition"
              title="Copy code"
            >
              {copied === 'gh' ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>

          <div className="flex-1 overflow-auto p-4 font-mono text-xs text-slate-300 leading-relaxed scrollbar-thin">
            <pre>{ghCliScript}</pre>
          </div>

          <div className="bg-slate-900 p-4 border-t border-slate-800 flex items-start gap-2.5 text-xs text-slate-400 leading-normal">
            <Compass className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="text-slate-300 font-bold block">Environment Secrets vs Org Secrets:</span>
              <span>Environment secrets are locked specifically to individual execution targets. A workflow run targeting <code className="font-mono text-zinc-200">production</code> can access production secrets, but has no access to development secrets.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
