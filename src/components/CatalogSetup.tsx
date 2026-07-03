import React, { useState, useEffect } from 'react';
import { AzureConfig, EnvironmentDefinition } from '../types';
import { useToast } from './ToastContext';
import { 
  GitBranch, 
  Copy, 
  Check, 
  Terminal, 
  RotateCw, 
  FolderGit2, 
  FileCode2, 
  CheckCircle,
  Loader2,
  Info,
  HelpCircle,
  ChevronRight
} from 'lucide-react';

interface CatalogSetupProps {
  config: AzureConfig;
  updateConfig: (updates: Partial<AzureConfig>) => void;
  onComplete: () => void;
}

export default function CatalogSetup({ config, updateConfig, onComplete }: CatalogSetupProps) {
  const { showToast } = useToast();
  const [copied, setCopied] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string>('');
  const [isSynced, setIsSynced] = useState(config.validationStatus?.catalog?.isValidated || false);
  const [catalogName, setCatalogName] = useState('GIS-ADE-Catalog');

  // Simulated parsed environment definitions from the github repo
  const [parsedTemplates, setParsedTemplates] = useState<EnvironmentDefinition[]>([]);

  // Load parsed templates on mount if already synced/validated
  useEffect(() => {
    if (config.validationStatus?.catalog?.isValidated) {
      const isJangu = config.catalogRepoUrl.toLowerCase().includes('jangu');
      if (isJangu) {
        setParsedTemplates([
          {
            name: 'Jangu-Ecommerce-API-Service',
            templatePath: 'api/jangu-service.bicep',
            description: 'Deploys a Python-based App Service Web App serving the Jangu e-commerce REST API endpoints.',
            parameters: [
              { name: 'webAppName', type: 'string', defaultValue: 'api-jangu-commerce', description: 'Globally unique name for the Jangu API app service' },
              { name: 'pythonVersion', type: 'string', defaultValue: '3.11', description: 'Python platform version to deploy' },
              { name: 'allowedOrigins', type: 'string', defaultValue: '*', description: 'CORS origins allowed to query the API endpoints' }
            ]
          },
          {
            name: 'Jangu-Postgres-Database',
            templatePath: 'db/postgres-flexible.bicep',
            description: 'Deploys an Azure Database for PostgreSQL flexible server to store Jangu e-commerce catalog and cart data.',
            parameters: [
              { name: 'dbAdminUser', type: 'string', defaultValue: 'janguadmin', description: 'Database administrator login credentials' },
              { name: 'dbSku', type: 'string', defaultValue: 'Standard_D2s_v3', description: 'Performance and sizing SKU for the PostgreSQL server' }
            ]
          },
          {
            name: 'Jangu-Redis-Cache',
            templatePath: 'cache/redis-cluster.bicep',
            description: 'Provisions an Azure Cache for Redis to store e-commerce product catalogs and user sessions.',
            parameters: [
              { name: 'redisSku', type: 'string', defaultValue: 'C0', description: 'Pricing capacity tier of the Redis cache' }
            ]
          }
        ]);
      } else {
        setParsedTemplates([
          {
            name: 'Azure-AppService-Sandbox',
            templatePath: 'Environment-Definitions/Azure-AppService-Sandbox/main.bicep',
            description: 'Deploys an isolated Linux App Service Web App, associated staging slot, and App Service Plan.',
            parameters: [
              { name: 'webAppName', type: 'string', defaultValue: 'app-sandbox-unique', description: 'Globally unique name for the web application' },
              { name: 'skuName', type: 'string', defaultValue: 'F1', description: 'The pricing pricing tier / sizing SKU of the app service plan' }
            ]
          },
          {
            name: 'Azure-SQL-Secure-Database',
            templatePath: 'Environment-Definitions/Azure-SQL-Secure-Database/main.bicep',
            description: 'Creates a fully encrypted Azure SQL Logical Server, Database, and firewall access policies.',
            parameters: [
              { name: 'dbAdminUser', type: 'string', defaultValue: 'dbadmin', description: 'The administrator login username for SQL server' },
              { name: 'dbSku', type: 'string', defaultValue: 'Basic', description: 'Performance pool or instance capacity size' }
            ]
          },
          {
            name: 'Azure-Redis-Cache-Cluster',
            templatePath: 'Environment-Definitions/Azure-Redis-Cache-Cluster/main.bicep',
            description: 'Provisions an Azure Cache for Redis cluster with automatic backup and Key Vault parameter injection.',
            parameters: [
              { name: 'redisSku', type: 'string', defaultValue: 'C0', description: 'Sizing configuration tier for the Redis node' }
            ]
          }
        ]);
      }
    }
  }, [config.validationStatus?.catalog?.isValidated, config.catalogRepoUrl]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    showToast("Catalog provisioning script copied to clipboard!", "success");
    setTimeout(() => setCopied(null), 2000);
  };

  // CLI command to connect Catalog to Azure Dev Center
  const cliScript = `# Register the GitHub catalog repository in Azure Dev Center
# We reference the GITHUB-PAT secret stored securely in Key Vault for authentication
az devcenter admin catalog create \\
  --name "${catalogName}" \\
  --devcenter-name "${config.devCenterName}" \\
  --resource-group "${config.resourceGroupName}" \\
  --git-hub-uri "${config.catalogRepoUrl}" \\
  --git-hub-branch "${config.catalogBranch}" \\
  --git-hub-path "${config.catalogPath}" \\
  --git-hub-secret-identifier "https://${config.keyVaultName}.vault.azure.net/secrets/GITHUB-PAT"

# Optional: Manually trigger an immediate Catalog Sync
az devcenter admin catalog sync \\
  --name "${catalogName}" \\
  --devcenter-name "${config.devCenterName}" \\
  --resource-group "${config.resourceGroupName}"`;

  // Bicep to connect Catalog
  const bicepScript = `// Bicep catalog connection
param devCenterName string = '${config.devCenterName}'
param catalogName string = '${catalogName}'
param catalogRepoUrl string = '${config.catalogRepoUrl}'
param catalogBranch string = '${config.catalogBranch}'
param catalogPath string = '${config.catalogPath}'
param keyVaultSecretUri string = 'https://${config.keyVaultName}.vault.azure.net/secrets/GITHUB-PAT'

resource devCenter 'Microsoft.DevCenter/devcenters@2023-04-01' existing = {
  name: devCenterName
}

resource catalog 'Microsoft.DevCenter/devcenters/catalogs@2023-04-01' = {
  parent: devCenter
  name: catalogName
  properties: {
    gitHub: {
      uri: catalogRepoUrl
      branch: catalogBranch
      path: catalogPath
      secretIdentifier: keyVaultSecretUri
    }
  }
}`;

  const handleSyncCatalog = async () => {
    setIsSyncing(true);
    setSyncStatus('Initiating GitHub API handshakes with repository...');
    showToast(`Connecting to Catalog repository: ${config.catalogRepoUrl}...`, "info");
    
    const isJangu = config.catalogRepoUrl.toLowerCase().includes('jangu');
    const repoUrl = config.catalogRepoUrl;
    
    const steps = isJangu ? [
      { msg: `Connecting to ${repoUrl}...`, delay: 1000 },
      { msg: 'Authenticating with GITHUB-PAT key retrieved from Key Vault...', delay: 1000 },
      { msg: 'Scanning repository tree for Python structure and Bicep infrastructure...', delay: 1200 },
      { msg: 'Found "jangu" py-lib package. Parsing setup.py and e-commerce api endpoints...', delay: 1200 },
      { msg: 'Catalog synchronization for Jangu E-commerce API completed successfully!', delay: 800 }
    ] : [
      { msg: `Connecting to ${repoUrl}...`, delay: 1000 },
      { msg: 'Authenticating with GITHUB-PAT key retrieved from Key Vault...', delay: 1000 },
      { msg: `Scanning repository tree at branch "${config.catalogBranch}" in directory "${config.catalogPath}"...`, delay: 1200 },
      { msg: 'Parsing environment manifest files [manifest.yaml] and checking Bicep parameters...', delay: 1200 },
      { msg: 'Catalog synchronization completed successfully!', delay: 800 }
    ];

    for (const step of steps) {
      await new Promise(resolve => setTimeout(resolve, step.delay));
      setSyncStatus(step.msg);
    }

    if (isJangu) {
      // Load Jangu e-commerce API templates
      setParsedTemplates([
        {
          name: 'Jangu-Ecommerce-API-Service',
          templatePath: 'api/jangu-service.bicep',
          description: 'Deploys a Python-based App Service Web App serving the Jangu e-commerce REST API endpoints.',
          parameters: [
            { name: 'webAppName', type: 'string', defaultValue: 'api-jangu-commerce', description: 'Globally unique name for the Jangu API app service' },
            { name: 'pythonVersion', type: 'string', defaultValue: '3.11', description: 'Python platform version to deploy' },
            { name: 'allowedOrigins', type: 'string', defaultValue: '*', description: 'CORS origins allowed to query the API endpoints' }
          ]
        },
        {
          name: 'Jangu-Postgres-Database',
          templatePath: 'db/postgres-flexible.bicep',
          description: 'Deploys an Azure Database for PostgreSQL flexible server to store Jangu e-commerce catalog and cart data.',
          parameters: [
            { name: 'dbAdminUser', type: 'string', defaultValue: 'janguadmin', description: 'Database administrator login credentials' },
            { name: 'dbSku', type: 'string', defaultValue: 'Standard_D2s_v3', description: 'Performance and sizing SKU for the PostgreSQL server' }
          ]
        },
        {
          name: 'Jangu-Redis-Cache',
          templatePath: 'cache/redis-cluster.bicep',
          description: 'Provisions an Azure Cache for Redis to store e-commerce product catalogs and user sessions.',
          parameters: [
            { name: 'redisSku', type: 'string', defaultValue: 'C0', description: 'Pricing capacity tier of the Redis cache' }
          ]
        }
      ]);
    } else {
      // Load parsed templates representing Global-Information-Systems/az-repo
      setParsedTemplates([
        {
          name: 'Azure-AppService-Sandbox',
          templatePath: 'Environment-Definitions/Azure-AppService-Sandbox/main.bicep',
          description: 'Deploys an isolated Linux App Service Web App, associated staging slot, and App Service Plan.',
          parameters: [
            { name: 'webAppName', type: 'string', defaultValue: 'app-sandbox-unique', description: 'Globally unique name for the web application' },
            { name: 'skuName', type: 'string', defaultValue: 'F1', description: 'The pricing pricing tier / sizing SKU of the app service plan' }
          ]
        },
        {
          name: 'Azure-SQL-Secure-Database',
          templatePath: 'Environment-Definitions/Azure-SQL-Secure-Database/main.bicep',
          description: 'Creates a fully encrypted Azure SQL Logical Server, Database, and firewall access policies.',
          parameters: [
            { name: 'dbAdminUser', type: 'string', defaultValue: 'dbadmin', description: 'The administrator login username for SQL server' },
            { name: 'dbSku', type: 'string', defaultValue: 'Basic', description: 'Performance pool or instance capacity size' }
          ]
        },
        {
          name: 'Azure-Redis-Cache-Cluster',
          templatePath: 'Environment-Definitions/Azure-Redis-Cache-Cluster/main.bicep',
          description: 'Provisions an Azure Cache for Redis cluster with automatic backup and Key Vault parameter injection.',
          parameters: [
            { name: 'redisSku', type: 'string', defaultValue: 'C0', description: 'Sizing configuration tier for the Redis node' }
          ]
        }
      ]);
    }

    setIsSyncing(false);
    setIsSynced(true);
    showToast(`Environment Catalog synchronized successfully!`, "success");
    if (config.validationStatus) {
      updateConfig({
        validationStatus: {
          ...config.validationStatus,
          catalog: {
            isValidated: true,
            validatedAt: new Date().toLocaleTimeString(),
            details: `Catalog synchronized. Registered repository [${config.catalogRepoUrl}] containing ${isJangu ? 3 : 3} infrastructure templates.`
          }
        }
      });
    }
  };

  return (
    <div className="space-y-6" id="catalog-panel">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <FolderGit2 className="h-5 w-5 text-indigo-600" />
            Connect Catalog to Dev Center
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Map your GitHub repository <code className="font-mono text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded">Global-Information-Systems/az-repo</code> containing infrastructure Bicep definitions to Azure Dev Center.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isSynced && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 border border-emerald-100">
              <CheckCircle className="h-3.5 w-3.5 text-emerald-500" /> Catalogs Synced
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
        {/* Repository Import Details */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-3 flex items-center gap-2">
              <GitBranch className="h-4.5 w-4.5 text-slate-500" /> Git Repository Settings
            </h3>

            <div className="space-y-4">
              {/* Preset Selector */}
              <div className="p-3 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-widest block">Featured Repository Preset</span>
                  <span className="text-[10px] bg-indigo-100 text-indigo-800 font-bold px-1.5 py-0.5 rounded font-mono">Python API</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">Jangu E-Commerce API (tijuks/jangu)</h4>
                    <p className="text-[10px] text-slate-500">Auto-provisions e-commerce endpoints with high-performance python handlers.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setCatalogName('Jangu-Ecommerce-Catalog');
                      updateConfig({
                        catalogRepoUrl: 'https://github.com/tijuks/jangu',
                        catalogBranch: 'main',
                        catalogPath: '/',
                        githubRepo: 'tijuks/jangu'
                      });
                    }}
                    className="shrink-0 px-2.5 py-1 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded transition flex items-center gap-1 shadow-xs"
                  >
                    Import Jangu
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">
                  Catalog Display Name
                </label>
                <input
                  type="text"
                  value={catalogName}
                  onChange={(e) => setCatalogName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-950 bg-white focus:border-indigo-500 focus:outline-hidden transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">
                  Catalog Repository Link
                </label>
                <input
                  type="text"
                  value={config.catalogRepoUrl}
                  onChange={(e) => {
                    const url = e.target.value;
                    let githubRepo = config.githubRepo;
                    try {
                      const cleaned = url.replace(/https?:\/\/github\.com\//i, '');
                      const parts = cleaned.split('/');
                      if (parts.length >= 2) {
                        githubRepo = `${parts[0]}/${parts[1]}`.trim();
                      }
                    } catch {}
                    updateConfig({ catalogRepoUrl: url, githubRepo });
                  }}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-950 bg-slate-50 font-mono focus:border-indigo-500 focus:outline-hidden transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">
                    Branch Name
                  </label>
                  <input
                    type="text"
                    value={config.catalogBranch}
                    onChange={(e) => updateConfig({ catalogBranch: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-950 bg-white font-mono focus:border-indigo-500 focus:outline-hidden transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">
                    Environment Path
                  </label>
                  <input
                    type="text"
                    value={config.catalogPath}
                    onChange={(e) => updateConfig({ catalogPath: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-950 bg-white font-mono focus:border-indigo-500 focus:outline-hidden transition"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Sync Button & Simulator */}
          <div className="bg-slate-900 rounded-xl p-5 border border-slate-800 text-slate-200 space-y-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <RotateCw className={`h-4 w-4 text-indigo-400 ${isSyncing ? 'animate-spin' : ''}`} />
                <span className="text-xs font-bold uppercase tracking-wider text-white">Catalog Synchronization simulator</span>
              </div>
              <button
                onClick={handleSyncCatalog}
                disabled={isSyncing}
                className="flex items-center gap-1.5 rounded bg-indigo-600 hover:bg-indigo-500 px-3.5 py-1.5 text-xs font-bold text-white uppercase tracking-wider transition disabled:bg-slate-800 disabled:text-slate-500"
              >
                {isSyncing ? (
                  <>
                    <Loader2 className="h-3 w-3.5 animate-spin" /> Syncing...
                  </>
                ) : (
                  'Sync Catalog Now'
                )}
              </button>
            </div>

            {isSyncing || syncStatus ? (
              <div className="p-3 bg-slate-950 rounded border border-slate-800 font-mono text-xs text-indigo-300 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-indigo-400 animate-ping"></span>
                  <span>{syncStatus}</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400">
                Trigger synchronization to import template infrastructure layouts directly from the repository.
              </p>
            )}

            {isSynced && parsedTemplates.length > 0 && (
              <div className="space-y-3 pt-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Discovered Environment Definitions ({parsedTemplates.length})
                </span>
                <div className="space-y-2">
                  {parsedTemplates.map((tpl) => (
                    <div key={tpl.name} className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-2 text-left">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="text-xs font-bold text-white flex items-center gap-1">
                            <FileCode2 className="h-3.5 w-3.5 text-indigo-400" />
                            {tpl.name}
                          </h4>
                          <p className="text-[11px] text-slate-400 mt-1">{tpl.description}</p>
                        </div>
                        <span className="text-[9px] bg-indigo-950 border border-indigo-900 text-indigo-300 px-1.5 py-0.5 rounded font-mono">
                          Bicep
                        </span>
                      </div>

                      <div className="pt-2 border-t border-slate-800 flex flex-wrap gap-2">
                        {tpl.parameters.map((param) => (
                          <span key={param.name} className="text-[10px] font-mono bg-slate-900 text-slate-400 px-2 py-0.5 rounded border border-slate-800">
                            {param.name}: <span className="text-amber-500">{param.type}</span> (default: {param.defaultValue})
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Dynamic CLI Config Code Block */}
        <div className="flex flex-col bg-slate-950 rounded-xl border border-slate-800 overflow-hidden shadow-lg h-[650px]">
          <div className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">Catalog Connection Script</span>
            <button
              onClick={() => copyToClipboard(cliScript, 'cli')}
              className="text-slate-400 hover:text-white p-1.5 rounded hover:bg-slate-800 transition"
              title="Copy code"
            >
              {copied === 'cli' ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>

          <div className="flex-1 overflow-auto p-4 font-mono text-xs text-slate-300 leading-relaxed scrollbar-thin">
            <pre>{cliScript}</pre>
          </div>

          <div className="bg-slate-900 p-4 border-t border-slate-800 flex items-start gap-2.5 text-xs text-slate-400 leading-normal">
            <Info className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="text-slate-300 font-bold block">How Catalogs Sync:</span>
              <span>Azure Dev Center periodically polls your linked Git repo for files named <code className="font-mono text-slate-200">manifest.yaml</code> and associated IAC templates, rendering them dynamically inside developers' deployment sandboxes.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
