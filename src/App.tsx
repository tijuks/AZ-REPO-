import React, { useState } from 'react';
import { AzureConfig } from './types';
import DevCenterSetup from './components/DevCenterSetup';
import KeyVaultSetup from './components/KeyVaultSetup';
import CatalogSetup from './components/CatalogSetup';
import DeploymentIdentities from './components/DeploymentIdentities';
import GitHubEnvironments from './components/GitHubEnvironments';
import PipelineSimulator from './components/PipelineSimulator';
import CodeExport from './components/CodeExport';
import { 
  Building2, 
  Key, 
  FolderGit2, 
  ShieldCheck, 
  Github, 
  Cpu, 
  FileCode, 
  Settings, 
  Cloud, 
  CheckCircle2, 
  Lock, 
  ExternalLink,
  ChevronRight,
  Menu,
  X
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('devcenter');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Global infrastructure config state shared across setups
  const [config, setConfig] = useState<AzureConfig>({
    subscriptionId: 'd6bca7f3-e5d0-4a81-9b7e-976a445cb474',
    resourceGroupName: 'rg-enterprise-ade',
    location: 'eastus2',
    devCenterName: 'gis-devcenter-prod',
    keyVaultName: 'gis-keyvault-secure',
    catalogRepoUrl: 'https://github.com/Global-Information-Systems/az-repo',
    catalogBranch: 'main',
    catalogPath: '/Environment-Definitions',
    githubRepo: 'Global-Information-Systems/az-repo',
    useOidc: true,
    tenantId: '72f988bf-86f1-41af-91ab-2d7cd011db47',
    clientId: 'b9e72f9c-07f1-4f11-92ab-6d7cd512db80',
    clientSecret: '',
    validationStatus: {
      devcenter: { isValidated: false, details: 'Dev Center resources not yet provisioned' },
      keyvault: { isValidated: false, details: 'Key Vault and secrets not yet deployed' },
      catalog: { isValidated: false, details: 'Infrastructure catalog not yet synchronized' },
      identities: { isValidated: false, details: 'OIDC Trust & RBAC role assignments not yet established' },
      environments: { isValidated: false, details: 'GitHub Environment secrets & rules not yet configured' },
      pipeline: { isValidated: false, details: 'CI/CD deployment pipeline has not been tested' },
      export: { isValidated: false, details: 'Bicep templates & setup guides not yet exported' }
    }
  });

  const updateConfig = (updates: Partial<AzureConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  };

  const steps = [
    { id: 'devcenter', label: '1. Create Dev Center', icon: Building2, desc: 'Central governance & env types' },
    { id: 'keyvault', label: '2. Create Key Vault', icon: Key, desc: 'Secure secrets HSM storage' },
    { id: 'catalog', label: '3. Connect Catalog', icon: FolderGit2, desc: 'Import template repository' },
    { id: 'identities', label: '4. Configure Identities', icon: ShieldCheck, desc: 'OIDC Federated Trust auth' },
    { id: 'environments', label: '5. Setup Environments', icon: Github, desc: 'CI/CD gates & secrets mapping' },
    { id: 'pipeline', label: '6. Test CI/CD Pipeline', icon: Cpu, desc: 'End-to-end automation test' },
    { id: 'export', label: '7. Export Code & Guides', icon: FileCode, desc: 'Bicep templates & scripts' }
  ];

  const handleStepComplete = (nextStepId: string) => {
    setActiveTab(nextStepId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans flex flex-col antialiased">
      {/* Header Bar */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-xs shrink-0 sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="lg:hidden p-1.5 rounded-md text-slate-500 hover:text-slate-900 focus:outline-hidden"
          >
            {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
          
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded flex items-center justify-center shrink-0 shadow-xs">
              <Cloud className="h-4 w-4 text-white animate-pulse" />
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-extrabold text-slate-800 uppercase tracking-tight leading-none">
                Azure & GitHub DevOps Automation Hub
              </h1>
              <p className="text-[11px] text-slate-500 font-medium mt-1">
                Infrastructure Provisioning Lifecycle & CI/CD Pipeline Standard
              </p>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-100 text-xs font-bold">
            <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
            <span>System Status: Optimal</span>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono">
          {/* Azure Status badge */}
          <div className="hidden sm:flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-md border border-slate-200">
            <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
            <span className="text-slate-500 font-medium">Azure Sub:</span>
            <span className="text-slate-800 font-bold">{config.subscriptionId.substring(0, 8)}...</span>
          </div>

          {/* GitHub Repo badge */}
          <div className="hidden lg:flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-md border border-slate-200">
            <Github className="h-3.5 w-3.5 text-slate-500" />
            <span className="text-slate-500 font-medium">Bound Repo:</span>
            <span className="text-slate-800 font-bold truncate max-w-[150px]">{config.githubRepo}</span>
          </div>
        </div>
      </header>

      {/* Main layout container */}
      <div className="flex-1 flex flex-col lg:flex-row relative">
        {/* Sidebar / Steps navigation for Desktop */}
        <aside className="hidden lg:flex w-72 bg-slate-900 text-slate-400 border-r border-slate-800 shrink-0 h-[calc(100vh-4.5rem)] sticky top-[72px] flex-col justify-between p-4 overflow-y-auto">
          <div className="space-y-4">
            <div className="px-3 py-1 border-b border-slate-800">
              <h3 className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">Deployment Lifecycle</h3>
              <p className="text-[10px] text-slate-500 mt-1">Configure and validate cloud infrastructure step-by-step.</p>
            </div>
            <nav className="space-y-1">
              {steps.map((step) => {
                const Icon = step.icon;
                const isActive = activeTab === step.id;
                const valInfo = config.validationStatus?.[step.id as keyof typeof config.validationStatus];
                const isValidated = valInfo?.isValidated;
                return (
                  <button
                    key={step.id}
                    onClick={() => setActiveTab(step.id)}
                    title={isValidated ? `Validated at ${valInfo?.validatedAt}: ${valInfo?.details}` : `Not yet validated: ${valInfo?.details}`}
                    className={`w-full flex items-start gap-3 p-3 rounded-lg text-left transition-colors relative group ${
                      isActive 
                        ? 'bg-slate-800 text-white border-l-4 border-indigo-500 shadow-xs' 
                        : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
                    }`}
                  >
                    <Icon className={`h-4.5 w-4.5 shrink-0 mt-0.5 ${isActive ? 'text-indigo-400' : 'text-slate-500'}`} />
                    <div className="flex-1 min-w-0 pr-4">
                      <span className="block text-xs font-bold leading-tight truncate">{step.label}</span>
                      <span className="block text-[10px] text-slate-500 mt-0.5 truncate">{step.desc}</span>
                    </div>
                    {isValidated && (
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 p-0.5 rounded-full" title={`Validated: ${valInfo?.details}`}>
                        <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="mt-auto pt-6 border-t border-slate-800">
            <div className="bg-indigo-950/40 p-4 rounded-lg border border-indigo-500/30">
              <div className="text-[10px] uppercase font-bold text-indigo-300 mb-1 tracking-wider">Active GitHub Repository</div>
              <div className="text-xs text-white font-mono break-all leading-tight">{config.githubRepo}</div>
            </div>
          </div>
        </aside>

        {/* Sidebar / Steps navigation for Mobile Drawer */}
        {isMobileMenuOpen && (
          <div className="lg:hidden fixed inset-0 z-40 flex">
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={() => setIsMobileMenuOpen(false)}></div>
            <div className="relative flex-1 flex flex-col max-w-xs w-full bg-slate-900 text-slate-400 pt-5 pb-4">
              <div className="absolute top-0 right-0 -mr-12 pt-2">
                <button
                  type="button"
                  className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-hidden focus:ring-2 focus:ring-inset focus:ring-white"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <X className="h-6 w-6 text-white" />
                </button>
              </div>
              <div className="px-4 pb-4 border-b border-slate-800">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Deployment lifecycle</h3>
              </div>
              <nav className="mt-4 flex-1 px-2 space-y-1 overflow-y-auto">
                {steps.map((step) => {
                  const Icon = step.icon;
                  const isActive = activeTab === step.id;
                  const valInfo = config.validationStatus?.[step.id as keyof typeof config.validationStatus];
                  const isValidated = valInfo?.isValidated;
                  return (
                    <button
                      key={step.id}
                      onClick={() => {
                        setActiveTab(step.id);
                        setIsMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-start gap-3 p-3 rounded-lg text-left transition relative ${
                        isActive 
                          ? 'bg-slate-800 text-white border-l-4 border-indigo-500' 
                          : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${isActive ? 'text-indigo-400' : 'text-slate-500'}`} />
                      <div className="flex-1 min-w-0 pr-6">
                        <span className="block text-xs font-bold leading-tight truncate">{step.label}</span>
                        <span className="block text-[10px] text-slate-500 mt-0.5 truncate">{step.desc}</span>
                      </div>
                      {isValidated && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 p-0.5 rounded-full">
                          <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>
        )}

        {/* Content Area & Footer container */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto bg-slate-50">
            <div className="max-w-7xl mx-auto">
              {activeTab === 'devcenter' && (
                <DevCenterSetup 
                  config={config} 
                  updateConfig={updateConfig} 
                  onComplete={() => handleStepComplete('keyvault')} 
                />
              )}
              {activeTab === 'keyvault' && (
                <KeyVaultSetup 
                  config={config} 
                  updateConfig={updateConfig} 
                  onComplete={() => handleStepComplete('catalog')} 
                />
              )}
              {activeTab === 'catalog' && (
                <CatalogSetup 
                  config={config} 
                  updateConfig={updateConfig} 
                  onComplete={() => handleStepComplete('identities')} 
                />
              )}
              {activeTab === 'identities' && (
                <DeploymentIdentities 
                  config={config} 
                  updateConfig={updateConfig} 
                  onComplete={() => handleStepComplete('environments')} 
                />
              )}
              {activeTab === 'environments' && (
                <GitHubEnvironments 
                  config={config} 
                  updateConfig={updateConfig} 
                  onComplete={() => handleStepComplete('pipeline')} 
                />
              )}
              {activeTab === 'pipeline' && (
                <PipelineSimulator 
                  config={config} 
                  updateConfig={updateConfig}
                />
              )}
              {activeTab === 'export' && (
                <CodeExport 
                  config={config} 
                  updateConfig={updateConfig}
                />
              )}
            </div>
          </main>

          {/* Footer Status Bar */}
          <footer className="bg-slate-100 border-t border-slate-200 px-6 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-2 z-10 shrink-0">
            <div className="flex flex-wrap gap-4 sm:gap-6">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Resource Group:</span>
                <span className="text-[10px] font-mono font-bold text-slate-700">{config.resourceGroupName}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Default Location:</span>
                <span className="text-[10px] font-mono font-bold text-slate-700">{config.location.toUpperCase()}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">API Version:</span>
                <span className="text-[10px] font-mono font-bold text-slate-700">2023-11-01</span>
              </div>
            </div>
            <div className="text-[10px] text-slate-400 font-semibold italic">
              Last synced via Azure & GitHub Pipeline Runner
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
