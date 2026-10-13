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

output "rag_documents_bucket" {
  description = "S3 bucket for raw RAG enterprise document storage."
  value       = aws_s3_bucket.rag_documents.bucket
}

output "opensearch_endpoint" {
  description = "HTTPS endpoint for the Amazon OpenSearch Service Managed Cluster."
  value       = aws_opensearch_domain.rag_vector_store.endpoint
}

output "sagemaker_llm_endpoint_name" {
  description = "Name of the SageMaker Real-Time LLM generation endpoint."
  value       = aws_sagemaker_endpoint.llm_reasoning.name
}

output "sagemaker_embedding_endpoint_name" {
  description = "Name of the SageMaker Embedding inference endpoint."
  value       = aws_sagemaker_endpoint.embeddings.name
}

output "mlflow_tracking_server_arn" {
  description = "ARN of the SageMaker Managed MLflow tracking server."
  value       = aws_sagemaker_mlflow_tracking_server.tracking.arn
}

output "ecr_repository_urls" {
  description = "Map of ECR repository URLs."
  value = {
    for k, v in aws_ecr_repository.repos : k => v.repository_url
  }
}
