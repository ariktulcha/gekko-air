# Gekko Air — Resend + Netlify email setup

## Netlify environment variables

Set these in Netlify → Site configuration → Environment variables, then redeploy production:

```env
RESEND_API_KEY=re_***
RESEND_FROM="Gekko Air <info@gekkoair.co.il>"
RESEND_NOTIFY_TO=ariktulcha@gmail.com
RESEND_REPLY_TO=info@gekkoair.co.il
```

The contact form posts to `/.netlify/functions/contact`. A successful submit sends the notification through Resend **from** `info@gekkoair.co.il` and **to** `ariktulcha@gmail.com`.

## Resend sending domain DNS

In Resend, add/verify the domain `gekkoair.co.il`, then add the DNS records Resend gives you, typically SPF/DKIM/DMARC style TXT/CNAME records. Do not change the values from this file; copy the exact values from the Resend dashboard.

## Direct email to info@gekkoair.co.il

Important: Resend sending verification does not automatically create a receiving inbox. To make normal emails sent directly to `info@gekkoair.co.il` arrive at `ariktulcha@gmail.com`, configure one receiving/forwarding layer:

- Cloudflare Email Routing: route `info@gekkoair.co.il` → `ariktulcha@gmail.com`; or
- Google Workspace / Zoho / registrar email forwarding with alias `info@gekkoair.co.il`; or
- Resend inbound routing if enabled on the account, with forwarding/webhook configured to Arik.

After routing is configured, test with a real email from an external mailbox to `info@gekkoair.co.il` and confirm it lands in `ariktulcha@gmail.com` Inbox/Spam. Provider acceptance alone is not inbox-delivery proof.

## Production test checklist

1. Env vars are set in Netlify and production was redeployed.
2. `https://gekkoair.co.il/.netlify/functions/contact` returns 405 on GET.
3. Submit the contact form with a unique marker.
4. Netlify function logs show `Gekko contact sent` and a request ID.
5. Arik confirms the message arrived in Gmail.
6. Send a normal external email to `info@gekkoair.co.il` and confirm the mailbox forward works.
