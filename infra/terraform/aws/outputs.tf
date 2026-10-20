output "alb_dns_name" {
  description = "The public DNS name of the Application Load Balancer."
  value       = aws_lb.alb.dns_name
}

output "gateway_url" {
  description = "Public HTTP URL for the NestJS API Gateway."
  value       = "http://${aws_lb.alb.dns_name}"
}

output "swagger_docs_url" {
  description = "Public URL for Swagger / OpenAPI documentation."
  value       = "http://${aws_lb.alb.dns_name}/api/docs"
}

output "keycloak_url" {
  description = "Public URL for Keycloak Identity Provider (ALB path routing)."
  value       = "http://${aws_lb.alb.dns_name}"
}

output "rds_endpoint" {
  description = "Connection endpoint for Amazon RDS PostgreSQL."
  value       = aws_db_instance.postgres.endpoint
}

output "elasticache_endpoint" {
  description = "Configuration endpoint for ElastiCache Redis replication group."
  value       = aws_elasticache_replication_group.redis.primary_endpoint_address
}

output "external_s3_document_bucket" {
  description = "Configured external S3 bucket name for tenant documents."
  value       = var.s3_document_bucket_name
}

output "ecr_repository_urls" {
  description = "Map of ECR repository URLs."
  value = {
    for k, v in aws_ecr_repository.repos : k => v.repository_url
  }
}

output "frontend_s3_bucket_name" {
  description = "S3 bucket name for frontend static asset deployments."
  value       = var.enable_frontend ? aws_s3_bucket.frontend[0].bucket : null
}

output "frontend_s3_bucket_arn" {
  description = "ARN of the frontend S3 bucket."
  value       = var.enable_frontend ? aws_s3_bucket.frontend[0].arn : null
}

output "frontend_cloudfront_distributions" {
  description = "Map of CloudFront distribution metadata per frontend application."
  value = var.enable_frontend ? {
    for app, dist in aws_cloudfront_distribution.frontend : app => {
      distribution_id = dist.id
      domain_name     = dist.domain_name
      origin_path     = "/${app}"
      s3_prefix       = "${aws_s3_bucket.frontend[0].bucket}/${app}/"
    }
  } : {}
}

output "client_portal_cloudfront_domain_name" {
  description = "Public CloudFront domain name for client-portal."
  value       = var.enable_frontend ? aws_cloudfront_distribution.frontend["client-portal"].domain_name : null
}

output "oem_backoffice_cloudfront_domain_name" {
  description = "Public CloudFront domain name for oem-backoffice."
  value       = var.enable_frontend ? aws_cloudfront_distribution.frontend["oem-backoffice"].domain_name : null
}

output "client_portal_cloudfront_distribution_id" {
  description = "CloudFront distribution ID for client-portal cache invalidations."
  value       = var.enable_frontend ? aws_cloudfront_distribution.frontend["client-portal"].id : null
}

output "oem_backoffice_cloudfront_distribution_id" {
  description = "CloudFront distribution ID for oem-backoffice cache invalidations."
  value       = var.enable_frontend ? aws_cloudfront_distribution.frontend["oem-backoffice"].id : null
}

output "github_deployment_role_arn" {
  description = "IAM Role ARN to configure as AWS_DEPLOYMENT_ROLE_ARN secret in GitHub Actions."
  value       = aws_iam_role.github_deploy.arn
}

output "api_cloudfront_domain_name" {
  description = "Public CloudFront domain name for HTTPS API Gateway & Keycloak reverse proxy."
  value       = var.enable_frontend ? aws_cloudfront_distribution.api[0].domain_name : null
}

output "api_cloudfront_distribution_id" {
  description = "CloudFront distribution ID for API reverse proxy cache invalidations."
  value       = var.enable_frontend ? aws_cloudfront_distribution.api[0].id : null
}

output "api_gateway_https_url" {
  description = "Public HTTPS URL for the NestJS API Gateway via CloudFront."
  value       = var.enable_frontend ? "https://${aws_cloudfront_distribution.api[0].domain_name}" : null
}

output "swagger_docs_https_url" {
  description = "Public HTTPS URL for Swagger / OpenAPI documentation via CloudFront."
  value       = var.enable_frontend ? "https://${aws_cloudfront_distribution.api[0].domain_name}/api/docs" : null
}

output "keycloak_https_url" {
  description = "Public HTTPS URL for Keycloak Identity Provider via CloudFront."
  value       = var.enable_frontend ? "https://${aws_cloudfront_distribution.api[0].domain_name}" : null
}

