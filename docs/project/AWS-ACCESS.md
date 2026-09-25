# DEFERRED this cycle

Bedrock/AWS staging was deferred (bill-risk). Staging LLM is **OpenAI**.

Keep this file as a future guide when Russel opts into AWS with budgets.

---

# AWS access — least privilege (knowledge-ask-api)

Goal: let staging (and optionally Grok) call Bedrock cheaply without broad AWS power.

## Preferred pattern (safest)
1. You create a dedicated IAM user (or role) with **only** Bedrock invoke + embedding model ARNs.
2. Access keys live in **Render** service env for `knowledge-ask-api`.
3. Grok verifies by calling the **staging API** (health / ask). Grok does **not** need AWS keys for acceptance.
4. Optional: if local/agent debugging is needed, provide the **same** IAM keys once via Grok’s secure secret form (never paste in chat). Rotate after the cycle.

## Cost controls (do these first)
1. In AWS Billing → Budgets: create a monthly budget (e.g. **$5** or **$10** USD) with email alert at 50% / 80% / 100%.
2. Prefer **on-demand** Bedrock only (no provisioned throughput).
3. Use **Nova Micro** for chat; Titan Embed Text for embeddings. Do not enable Opus/Sonnet-class models for this project.
4. Pick **one** region close to you (e.g. `eu-west-1` or `us-east-1`) and stick to it everywhere (Render env `AWS_REGION`).

## Enable models (Bedrock console)
1. Open Amazon Bedrock in your chosen region.
2. Model access / model catalog: request/enable:
   - `amazon.nova-micro-v1:0` (chat)
   - Titan Embeddings Text (e.g. `amazon.titan-embed-text-v2:0` — confirm exact ID in console)
3. Optional later (scanned PDFs): Nova Lite — **do not enable yet** unless we expand scope.

## IAM user (least privilege)
1. IAM → Users → Create user: `knowledge-ask-bedrock-staging` (no console password needed).
2. Attach **inline policy** (replace `REGION` and embedding model ID if console differs):

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
4. Security credentials → Create access key → use case “Application running outside AWS”.
5. Store Access Key ID + Secret in a password manager. Never commit to git. Never paste into chat.

## Render env (API service)
Set (names may be finalized in harden PR `.env.example`):
- `LLM_PROVIDER=bedrock`
- `AWS_ACCESS_KEY_ID=...`
- `AWS_SECRET_ACCESS_KEY=...`
- `AWS_REGION=...`
- `BEDROCK_CHAT_MODEL=amazon.nova-micro-v1:0`
- `BEDROCK_EMBED_MODEL=amazon.titan-embed-text-v2:0`
- Keep `JWT_SECRET` strong; keep mock as CI default locally.

When done, tell Grok in chat: **“Bedrock configured on Render”** (no secrets).

## Optional: give Grok temporary AWS CLI access
Only if debugging needs it:
1. Same IAM user keys as above (or a second key on that user).
2. In Grok chat, use the secure secret prompt when asked — do not type keys into the message box.
3. After acceptance: delete that access key in IAM (or rotate). Prefer deleting agent keys and leaving Render keys until you rotate on a schedule.

## OpenAI provision (alternate)
Separate OpenAI account/API key on Render when you want to flip:
- `LLM_PROVIDER=openai`
- `OPENAI_API_KEY=...`
- chat + embedding model IDs per `.env.example`
Not required for first Bedrock acceptance.

## What Grok will never ask you to do
- Paste secret keys into chat
- Share root account password
- Grant AdministratorAccess
