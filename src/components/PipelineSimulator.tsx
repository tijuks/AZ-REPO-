import React, { useState, useEffect, useRef } from 'react';
import { AzureConfig } from '../types';
import { useToast } from './ToastContext';
import { 
  Play, 
  Terminal, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Loader2, 
  ExternalLink, 
  Settings, 
  RefreshCw, 
  Cpu, 
  FileCode,
  Layers,
  Sparkles
} from 'lucide-react';

interface PipelineSimulatorProps {
  config: AzureConfig;
  updateConfig?: (updates: Partial<AzureConfig>) => void;
}

interface WorkflowStep {
  id: string;
  name: string;
  duration: number;
  status: 'idle' | 'running' | 'success' | 'failed';
}

interface LogLine {
  text: string;
  type: 'info' | 'warning' | 'error' | 'success' | 'cmd';
}

export default function PipelineSimulator({ config, updateConfig }: PipelineSimulatorProps) {
  const { showToast } = useToast();
  const [targetEnv, setTargetEnv] = useState<'development' | 'testing' | 'production'>('development');
  const [selectedTemplate, setSelectedTemplate] = useState('Azure-AppService-Sandbox');
  const [appNameParam, setAppNameParam] = useState('app-gis-ecommerce');
  const [dotnetVersion, setDotnetVersion] = useState('8.0.x');
  const [enableDotnetCache, setEnableDotnetCache] = useState(true);
  const [nodeVersion, setNodeVersion] = useState('20.x');
  const [nodeCache, setNodeCache] = useState('npm');
  const [failureMode, setFailureMode] = useState<'none' | 'oidc' | 'kv' | 'bicep' | 'dotnet' | 'node'>('none');
  
  const [isRunning, setIsRunning] = useState(false);
  const [pipelineSuccess, setPipelineSuccess] = useState<boolean | null>(config.validationStatus?.pipeline?.isValidated ? true : null);
  const [activeStepId, setActiveStepId] = useState<string | null>(null);
  const [currentStepProgress, setCurrentStepProgress] = useState(0);

  const getRepoName = (url: string) => {
    try {
      const cleaned = url.replace(/https?:\/\/github\.com\//i, '');
      const parts = cleaned.split('/');
      if (parts.length >= 2) {
        return `${parts[0]}/${parts[1]}`.trim();
      }
      return cleaned || 'repository';
    } catch {
      return 'repository';
    }
  };

  const isJangu = config.catalogRepoUrl.toLowerCase().includes('jangu');

  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [logs, setLogs] = useState<LogLine[]>(
    config.validationStatus?.pipeline?.isValidated ? [
      { text: 'PIPELINE RUN HISTORICAL RECORD (PRE-VALIDATED)', type: 'info' },
      { text: `[SUCCESS] Verified complete end-to-end deployment for repo: ${config.githubRepo}`, type: 'success' },
      { text: `Target environment [env-${targetEnv}-01] is fully validated.`, type: 'success' }
    ] : []
  );
  const [deployedResources, setDeployedResources] = useState<any[]>(
    config.validationStatus?.pipeline?.isValidated ? [
      {
        name: `${appNameParam}-${targetEnv}`,
        type: 'App Service Web App',
        status: 'Online',
        url: `https://${appNameParam}-${targetEnv}.azurewebsites.net`,
        region: config.location
      },
      {
        name: isJangu ? `postgres-server-${targetEnv}-jangu` : `sql-server-${targetEnv}-gis`,
        type: isJangu ? 'Azure Database for PostgreSQL' : 'Azure SQL Server',
        status: 'Online',
        url: isJangu ? `postgres-server-${targetEnv}-jangu.postgres.database.azure.com` : `sql-server-${targetEnv}-gis.database.windows.net`,
        region: config.location
      }
    ] : []
  );

  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Sync templates and presets when catalogRepoUrl updates
  useEffect(() => {
    if (isJangu) {
      setSelectedTemplate('Jangu-Ecommerce-API-Service');
      setAppNameParam('api-jangu-commerce');
    } else {
      setSelectedTemplate('Azure-AppService-Sandbox');
      setAppNameParam('app-gis-ecommerce');
    }
  }, [config.catalogRepoUrl]);

  // Initialize steps
  const initSteps = (): WorkflowStep[] => [
    { id: 'runner', name: 'Set up runner & OS', duration: 2, status: config.validationStatus?.pipeline?.isValidated ? 'success' : 'idle' },
    { id: 'checkout', name: `Checkout catalog (${getRepoName(config.catalogRepoUrl)})`, duration: 2, status: config.validationStatus?.pipeline?.isValidated ? 'success' : 'idle' },
    { id: 'dotnet', name: `Setup .NET Core SDK (${dotnetVersion})`, duration: 3, status: config.validationStatus?.pipeline?.isValidated ? 'success' : 'idle' },
    { id: 'node', name: `Setup Node.js environment (${nodeVersion})`, duration: 3, status: config.validationStatus?.pipeline?.isValidated ? 'success' : 'idle' },
    { id: 'oidc', name: 'Azure OIDC login (Federated Token Exchange)', duration: 4, status: config.validationStatus?.pipeline?.isValidated ? 'success' : 'idle' },
    { id: 'kv', name: 'Fetch Key Vault parameters & secrets', duration: 3, status: config.validationStatus?.pipeline?.isValidated ? 'success' : 'idle' },
    { id: 'ade_deploy', name: 'Trigger Azure Dev Center Environment creation', duration: 6, status: config.validationStatus?.pipeline?.isValidated ? 'success' : 'idle' },
    { id: 'validate', name: 'Execute end-to-end verification tests', duration: 3, status: config.validationStatus?.pipeline?.isValidated ? 'success' : 'idle' },
  ];

  useEffect(() => {
    setSteps(initSteps());
  }, [dotnetVersion, nodeVersion, config.catalogRepoUrl]);

  // Auto-scroll logs
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const addLog = (text: string, type: 'info' | 'warning' | 'error' | 'success' | 'cmd' = 'info') => {
    setLogs(prev => [...prev, { text, type }]);
  };

  const runPipeline = async () => {
    setIsRunning(true);
    setPipelineSuccess(null);
    setDeployedResources([]);
    const freshSteps = initSteps();
    setSteps(freshSteps);
    setLogs([]);
    showToast(`Triggering CI/CD Pipeline for environment [${targetEnv.toUpperCase()}]...`, "info");

    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    addLog(`[${timestamp}] Starting GitHub Actions Run ID: 195545995655`, 'info');
    addLog(`[${timestamp}] Triggered by commit "Configure deployment pipeline for seamless infrastructure automation"`, 'info');
    addLog(`[${timestamp}] Targeting Environment: [${targetEnv.toUpperCase()}]`, 'info');

    // Step 1: Set up runner
    setActiveStepId('runner');
    updateStepStatus('runner', 'running');
    addLog(`$ Run actions/checkout@v4`, 'cmd');
    addLog(`Syncing runner OS kernel to Ubuntu 22.04 LTS...`, 'info');
    addLog(`Setting up GitHub Action Runner tools...`, 'info');
    await sleep(1500);
    updateStepStatus('runner', 'success');
    addLog(`Runner configured successfully. Host CPU: 4 Cores, RAM: 16GB.`, 'success');

    // Step 2: Checkout Code
    setActiveStepId('checkout');
    updateStepStatus('checkout', 'running');
    const repoName = getRepoName(config.catalogRepoUrl);
    addLog(`$ git clone --branch ${config.catalogBranch} ${config.catalogRepoUrl} .`, 'cmd');
    addLog(`Cloning into \'/home/runner/work/${repoName}/${repoName}\'...`, 'info');
    addLog(`Checking out git tree for repo \'${repoName}\'...`, 'info');
    await sleep(1500);
    updateStepStatus('checkout', 'success');
    addLog(`Checked out repository ${repoName}@${config.catalogBranch} successfully.`, 'success');

    // Step 2.5: Setup .NET Core SDK
    setActiveStepId('dotnet');
    updateStepStatus('dotnet', 'running');
    addLog(`$ Run actions/setup-dotnet@v5.4.0`, 'cmd');
    addLog(`  with:`, 'cmd');
    addLog(`    dotnet-version: ${dotnetVersion}`, 'cmd');
    addLog(`    cache: ${enableDotnetCache ? 'true' : 'false'}`, 'cmd');
    addLog(`Downloading and caching .NET Core SDK binaries...`, 'info');
    addLog(`Installing .NET SDK version ${dotnetVersion}...`, 'info');
    
    if (enableDotnetCache) {
      addLog(`Configuring global NuGet package caching policies...`, 'info');
      addLog(`Created NuGet global-packages cache entry successfully.`, 'info');
    }

    if (failureMode === 'dotnet') {
      await sleep(1500);
      updateStepStatus('dotnet', 'failed');
      addLog(`ERROR: Failed to resolve .NET SDK version '${dotnetVersion}'. The specified version or channel is not available.`, 'error');
      addLog(`Please verify your pipeline parameters or select an alternative SDK version.`, 'warning');
      finalizePipeline(false);
      return;
    }

    await sleep(2000);
    updateStepStatus('dotnet', 'success');
    addLog(`.NET Core SDK (v5.4.0) setup completed successfully. dotnet CLI is ready.`, 'success');

    // Step 2.6: Setup Node.js environment
    setActiveStepId('node');
    updateStepStatus('node', 'running');
    addLog(`$ Run actions/setup-node@v6.4.0`, 'cmd');
    addLog(`  with:`, 'cmd');
    addLog(`    node-version: ${nodeVersion}`, 'cmd');
    addLog(`    cache: ${nodeCache !== 'none' ? nodeCache : 'undefined'}`, 'cmd');
    addLog(`Downloading and caching Node.js binaries...`, 'info');
    addLog(`Installing Node.js version ${nodeVersion}...`, 'info');

    if (nodeCache !== 'none') {
      addLog(`Configuring global package manager caching policy for '${nodeCache}'...`, 'info');
      addLog(`Created package-manager cache directory entry successfully.`, 'info');
    }

    if (failureMode === 'node') {
      await sleep(1500);
      updateStepStatus('node', 'failed');
      addLog(`ERROR: Failed to resolve Node.js version '${nodeVersion}'. The version spec is invalid or not available in the actions tool cache.`, 'error');
      addLog(`Please check your Node.js version parameter in the settings.`, 'warning');
      finalizePipeline(false);
      return;
    }

    await sleep(2000);
    updateStepStatus('node', 'success');
    addLog(`Node.js environment (v6.4.0) setup completed successfully. node & npm are ready.`, 'success');

    // Step 3: OIDC Login
    setActiveStepId('oidc');
    updateStepStatus('oidc', 'running');
    addLog(`$ Run azure/login@v2 (Using Federated OIDC credentials)`, 'cmd');
    addLog(`Attempting OIDC authentication with Client ID: ${config.clientId}...`, 'info');
    addLog(`Requesting federated id_token from GitHub OIDC token provider...`, 'info');
    
    if (failureMode === 'oidc') {
      await sleep(1500);
      updateStepStatus('oidc', 'failed');
      addLog(`ERROR: AADSTS700213: No matching federated identity record found for the presented assertion subject 'repo:${config.githubRepo}:environment:${targetEnv}'.`, 'error');
      addLog(`Please verify your Federated Credential settings in Microsoft Entra ID.`, 'warning');
      finalizePipeline(false);
      return;
    }

    addLog(`Received OIDC token from GitHub. Handing off to Entra ID for validation...`, 'info');
    addLog(`Validating federated token audience 'api://AzureADTokenExchange'...`, 'info');
    await sleep(2000);
    updateStepStatus('oidc', 'success');
    addLog(`Successfully authenticated via OIDC. Tenant: ${config.tenantId}, Sub: ${config.subscriptionId}`, 'success');

    // Step 4: Key Vault Secrets Retrieval
    setActiveStepId('kv');
    updateStepStatus('kv', 'running');
    addLog(`$ Run azure/get-keyvault-secrets@v1`, 'cmd');
    addLog(`Connecting to Key Vault: https://${config.keyVaultName}.vault.azure.net/`, 'info');
    addLog(`Checking access policy authorization for deployment identity...`, 'info');

    if (failureMode === 'kv') {
      await sleep(1500);
      updateStepStatus('kv', 'failed');
      addLog(`ERROR: Operation 'Get' secrets is not authorized for current service principal on Vault: ${config.keyVaultName}.`, 'error');
      addLog(`Please grant 'Key Vault Secrets User' RBAC permission to your Deployment Identity!`, 'warning');
      finalizePipeline(false);
      return;
    }

    addLog(`Access policy verified. Fetching parameters...`, 'info');
    await sleep(1500);
    updateStepStatus('kv', 'success');
    addLog(`Successfully loaded secrets from Azure Key Vault.`, 'success');

    // Step 5: Azure Dev Center deployment
    setActiveStepId('ade_deploy');
    updateStepStatus('ade_deploy', 'running');
    addLog(`$ az devcenter dev environment create \\
  --devcenter-name "${config.devCenterName}" \\
  --project-name "E-Commerce-Platform" \\
  --name "env-${targetEnv}-01" \\
  --environment-type "${targetEnv.toUpperCase()}" \\
  --environment-definition-name "${selectedTemplate}" \\
  --parameters "webAppName=${appNameParam}-${targetEnv}"`, 'cmd');
    addLog(`Initiating ADE orchestration workflow inside Project 'E-Commerce-Platform'...`, 'info');
    addLog(`Azure Dev Center parsing catalog definitions from connected '${getRepoName(config.catalogRepoUrl)}'...`, 'info');
    
    if (failureMode === 'bicep') {
      await sleep(2000);
      addLog(`Compiling environment definition: ${selectedTemplate}/main.bicep...`, 'info');
      addLog(`ERROR: [main.bicep(12,24)] Syntax Error: Expected token '}' but found EOF. Compilation failed.`, 'error');
      updateStepStatus('ade_deploy', 'failed');
      finalizePipeline(false);
      return;
    }

    addLog(`Found matching environment definition '${selectedTemplate}'. Compiling Bicep templates...`, 'info');
    addLog(`Azure Resource Manager launching sandboxed deployment pipeline...`, 'info');
    addLog(`Deploying resources to Target Subscription / Resource Group: ${config.resourceGroupName}`, 'info');

    // Simulate Azure resource deployment logs
    const mockResources = isJangu ? [
      { name: `AppServicePlan-jangu-${targetEnv}`, type: 'Microsoft.Web/serverfarms' },
      { name: `${appNameParam}-${targetEnv}`, type: 'Microsoft.Web/sites' },
      { name: `postgres-server-${targetEnv}-jangu`, type: 'Microsoft.DBforPostgreSQL/flexibleServers' },
    ] : [
      { name: `AppServicePlan-gis-${targetEnv}`, type: 'Microsoft.Web/serverfarms' },
      { name: `${appNameParam}-${targetEnv}`, type: 'Microsoft.Web/sites' },
      { name: `sql-server-${targetEnv}-gis`, type: 'Microsoft.Sql/servers' },
    ];

    for (const res of mockResources) {
      await sleep(1000);
      addLog(`Deploying [${res.name}] of type [${res.type}]...`, 'info');
    }

    await sleep(1500);
    updateStepStatus('ade_deploy', 'success');
    addLog(`Azure Dev Center Environment [env-${targetEnv}-01] deployed successfully.`, 'success');

    // Step 6: Verification Tests
    setActiveStepId('validate');
    updateStepStatus('validate', 'running');
    
    const verificationUrl = isJangu ? 
      `https://${appNameParam}-${targetEnv}.azurewebsites.net/api/v1/endpoints` : 
      `https://${appNameParam}-${targetEnv}.azurewebsites.net`;

    addLog(`$ npm run test:e2e-verify -- --url "${verificationUrl}"`, 'cmd');
    addLog(`Initializing Playwright chromium headless tester...`, 'info');
    addLog(`Verifying resource health endpoint metrics...`, 'info');
    
    if (isJangu) {
      addLog(`[OK] GET /api/v1/products - Response 200 OK (24ms)`, 'success');
      addLog(`[OK] GET /api/v1/cart - Response 200 OK (18ms)`, 'success');
      addLog(`[OK] POST /api/v1/checkout - Response 200 OK (55ms)`, 'success');
    }
    
    await sleep(1500);
    updateStepStatus('validate', 'success');
    addLog(`All integrated health checks PASSED successfully!`, 'success');

    // Complete Pipeline Successfully
    finalizePipeline(true);
  };

  const finalizePipeline = (success: boolean) => {
    setIsRunning(false);
    setPipelineSuccess(success);
    setActiveStepId(null);
    
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    if (success) {
      addLog(`[${timestamp}] PIPELINE SUCCESS: Deployed environment and verified automated testing suites.`, 'success');
      showToast("CI/CD pipeline executed successfully! Target environment deployed & validated.", "success");
      
      if (updateConfig && config.validationStatus) {
        updateConfig({
          validationStatus: {
            ...config.validationStatus,
            pipeline: {
              isValidated: true,
              validatedAt: new Date().toLocaleTimeString(),
              details: `Pipeline execution passed. Target Environment [env-${targetEnv}-01] is fully operational and validated.`
            }
          }
        });
      }
      
      // Load active deployed resources widget
      setDeployedResources([
        {
          name: `${appNameParam}-${targetEnv}`,
          type: 'App Service Web App',
          status: 'Online',
          url: `https://${appNameParam}-${targetEnv}.azurewebsites.net`,
          region: config.location
        },
        {
          name: `sql-server-${targetEnv}-gis`,
          type: 'Azure SQL Server',
          status: 'Online',
          url: `sql-server-${targetEnv}-gis.database.windows.net`,
          region: config.location
        }
      ]);
    } else {
      addLog(`[${timestamp}] PIPELINE FAILED: Automation terminated due to validation errors.`, 'error');
      showToast("CI/CD pipeline failed! Please check logs for failure cause.", "error");
    }
  };

  const updateStepStatus = (id: string, status: 'idle' | 'running' | 'success' | 'failed') => {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, status } : s));
  };

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  return (
    <div className="space-y-6 animate-fade-in relative" id="pipeline-panel">

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Cpu className="h-5 w-5 text-indigo-600 animate-pulse" />
            Test the CI/CD Automation Pipeline
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Trigger a simulated end-to-end GitHub Actions workflow. See how the catalog definitions are deployed programmatically via OIDC.
          </p>
        </div>
        <button
          onClick={runPipeline}
          disabled={isRunning}
          className="flex items-center gap-2 rounded bg-slate-800 hover:bg-slate-700 px-4 py-2.5 text-xs font-bold text-white uppercase tracking-wider transition disabled:bg-slate-300 disabled:text-slate-500"
        >
          {isRunning ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Running CI/CD Job...
            </>
          ) : (
            <>
              <Play className="h-4 w-4 fill-current" />
              Trigger CI/CD Pipeline
            </>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Interactive Controls & Target selection */}
        <div className="space-y-6 lg:col-span-1">
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4 text-left">
            <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-3 uppercase tracking-wider flex items-center gap-1.5">
              <Settings className="h-4 w-4 text-slate-500" /> Pipeline Parameters
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">
                  Target GitHub Environment
                </label>
                <select
                  value={targetEnv}
                  onChange={(e) => setTargetEnv(e.target.value as any)}
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-xs text-zinc-900 bg-white focus:border-indigo-500 focus:outline-hidden capitalize"
                >
                  <option value="development">development</option>
                  <option value="testing">testing</option>
                  <option value="production">production</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">
                  Environment Catalog Template
                </label>
                <select
                  value={selectedTemplate}
                  onChange={(e) => setSelectedTemplate(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-950 bg-white focus:border-indigo-500 focus:outline-hidden transition"
                >
                  {isJangu ? (
                    <>
                      <option value="Jangu-Ecommerce-API-Service">Jangu-Ecommerce-API-Service (Python Web App)</option>
                      <option value="Jangu-Postgres-Database">Jangu-Postgres-Database (PostgreSQL)</option>
                      <option value="Jangu-Redis-Cache">Jangu-Redis-Cache (Redis Cache)</option>
                    </>
                  ) : (
                    <>
                      <option value="Azure-AppService-Sandbox">Azure-AppService-Sandbox (App Service)</option>
                      <option value="Azure-SQL-Secure-Database">Azure-SQL-Secure-Database (Azure SQL)</option>
                      <option value="Azure-Redis-Cache-Cluster">Azure-Redis-Cache-Cluster (Redis Node)</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">
                  Application Name Parameter
                </label>
                <input
                  type="text"
                  value={appNameParam}
                  onChange={(e) => setAppNameParam(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-950 bg-white focus:border-indigo-500 focus:outline-hidden font-mono transition"
                  placeholder="e.g. app-gis-portal"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">
                  .NET Core SDK Version (v5.4.0)
                </label>
                <select
                  value={dotnetVersion}
                  onChange={(e) => setDotnetVersion(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-950 bg-white focus:border-indigo-500 focus:outline-hidden transition"
                >
                  <option value="8.0.x">8.0.x (LTS - Recommended)</option>
                  <option value="9.0.x">9.0.x (Current)</option>
                  <option value="6.0.x">6.0.x (LTS)</option>
                  <option value="latest">latest (Stable)</option>
                </select>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="enableDotnetCache"
                  checked={enableDotnetCache}
                  onChange={(e) => setEnableDotnetCache(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600 cursor-pointer"
                />
                <label htmlFor="enableDotnetCache" className="text-xs font-semibold text-slate-600 cursor-pointer select-none">
                  Enable NuGet Package Cache
                </label>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">
                  Node.js SDK Version (v6.4.0)
                </label>
                <select
                  value={nodeVersion}
                  onChange={(e) => setNodeVersion(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-950 bg-white focus:border-indigo-500 focus:outline-hidden transition"
                >
                  <option value="20.x">20.x (LTS - Recommended)</option>
                  <option value="22.x">22.x (Current)</option>
                  <option value="18.x">18.x (LTS)</option>
                  <option value="package.json">package.json (Auto-detect)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">
                  Node.js Dependency Cache
                </label>
                <select
                  value={nodeCache}
                  onChange={(e) => setNodeCache(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-950 bg-white focus:border-indigo-500 focus:outline-hidden transition"
                >
                  <option value="npm">npm (Default)</option>
                  <option value="yarn">yarn</option>
                  <option value="pnpm">pnpm</option>
                  <option value="none">none (Disable caching)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Inject Failures For Learning & Validation */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4 text-left">
            <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-3 uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4 text-slate-500" /> Debugging & Failure Toggles
            </h3>
            <p className="text-[11px] text-slate-500 leading-normal">
              Simulate operational real-world errors to test OIDC trust validation and Bicep compiler error handling.
            </p>

            <div className="space-y-2">
              <label className="flex items-center gap-2.5 p-2 border border-slate-100 rounded-md hover:bg-slate-50 cursor-pointer transition">
                <input
                  type="radio"
                  name="failureMode"
                  checked={failureMode === 'none'}
                  onChange={() => setFailureMode('none')}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-600 cursor-pointer"
                />
                <span className="text-xs font-semibold text-slate-700">No failures (Optimal Pipeline)</span>
              </label>

              <label className="flex items-center gap-2.5 p-2 border border-slate-100 rounded-md hover:bg-slate-50 cursor-pointer text-rose-700 transition">
                <input
                  type="radio"
                  name="failureMode"
                  checked={failureMode === 'dotnet'}
                  onChange={() => setFailureMode('dotnet')}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-600 cursor-pointer"
                />
                <span className="text-xs font-bold">.NET Core SDK Resolve Failure</span>
              </label>

              <label className="flex items-center gap-2.5 p-2 border border-slate-100 rounded-md hover:bg-slate-50 cursor-pointer text-rose-700 transition">
                <input
                  type="radio"
                  name="failureMode"
                  checked={failureMode === 'node'}
                  onChange={() => setFailureMode('node')}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-600 cursor-pointer"
                />
                <span className="text-xs font-bold">Node.js Environment Setup Failure</span>
              </label>

              <label className="flex items-center gap-2.5 p-2 border border-slate-100 rounded-md hover:bg-slate-50 cursor-pointer text-rose-700 transition">
                <input
                  type="radio"
                  name="failureMode"
                  checked={failureMode === 'oidc'}
                  onChange={() => setFailureMode('oidc')}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-600 cursor-pointer"
                />
                <span className="text-xs font-bold">OIDC Auth Trust Failure</span>
              </label>

              <label className="flex items-center gap-2.5 p-2 border border-slate-100 rounded-md hover:bg-slate-50 cursor-pointer text-rose-700 transition">
                <input
                  type="radio"
                  name="failureMode"
                  checked={failureMode === 'kv'}
                  onChange={() => setFailureMode('kv')}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-600 cursor-pointer"
                />
                <span className="text-xs font-bold">Key Vault Secrets Auth Failure</span>
              </label>

              <label className="flex items-center gap-2.5 p-2 border border-slate-100 rounded-md hover:bg-slate-50 cursor-pointer text-rose-700 transition">
                <input
                  type="radio"
                  name="failureMode"
                  checked={failureMode === 'bicep'}
                  onChange={() => setFailureMode('bicep')}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-600 cursor-pointer"
                />
                <span className="text-xs font-bold">Bicep Syntax Compile Failure</span>
              </label>
            </div>
          </div>
        </div>

        {/* Workflow steps and log console */}
        <div className="lg:col-span-2 space-y-6">
          {/* Workflow Steps Visual Progress */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 text-left">Pipeline Execution Steps</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-left">
              {steps.map((step) => (
                <div
                  key={step.id}
                  className={`flex items-center justify-between p-3 rounded-lg border text-xs transition-colors ${
                    step.status === 'running'
                      ? 'bg-indigo-50/50 border-indigo-200 text-indigo-900 font-bold animate-pulse'
                      : step.status === 'success'
                      ? 'bg-emerald-50/40 border-emerald-100 text-emerald-950 font-bold'
                      : step.status === 'failed'
                      ? 'bg-rose-50/40 border-rose-100 text-rose-950 font-bold'
                      : 'bg-slate-50 border-slate-100 text-slate-500'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold">
                    {step.status === 'running' && <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />}
                    {step.status === 'success' && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                    {step.status === 'failed' && <XCircle className="h-4 w-4 text-rose-600" />}
                    {step.status === 'idle' && <span className="h-4 w-4 rounded-full border-2 border-slate-300"></span>}
                    <span>{step.name}</span>
                  </div>
                  {step.status === 'success' && (
                    <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-bold uppercase">
                      Done
                    </span>
                  )}
                  {step.status === 'failed' && (
                    <span className="text-[10px] font-mono text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded font-bold uppercase font-bold">
                      Error
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Terminal Logs Console */}
          <div className="flex flex-col bg-slate-950 rounded-xl border border-slate-800 shadow-xl h-[450px] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-800 text-slate-400">
              <span className="text-xs font-bold font-mono uppercase tracking-wider flex items-center gap-1.5 text-slate-300">
                <Terminal className="h-4 w-4 text-indigo-400 animate-pulse" /> GitHub Runner Console logs
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono bg-slate-800 px-2 py-0.5 rounded text-slate-300 uppercase font-bold">
                  UTC RUNNER
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-4 font-mono text-xs leading-normal space-y-1.5 text-left bg-slate-950 text-slate-200 scrollbar-thin">
              {logs.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-600 text-xs italic">
                  Pipeline idle. Click "Trigger CI/CD Pipeline" to start.
                </div>
              ) : (
                logs.map((log, i) => (
                  <div
                    key={i}
                    className={`${
                      log.type === 'cmd'
                        ? 'text-indigo-400 font-bold'
                        : log.type === 'success'
                        ? 'text-emerald-400'
                        : log.type === 'warning'
                        ? 'text-amber-500'
                        : log.type === 'error'
                        ? 'text-rose-400 font-bold'
                        : 'text-slate-300'
                    }`}
                  >
                    {log.text}
                  </div>
                ))
              )}
              <div ref={terminalEndRef}></div>
            </div>
          </div>

          {/* Active Deployed Resources Panel */}
          {pipelineSuccess === true && deployedResources.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-left space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-amber-400" /> Live Deployed Resources
                </h4>
                <span className="text-[10px] text-emerald-400 bg-emerald-950 border border-emerald-900 px-2 py-0.5 rounded font-mono font-bold uppercase">
                  ACTIVE
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {deployedResources.map((res) => (
                  <div key={res.name} className="bg-zinc-950 p-4 border border-zinc-800 rounded-lg space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <h5 className="text-xs font-semibold text-white font-mono">{res.name}</h5>
                        <p className="text-[11px] text-zinc-400 mt-0.5">{res.type}</p>
                      </div>
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping"></span>
                    </div>

                    <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-[11px]">
                      <span className="text-slate-500 font-mono">Location: {res.region.toUpperCase()}</span>
                      {res.url.startsWith('http') ? (
                        <a
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            showToast(`Hi-Fi Simulation: Navigating to Web App at ${res.url}`, "info");
                          }}
                          className="text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-0.5"
                        >
                          Visit App <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span className="text-slate-400 font-mono text-[10px]">{res.url}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
