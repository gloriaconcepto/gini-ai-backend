# =============================================================================
# AWS SageMaker AI: Real-Time LLM, Embeddings, Pipelines & MLflow
# =============================================================================
# Replaces self-hosted GPU VM infrastructure with fully managed, fixed-cost
# AWS SageMaker AI endpoints for open-source LLM reasoning and embedding models.
# =============================================================================

# -----------------------------------------------------------------------------
# 1. SAGEMAKER EXECUTION IAM ROLE
# -----------------------------------------------------------------------------
resource "aws_iam_role" "sagemaker_execution" {
  name = "role-sagemaker-execution-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "sagemaker.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "sagemaker_admin" {
  role       = aws_iam_role.sagemaker_execution.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSageMakerFullAccess"
}

resource "aws_iam_policy" "sagemaker_s3_opensearch" {
  name        = "policy-sagemaker-s3-opensearch-${var.environment}"
  description = "Allows SageMaker to read RAG documents from S3 and index into OpenSearch"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "S3Access"
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.rag_documents.arn,
          "${aws_s3_bucket.rag_documents.arn}/*"
        ]
      },
      {
        Sid    = "OpenSearchIndex"
        Effect = "Allow"
        Action = [
          "es:ESHttpGet",
          "es:ESHttpPut",
          "es:ESHttpPost"
        ]
        Resource = "${aws_opensearch_domain.rag_vector_store.arn}/*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "sagemaker_extra_policy" {
  role       = aws_iam_role.sagemaker_execution.name
  policy_arn = aws_iam_policy.sagemaker_s3_opensearch.id
}

# -----------------------------------------------------------------------------
# 2. PILLAR 1: LLM INFERENCE (Text Generation) — Fixed Cost Real-Time Endpoint
# -----------------------------------------------------------------------------
# AWS Deep Learning Container for Large Model Inference (LMI with vLLM engine)
locals {
  lmi_image_uri = "763104351884.dkr.ecr.${var.aws_region}.amazonaws.com/djl-inference:0.31.0-lmi13.0.0-cu124"
  tei_image_uri = "763104351884.dkr.ecr.${var.aws_region}.amazonaws.com/huggingface-pytorch-tgi-inference:2.4.0-tgi2.4.0-gpu-py311-cu124-ubuntu22.04"
}

resource "aws_sagemaker_model" "llm_reasoning" {
  name               = "model-llm-reasoning-${var.environment}-${random_string.suffix.result}"
  execution_role_arn = aws_iam_role.sagemaker_execution.arn

  primary_container {
    image = local.lmi_image_uri
    environment = {
      HF_MODEL_ID               = "deepseek-ai/DeepSeek-R1-Distill-Llama-8B"
      OPTION_ENGINE             = "vLLM"
      OPTION_MAX_MODEL_LEN      = "4096"
      OPTION_ROLLING_BATCH      = "vllm"
      OPTION_TENSOR_PARALLEL_DEGREE = "1"
    }
  }
}

resource "aws_sagemaker_endpoint_configuration" "llm_reasoning" {
  name = "epc-llm-reasoning-${var.environment}-${random_string.suffix.result}"

  production_variants {
    variant_name           = "AllTraffic"
    model_name             = aws_sagemaker_model.llm_reasoning.name
    initial_instance_count = var.sagemaker_llm_instance_count
    instance_type          = var.sagemaker_llm_instance_type
  }
}

resource "aws_sagemaker_endpoint" "llm_reasoning" {
  name                 = "gini-llm-reasoning-${var.environment}"
  endpoint_config_name = aws_sagemaker_endpoint_configuration.llm_reasoning.name

  tags = {
    Name      = "gini-llm-reasoning-${var.environment}"
    Component = "LLMInference"
  }
}

# -----------------------------------------------------------------------------
# 3. PILLAR 2: EMBEDDING MODEL — Fixed Cost Inference Endpoint
# -----------------------------------------------------------------------------
resource "aws_sagemaker_model" "embeddings" {
  name               = "model-embeddings-${var.environment}-${random_string.suffix.result}"
  execution_role_arn = aws_iam_role.sagemaker_execution.arn

  primary_container {
    image = local.tei_image_uri
    environment = {
      HF_MODEL_ID           = "BAAI/bge-large-en-v1.5"
      OPTION_ENGINE         = "Python"
      SAGEMAKER_PROGRAM     = "inference.py"
    }
  }
}

resource "aws_sagemaker_endpoint_configuration" "embeddings" {
  name = "epc-embeddings-${var.environment}-${random_string.suffix.result}"

  production_variants {
    variant_name           = "AllTraffic"
    model_name             = aws_sagemaker_model.embeddings.name
    initial_instance_count = var.sagemaker_embedding_instance_count
    instance_type          = var.sagemaker_embedding_instance_type
  }
}

resource "aws_sagemaker_endpoint" "embeddings" {
  name                 = "gini-embeddings-${var.environment}"
  endpoint_config_name = aws_sagemaker_endpoint_configuration.embeddings.name

  tags = {
    Name      = "gini-embeddings-${var.environment}"
    Component = "EmbeddingModel"
  }
}

# -----------------------------------------------------------------------------
# 4. PILLAR 5: S3 PIPELINE ARTIFACTS & MLFLOW EXPERIMENT TRACKING
# -----------------------------------------------------------------------------
resource "aws_s3_bucket" "sagemaker_artifacts" {
  bucket        = "gini-ai-sagemaker-artifacts-${var.environment}-${random_string.suffix.result}"
  force_destroy = true

  tags = {
    Name = "gini-ai-sagemaker-artifacts-${var.environment}"
  }
}

resource "aws_sagemaker_mlflow_tracking_server" "tracking" {
  tracking_server_name = "gini-mlflow-${var.environment}"
  role_arn             = aws_iam_role.sagemaker_execution.arn
  artifact_store_uri   = "s3://${aws_s3_bucket.sagemaker_artifacts.id}/mlflow"

  tags = {
    Name      = "gini-mlflow-${var.environment}"
    Component = "ExperimentTracking"
  }
}

# -----------------------------------------------------------------------------
# 5. SSM PARAMETERS FOR APPLICATION DISCOVERY
# -----------------------------------------------------------------------------
resource "aws_ssm_parameter" "sagemaker_llm_endpoint" {
  name  = "/${var.project_name}/${var.environment}/sagemaker/llm-endpoint"
  type  = "String"
  value = aws_sagemaker_endpoint.llm_reasoning.name
}

resource "aws_ssm_parameter" "sagemaker_embedding_endpoint" {
  name  = "/${var.project_name}/${var.environment}/sagemaker/embedding-endpoint"
  type  = "String"
  value = aws_sagemaker_endpoint.embeddings.name
}
