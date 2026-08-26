This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Agent Action Gateway

The Agent Action Gateway is the only agent mutation path for the live `bpe_tasks` board. It records every attempted mutation in `agent_action_audit_log`; tasks are archived by default, and permanent deletion or external sends require a short-lived confirmation.

### Setup

1. Add these server-only environment variables in Vercel (do **not** prefix any with `NEXT_PUBLIC_`):

   ```text
   SUPABASE_URL=https://<project>.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
   AGENT_ACTION_SECRET=<long-random-secret>
   TELEGRAM_BOT_TOKEN=<bot-token>
   TELEGRAM_WEBHOOK_SECRET=<long-random-secret>
   TELEGRAM_BRAD_USER_ID=<Brad's numeric Telegram user id>
   APP_URL=https://<dashboard-domain>
   ```

2. Apply the migration with `supabase db push`, or run [the migration](supabase/migrations/20260806113132_agent_action_gateway.sql) in the Supabase SQL editor if the repo is not linked locally.

3. Configure Telegram after deployment:

   ```bash
   curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
     -d "url=https://your-dashboard-domain.com/api/telegram/webhook" \
     -d "secret_token=$TELEGRAM_WEBHOOK_SECRET"
   ```

   Send `/help` to the bot from the account with numeric ID `TELEGRAM_BRAD_USER_ID`. The webhook rejects other senders and requests without Telegram's secret header.

Dashboard review is at `/dashboard/settings/agent-access`. The action API accepts a server-side `x-agent-action-secret` only; browsers use the dashboard session. Audit review is `GET /api/agent-actions/audit` for an authenticated dashboard session.
