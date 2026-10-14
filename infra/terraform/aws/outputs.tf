output "alb_dns_name" {
  description = "The public DNS name of the Application Load Balancer."
  value       = aws_lb.alb.dns_name
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
  value       = aws_s3_bucket.frontend.bucket
}

output "frontend_s3_bucket_arn" {
  description = "ARN of the frontend S3 bucket."
  value       = aws_s3_bucket.frontend.arn
}

output "frontend_cloudfront_distributions" {
  description = "Map of CloudFront distribution metadata per frontend application."
  value = {
    for app, dist in aws_cloudfront_distribution.frontend : app => {
      distribution_id = dist.id
      domain_name     = dist.domain_name
      origin_path     = "/${app}"
      s3_prefix       = "${aws_s3_bucket.frontend.bucket}/${app}/"
    }
  }
}

output "client_portal_cloudfront_domain_name" {
  description = "Public CloudFront domain name for client-portal."
  value       = aws_cloudfront_distribution.frontend["client-portal"].domain_name
}

output "oem_backoffice_cloudfront_domain_name" {
  description = "Public CloudFront domain name for oem-backoffice."
  value       = aws_cloudfront_distribution.frontend["oem-backoffice"].domain_name
}

output "client_portal_cloudfront_distribution_id" {
  description = "CloudFront distribution ID for client-portal cache invalidations."
  value       = aws_cloudfront_distribution.frontend["client-portal"].id
}

output "oem_backoffice_cloudfront_distribution_id" {
  description = "CloudFront distribution ID for oem-backoffice cache invalidations."
  value       = aws_cloudfront_distribution.frontend["oem-backoffice"].id
}
