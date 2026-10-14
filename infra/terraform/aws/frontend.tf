# =============================================================================
# Frontend Static Web Hosting (Amazon S3 + Amazon CloudFront CDN)
# =============================================================================
# Serves static web assets for the single-page application (SPA) frontends
# ("client-portal" and "oem-backoffice") out of a unified S3 bucket globally
# over HTTPS with edge caching, isolated origin paths, and client-side routing fallback.
# =============================================================================

locals {
  frontend_apps = toset([
    "client-portal",
    "oem-backoffice",
  ])
}

# -----------------------------------------------------------------------------
# 1. S3 BUCKET FOR STATIC FRONTEND HOSTING
# -----------------------------------------------------------------------------
resource "aws_s3_bucket" "frontend" {
  bucket        = "${var.project_name}-frontend-${var.environment}-${random_string.suffix.result}"
  force_destroy = var.environment == "dev"

  tags = {
    Name      = "${var.project_name}-frontend-${var.environment}"
    Component = "FrontendWebHosting"
  }
}

resource "aws_s3_bucket_versioning" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Initial placeholder index.html for each app prefix (overwritten by CI/CD build uploads)
resource "aws_s3_object" "app_index_placeholder" {
  for_each     = local.frontend_apps
  bucket       = aws_s3_bucket.frontend.id
  key          = "${each.key}/index.html"
  content      = "<!DOCTYPE html><html><head><title>${each.key}</title></head><body><h1>${each.key} is provisioning...</h1></body></html>"
  content_type = "text/html"

  lifecycle {
    ignore_changes = [content, etag]
  }
}

# -----------------------------------------------------------------------------
# 2. ORIGIN ACCESS CONTROL (OAC)
# -----------------------------------------------------------------------------
resource "aws_cloudfront_origin_access_control" "frontend" {
  name                              = "oac-${var.project_name}-frontend-${var.environment}-${random_string.suffix.result}"
  description                       = "Origin Access Control for ${var.project_name} frontend S3 bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# -----------------------------------------------------------------------------
# 3. CLOUDFRONT DISTRIBUTIONS (Dedicated per SPA for isolated domains and routing)
# -----------------------------------------------------------------------------
resource "aws_cloudfront_distribution" "frontend" {
  for_each            = local.frontend_apps
  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  price_class         = var.frontend_price_class

  origin {
    domain_name              = aws_s3_bucket.frontend.bucket_regional_domain_name
    origin_id                = "s3-${aws_s3_bucket.frontend.id}-${each.key}"
    origin_path              = "/${each.key}"
    origin_access_control_id = aws_cloudfront_origin_access_control.frontend.id
  }

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "s3-${aws_s3_bucket.frontend.id}-${each.key}"

    forwarded_values {
      query_string = false

      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 86400
    max_ttl                = 31536000
    compress               = true
  }

  # SPA Routing: Redirect 403 & 404 to index.html with HTTP 200
  custom_error_response {
    error_code            = 403
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 10
  }

  custom_error_response {
    error_code            = 404
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 10
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  tags = {
    Name      = "${var.project_name}-${each.key}-cdn-${var.environment}"
    App       = each.key
    Component = "FrontendCDN"
  }
}

# -----------------------------------------------------------------------------
# 4. S3 BUCKET POLICY (Allows all frontend CloudFront distributions via OAC)
# -----------------------------------------------------------------------------
resource "aws_s3_bucket_policy" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudFrontServicePrincipalReadOnly"
        Effect = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.frontend.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = [for dist in aws_cloudfront_distribution.frontend : dist.arn]
          }
        }
      }
    ]
  })
}
