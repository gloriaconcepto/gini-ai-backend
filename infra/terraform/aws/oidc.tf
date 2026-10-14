# =============================================================================
# GitHub Actions OIDC Authentication & Deployment IAM Role
# =============================================================================
# Allows GitHub Actions workflows (deploy-aws.yml, aws-scheduled-power.yml)
# to securely authenticate using OpenID Connect (OIDC) without static credentials.
# =============================================================================

# 1. GitHub OIDC Identity Provider
resource "aws_iam_openid_connect_provider" "github" {
  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]
  thumbprint_list = [
    "6938fd4d98bab03faadb97b34396831e3780aea1",
    "1c5824a6f5a42275e9b7e719908a4a504a56c42d"
  ]

  tags = {
    Name = "github-actions-oidc"
  }
}

locals {
  github_repo_owner = split("/", var.github_repo)[0]
  github_repo_name  = split("/", var.github_repo)[1]
}

# 2. IAM Role for GitHub Actions
resource "aws_iam_role" "github_deploy" {
  name = "role-github-actions-deploy-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = aws_iam_openid_connect_provider.github.arn
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          }
          StringLike = {
            "token.actions.githubusercontent.com:sub" = [
              "repo:${var.github_repo}:*",
              "repo:${local.github_repo_owner}*/${local.github_repo_name}*:*"
            ]
          }
        }
      }
    ]
  })

  tags = {
    Name = "role-github-actions-deploy-${var.environment}"
  }
}

# 3. Policy granting permissions to ECR, ECS, and RDS power control
resource "aws_iam_policy" "github_deploy" {
  name        = "policy-github-actions-deploy-${var.environment}"
  description = "Allows GitHub Actions to deploy containers to ECR/ECS and manage dev power state"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "ECRAuth"
        Effect = "Allow"
        Action = [
          "ecr:GetAuthorizationToken"
        ]
        Resource = "*"
      },
      {
        Sid    = "ECRRepositoryAccess"
        Effect = "Allow"
        Action = [
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:PutImage",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload"
        ]
        Resource = "arn:aws:ecr:${var.aws_region}:${data.aws_caller_identity.current.account_id}:repository/${var.project_name}-*-${var.environment}"
      },
      {
        Sid    = "ECSDeployment"
        Effect = "Allow"
        Action = [
          "ecs:UpdateService",
          "ecs:DescribeServices",
          "ecs:DescribeTaskDefinition"
        ]
        Resource = "*"
      },
      {
        Sid    = "IAMPassRole"
        Effect = "Allow"
        Action = [
          "iam:PassRole"
        ]
        Resource = [
          aws_iam_role.ecs_task_execution.arn,
          aws_iam_role.ecs_task.arn
        ]
      },
      {
        Sid    = "RDSPowerManagement"
        Effect = "Allow"
        Action = [
          "rds:DescribeDBInstances",
          "rds:StopDBInstance",
          "rds:StartDBInstance"
        ]
        Resource = "*"
      }
    ]
  })
}

# 4. Attach Policy to Role
resource "aws_iam_role_policy_attachment" "github_deploy" {
  role       = aws_iam_role.github_deploy.name
  policy_arn = aws_iam_policy.github_deploy.arn
}
