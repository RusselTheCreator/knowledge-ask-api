# AWS Access — Least Privilege (knowledge-ask-api)

**Status:** Amazon Bedrock providers are now implemented and available for use.

---

# AWS Bedrock Configuration Guide

This guide describes how to configure AWS credentials for staging with least-privilege access to Amazon Bedrock models.

## Implementation Status

The knowledge-ask-api now includes:
- **Bedrock LLM provider:** Chat/Q&A using `amazon.nova-micro-v1:0` (default)
- **Bedrock embedding provider:** Vector embeddings using `amazon.titan-embed-text-v2:0` (default, 1024-dimensional)
- Environment variable configuration (see `.env.example`)
- Swappable providers via `LLM_PROVIDER=bedrock` and `EMBEDDING_PROVIDER=bedrock`

**Important:** Titan V2 embeddings are 1024-dimensional by default, while mock embeddings are 384-dimensional and OpenAI text-embedding-3-small can vary. When switching embedding providers, you must re-upload all documents to ensure consistent vector dimensions in the database.

## Setup Pattern (Least Privilege)
1. Create a dedicated IAM user (or role) with **only** Bedrock invoke permissions for specific model ARNs.
2. Store access keys in environment variables (Render, local dev, etc.).
3. Set `LLM_PROVIDER=bedrock` and `EMBEDDING_PROVIDER=bedrock` in your environment.
4. Never commit AWS credentials to git or paste them in chat.

## Cost Controls (Do These First)
1. In AWS Billing → Budgets: create a monthly budget (e.g. **$5** or **$10** USD) with email alert at 50% / 80% / 100%.
2. Prefer **on-demand** Bedrock only (no provisioned throughput).
3. Use **Nova Micro** for chat; Titan Embed Text V2 for embeddings. Do not enable Opus/Sonnet-class models for this project.
4. Pick **one** region close to you (e.g. `eu-west-1` or `us-east-1`) and stick to it everywhere (Render env `AWS_REGION`).

## Enable Models (Bedrock Console)
1. Open Amazon Bedrock in your chosen region.
2. Model access / model catalog: request/enable:
   - `amazon.nova-micro-v1:0` (chat)
   - `amazon.titan-embed-text-v2:0` (embeddings)
3. Optional later: Nova Lite — **do not enable yet** unless expanding scope.

## IAM User (Least Privilege)
1. IAM → Users → Create user: `knowledge-ask-bedrock-staging` (no console password needed).
2. Attach **inline policy** (replace `REGION` with your region, e.g., `us-east-1`):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "InvokeAllowedFoundationModelsOnly",
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel",
        "bedrock:InvokeModelWithResponseStream"
      ],
      "Resource": [
        "arn:aws:bedrock:REGION::foundation-model/amazon.nova-micro-v1:0",
        "arn:aws:bedrock:REGION::foundation-model/amazon.titan-embed-text-v2:0"
      ]
    }
  ]
}
```

3. Do **not** attach `AdministratorAccess`, `PowerUserAccess`, or broad `bedrock:*` on `*`.
4. Security credentials → Create access key → use case "Application running outside AWS".
5. Store Access Key ID + Secret in a password manager. Never commit to git. Never paste into chat.

## Environment Configuration

Set these environment variables in your deployment environment (Render, etc.):

```bash
LLM_PROVIDER=bedrock
EMBEDDING_PROVIDER=bedrock
AWS_ACCESS_KEY_ID=<your-aws-access-key-id>
AWS_SECRET_ACCESS_KEY=<your-aws-secret-access-key>
AWS_REGION=us-east-1

# Optional: Override default models
BEDROCK_CHAT_MODEL=amazon.nova-micro-v1:0
BEDROCK_EMBED_MODEL=amazon.titan-embed-text-v2:0
```

Keep `JWT_SECRET` strong and use mock as the default for local CI.

## Alternative Providers

### OpenAI (Alternate Option)
Set these environment variables to use OpenAI instead:
```bash
LLM_PROVIDER=openai
EMBEDDING_PROVIDER=openai
OPENAI_API_KEY=<your-openai-api-key>
```

See `.env.example` for optional model overrides.

## Security Best Practices

What you should **never** do:
- Paste secret keys into chat or commit them to git
- Share root account password
- Grant AdministratorAccess or broad permissions
- Enable console access for API-only IAM users
- Use the same credentials across multiple projects without rotation

## Vector Dimension Compatibility

Different embedding providers produce different vector dimensions:
- **Mock:** 384 dimensions
- **OpenAI text-embedding-3-small:** 1536 dimensions (default)
- **Bedrock Titan V2:** 1024 dimensions (default)

**Migration Note:** When switching embedding providers, all previously uploaded documents must be re-uploaded and re-embedded with the new provider to ensure cosine similarity search works correctly. Mixing vector dimensions will cause search failures.
