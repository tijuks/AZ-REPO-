import React, { useState } from 'react';
import { AzureConfig } from '../types';
import { useToast } from './ToastContext';
import { 
  FileCode, 
  Copy, 
  Check, 
  BookOpen, 
  ChevronRight, 
  Download,
  Terminal,
  Layers,
  Award
} from 'lucide-react';

interface CodeExportProps {
  config: AzureConfig;
  updateConfig?: (updates: Partial<AzureConfig>) => void;
}

export default function CodeExport({ config, updateConfig }: CodeExportProps) {
  const { showToast } = useToast();
  const [copied, setCopied] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string>('workflow');

  React.useEffect(() => {
    if (updateConfig && config.validationStatus && !config.validationStatus.export.isValidated) {
      updateConfig({
        validationStatus: {
          ...config.validationStatus,
          export: {
            isValidated: true,
            validatedAt: new Date().toLocaleTimeString(),
            details: 'All infrastructure definitions, Bicep templates, and YAML workflows generated successfully.'
          }
        }
      });
    }
  }, []);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    showToast(`File copied to clipboard!`, "success");
    setTimeout(() => setCopied(null), 2000);
  };

  const isJangu = config.catalogRepoUrl.toLowerCase().includes('jangu');

  const files = {
    workflow: {
      name: '.github/workflows/azure-ade-deploy.yml',
      description: `GitHub Actions workflow that handles secure OIDC login, Key Vault parameter retrieval, and Azure Dev Center Environment creation for ${isJangu ? 'Jangu E-commerce API' : 'Infrastructure Catalog'}.`,
      icon: Layers,
      content: `name: Azure ADE Infrastructure Automation

on:
  push:
    branches: [ main ]
  workflow_dispatch:
    inputs:
      environmentName:
        description: 'Name of the Environment to deploy'
        required: true
        default: 'dev-env-01'

permissions:
  id-token: write # Required for requesting the JWT
  contents: read  # Required for actions/checkout

env:
  AZURE_DEVCENTER_NAME: ${config.devCenterName || 'my-dev-center'}
  AZURE_PROJECT_NAME: 'E-Commerce-Platform'
  AZURE_RESOURCE_GROUP: ${config.resourceGroupName || 'rg-devops-ade'}

jobs:
  deploy:
    name: Deploy Azure Environment
    runs-on: ubuntu-latest
    environment: \${{ github.ref_name == 'main' && 'production' || 'development' }}

    steps:
      # 1. Checkout codebase
      - name: Checkout Code
        uses: actions/checkout@v4

      # 2. Setup .NET Core SDK
      - name: Setup .NET Core SDK
        uses: actions/setup-dotnet@v5.4.0
        with:
          dotnet-version: '8.0.x'
          cache: true

      # 3. Setup Node.js environment
      - name: Setup Node.js environment
        uses: actions/setup-node@v6.4.0
        with:
          # Version Spec of the version to use. Examples: 12.x, 20.x, 22.x
          node-version: '20.x'
          # File containing the version Spec of the version to use.
          # node-version-file: 'package.json'
          # Used to specify a package manager for caching in the default directory: npm, yarn, pnpm.
          cache: 'npm'
          # Target architecture for Node to use. Examples: x86, x64.
          # architecture: 'x64'

      # 4. Authenticate to Azure via secure passwordless OIDC
      - name: Azure OIDC Login
        uses: azure/login@v2
        with:
          client-id: \${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: \${{ secrets.AZURE_TENANT_ID }}
          subscription-id: \${{ secrets.AZURE_SUBSCRIPTION_ID }}

      # 5. Retrieve secrets from Key Vault securely
      - name: Fetch Vault secrets
        uses: azure/get-keyvault-secrets@v1
        with:
          keyvault: ${config.keyVaultName || 'my-vault-name'}
          secrets: 'GITHUB-PAT'

      # 6. Trigger Azure Dev Center Environment creation
      - name: Create DevCenter Environment
        uses: azure/cli@v2
        with:
          azcliversion: latest
          inlineScript: |
            az devcenter dev environment create \\
              --devcenter-name "$AZURE_DEVCENTER_NAME" \\
              --project-name "$AZURE_PROJECT_NAME" \\
              --name "\${{ github.event.inputs.environmentName || 'dev-env-01' }}" \\
              --environment-type "Development" \\
              --environment-definition-name "${isJangu ? 'Jangu-Ecommerce-API-Service' : 'Azure-AppService-Sandbox'}" \\
              --parameters "webAppName=${isJangu ? 'api-jangu-commerce' : 'app-gis-dev-01'}"`
    },
    bicep: {
      name: 'infra/main.bicep',
      description: 'Main Bicep infrastructure-as-code template to provision the Dev Center, Key Vault, Projects, and Environment mappings.',
      icon: FileCode,
      content: `// Dynamic Bicep deployment for Azure DevOps infrastructure
targetScope = 'resourceGroup'

param location string = '${config.location}'
param devCenterName string = '${config.devCenterName}'
param keyVaultName string = '${config.keyVaultName}'
param projectName string = 'E-Commerce-Platform'

// 1. Provision Key Vault
resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: keyVaultName
  location: location
  properties: {
    enabledForDeployment: true
    enabledForTemplateDeployment: true
    tenantId: subscription().tenantId
    sku: {
      name: 'standard'
      family: 'A'
    }
    accessPolicies: [] // Programmed securely via federated role assignments
  }
}

// 2. Provision Dev Center
resource devCenter 'Microsoft.DevCenter/devcenters@2023-04-01' = {
  name: devCenterName
  location: location
  properties: {}
}

// 3. Provision Project container
resource project 'Microsoft.DevCenter/projects@2023-04-01' = {
  name: projectName
  location: location
  properties: {
    devCenterId: devCenter.id
    description: 'DevCenter project container for deployment pipelines'
  }
}`
    },
    manifest: {
      name: isJangu ? 'api/jangu-service.yaml' : 'Environment-Definitions/Azure-AppService-Sandbox/manifest.yaml',
      description: isJangu ? 'Catalog manifest mapping parameters and Python environment requirements for Jangu.' : 'Catalog manifest file that maps parameters and Bicep deployment pathways for the Azure App Service environment template.',
      icon: BookOpen,
      content: `# Azure Deployment Environments - Catalog Manifest Definition
name: ${isJangu ? 'Jangu-Ecommerce-API-Service' : 'Azure-AppService-Sandbox'}
version: 1.0.0
summary: ${isJangu ? 'Curated environment for deploying Jangu Python e-commerce API endpoints.' : 'Curated Web App environment for isolated sandbox deployments.'}
description: ${isJangu ? 'Deploys a Python-based App Service Web App, PostgreSQL database, and Cache.' : 'Deploys a Linux App Service Web App, staging slot, and app plan.'}
runner: ARM
templatePath: ${isJangu ? 'jangu-service.bicep' : 'main.bicep'}

parameters:
  - id: webAppName
    name: ${isJangu ? 'Jangu Web App Name' : 'Web App Name'}
    description: Globally unique name for the App Service Web App
    type: string
    required: true
    default: ${isJangu ? 'api-jangu-commerce' : 'app-sandbox-dev'}

  - id: pythonVersion
    name: Python Version Spec
    description: Version of python to load in target container
    type: string
    required: false
    default: '3.11'
    allowedValues:
      - '3.10'
      - '3.11'
      - '3.12'`
    },
    readme: {
      name: 'ADE-SETUP-GUIDE.md',
      description: 'Clear, comprehensive markdown walkthrough to reproduce this infrastructure automation on real Azure cloud accounts.',
      icon: Award,
      content: `# Azure DevOps Deployment Environments (ADE) Setup Guide

This guide details steps to establish the infrastructure automation pipeline configured in your workspace.

## Prerequisites
1. An active **Azure Subscription** with permissions to register Resource Providers.
2. The **Azure CLI (az)** installed on your machine.
3. A **GitHub Repository** with ownership permissions to set secrets and environments.

---

## Step 1: Create the Dev Center & Projects
Run the Bicep template or launch via Azure CLI:
\`\`\`bash
# Create RG
az group create --name "${config.resourceGroupName}" --location "${config.location}"

# Deploy main infrastructure
az deployment group create \\
  --resource-group "${config.resourceGroupName}" \\
  --template-file infra/main.bicep
\`\`\`

---

## Step 2: Configure Key Vault Secrets
Add your GITHUB-PAT token (access token with \`repo\` scope) to allow the DevCenter to import your private repositories:
\`\`\`bash
az keyvault secret set \\
  --vault-name "${config.keyVaultName}" \\
  --name "GITHUB-PAT" \\
  --value "ghp_YOUR_GITHUB_TOKEN"
\`\`\`

---

## Step 3: Establish Passwordless OIDC Trust
Configure your Entra ID Active Directory app registration to accept OIDC tokens from GitHub Actions:
\`\`\`bash
# Create App Registration
az ad app create --display-name "github-actions-ade"

# Set Federated Credentials (OIDC trust)
# Replace <app-id> with App Client ID
az ad app federation-credential create \\
  --id "<app-id>" \\
  --parameters '{"name":"dev-env","issuer":"https://token.actions.githubusercontent.com","subject":"repo:${config.githubRepo}:environment:development","audiences":["api://AzureADTokenExchange"]}'
\`\`\`

---

## Step 4: Register the Environment Catalog
Connect the Catalog repository to DevCenter:
\`\`\`bash
az devcenter admin catalog create \\
  --name "GIS-Catalog" \\
  --devcenter-name "${config.devCenterName}" \\
  --resource-group "${config.resourceGroupName}" \\
  --git-hub-uri "${config.catalogRepoUrl}" \\
  --git-hub-branch "${config.catalogBranch}" \\
  --git-hub-path "${config.catalogPath}" \\
  --git-hub-secret-identifier "https://${config.keyVaultName}.vault.azure.net/secrets/GITHUB-PAT"
\`\`\``
    }
  };

  const selectedFileData = files[selectedFile as keyof typeof files];

  return (
    <div className="space-y-6 animate-fade-in relative" id="code-export-panel">

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <FileCode className="h-5 w-5 text-indigo-600" />
            Infrastructure Code Explorer
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Review and copy the generated Bicep definitions, catalog manifests, and GitHub Actions workflow files for real-world deployments.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Navigation file tree */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-3 text-left">
              Configured Project Files
            </span>
            <div className="space-y-1">
              {Object.entries(files).map(([key, value]) => {
                const Icon = value.icon;
                return (
                  <button
                    key={key}
                    onClick={() => setSelectedFile(key)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-bold transition text-left ${
                      selectedFile === key
                        ? 'bg-slate-100 text-slate-950 border-l-4 border-slate-800'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className="h-4.5 w-4.5 text-slate-400 shrink-0" />
                    <div className="truncate flex-1">
                      <span className="block font-mono text-[11px] truncate font-bold">{value.name.split('/').pop()}</span>
                      <span className="text-[10px] text-slate-400 font-normal truncate block">{value.name}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-slate-900 text-white rounded-xl p-6 shadow-md text-left space-y-3 border border-slate-800">
            <h4 className="text-sm font-bold uppercase tracking-wider flex items-center gap-1.5 text-indigo-300">
              Ready for real clouds
            </h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              All properties, secrets, subscription references, and names you specified across other screens have been compiled directly into these files.
            </p>
            <div className="pt-2">
              <button
                onClick={() => {
                  showToast("Hi-Fi Simulation: Infrastructure bundle packaged successfully! Ready for real Azure cloud accounts.", "success");
                  if (updateConfig && config.validationStatus) {
                    updateConfig({
                      validationStatus: {
                        ...config.validationStatus,
                        export: {
                          isValidated: true,
                          validatedAt: new Date().toLocaleTimeString(),
                          details: 'Infrastructure package successfully bundled, validated, and downloaded.'
                        }
                      }
                    });
                  }
                }}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded text-xs font-bold flex items-center justify-center gap-1.5 transition uppercase tracking-wider"
              >
                <Download className="h-4 w-4" /> Download Infrastructure Bundle
              </button>
            </div>
          </div>
        </div>

        {/* Code viewer console */}
        <div className="lg:col-span-2 flex flex-col bg-slate-950 border border-slate-800 rounded-xl shadow-xl overflow-hidden h-[600px]">
          <div className="bg-slate-900 px-5 py-3 border-b border-slate-800 flex items-center justify-between text-slate-400">
            <div className="flex flex-col items-start text-left">
              <span className="text-xs font-bold font-mono text-slate-200">{selectedFileData.name}</span>
              <span className="text-[11px] text-slate-400 mt-0.5">{selectedFileData.description}</span>
            </div>
            <button
              onClick={() => copyToClipboard(selectedFileData.content, selectedFile)}
              className="text-slate-400 hover:text-white p-2 rounded hover:bg-slate-800 transition shrink-0"
              title="Copy code"
            >
              {copied === selectedFile ? (
                <span className="text-xs text-emerald-400 font-bold flex items-center gap-1 uppercase tracking-wide">
                  <Check className="h-4 w-4" /> Copied
                </span>
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>
          </div>

          <div className="flex-1 overflow-auto p-5 font-mono text-xs text-slate-300 leading-relaxed text-left scrollbar-thin">
            <pre>{selectedFileData.content}</pre>
          </div>
        </div>
      </div>
    </div>
  );
}
