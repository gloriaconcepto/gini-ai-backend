# Gini AI Infrastructure: Multi-Cloud Terraform Configurations

This directory contains the Infrastructure as Code (IaC) definitions for Gini AI across cloud providers. Each provider is completely isolated in its own folder with independent state, variables, and provider configurations.

---

## Directory Structure

```text
infra/terraform/
├── aws/                           # AWS Infrastructure Stack
│   ├── .terraform.lock.hcl        # Provider dependency lock file
│   ├── frontend.tf                # S3 static site & CloudFront distribution
│   ├── main.tf                    # VPC, ECS Fargate, RDS PostgreSQL, Redis, ALB
│   ├── outputs.tf                 # Exported endpoints, ARNs, and connection strings
│   ├── terraform.tfvars.example   # Sample variable definitions
│   └── variables.tf               # Input variable specifications
│
├── azure/                         # Azure Infrastructure Stack
│   ├── .terraform.lock.hcl        # Provider dependency lock file
│   ├── main.tf                    # VNet, Container Apps (ACA), PostgreSQL, Key Vault
│   ├── outputs.tf                 # Exported FQDNs, resource group, and vault URIs
│   ├── terraform.tfvars.example   # Sample variable definitions
│   └── variables.tf               # Input variable specifications
│
└── README.md                      # This documentation
```

---

## Stacks Overview

### 1. Azure Infrastructure (`azure/`)
- **Compute:** Azure Container Apps (ACA) environment running:
  - `ca-gateway`: NestJS API Gateway
  - `ca-keycloak`: Keycloak Identity Provider
  - `ca-redis`: Distributed cache & BullMQ queue broker
  - `ca-enterprise-portal`: Enterprise Web Application
  - `ca-oem-backoffice`: Admin Management Portal
- **Database:** Azure Database for PostgreSQL Flexible Server
- **Secrets & Security:** Azure Key Vault & Managed Identities
- **Networking:** Virtual Network (VNet) with delegated subnets

### 2. AWS Infrastructure (`aws/`)
- **Compute:** AWS ECS Fargate running API Gateway and BullMQ worker tasks behind an Application Load Balancer (ALB)
- **Database:** Amazon RDS PostgreSQL 16 (Multi-AZ capable)
- **Cache / Broker:** Amazon ElastiCache Redis 7
- **Frontend Hosting:** Unified Amazon S3 Private Bucket with Origin Access Control (OAC) and dedicated CloudFront CDN distributions serving two distinct SPAs: `client-portal` (origin path `/client-portal`) and `oem-backoffice` (origin path `/oem-backoffice`)
- **Networking:** Multi-AZ VPC with Public, Application, and Database subnets

---

## Getting Started

### Working with Azure (`azure/`)

```bash
cd infra/terraform/azure

# 1. Copy sample variables
cp terraform.tfvars.example terraform.tfvars

# 2. Authenticate to Azure CLI
az login

# 3. Initialize Terraform
terraform init

# 4. Preview and apply changes
terraform plan
terraform apply
```

### Working with AWS (`aws/`)

```bash
cd infra/terraform/aws

# 1. Copy sample variables
cp terraform.tfvars.example terraform.tfvars

# 2. Configure AWS credentials
aws configure

# 3. Initialize Terraform
terraform init

# 4. Preview and apply changes
terraform plan
terraform apply
```

---

## Security & State Management

- **Sensitive Variables:** Never commit `.tfvars` or `.tfstate` files to version control. Pass secrets through environment variables (`TF_VAR_<name>`), AWS Secrets Manager, or Azure Key Vault.
- **State Locking:** Remote state backends (S3 + DynamoDB for AWS; Azure Storage Account with blob lease for Azure) should be configured for team collaboration and production deployments.
