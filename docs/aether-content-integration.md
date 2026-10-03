# Aether content integration

The BPE Video Pipeline is a client of Aether Hockey. It does not read or write
`bpe_video_ideas`; every request goes through BPE's authenticated route handlers
to Aether's server-to-server API.

## Required environment variables

Set these in both Vercel projects (Production, Preview, and Development):

```text
BPE_AETHER_API_TOKEN=<the same newly generated long random value>
```

Set this only in the BPE project when testing against a preview or local Aether
deployment. Production defaults to `https://www.aetherhockey.com`.

```text
AETHER_API_URL=https://www.aetherhockey.com
```

`BPE_AETHER_API_TOKEN` is server-only. Never prefix it with `NEXT_PUBLIC_`, and
never use the Supabase service-role key as the integration token.

## Rollout order

1. Deploy the Aether migration and API.
2. Set the shared token in both projects.
3. Deploy BPE.
4. Open BPE's Video Pipeline and confirm the imported cards appear, then create
   and edit one test card.

The migration imports legacy `bpe_video_ideas` rows once using their original
IDs. The legacy table is intentionally retained as a recovery-only snapshot;
BPE no longer calls it.
