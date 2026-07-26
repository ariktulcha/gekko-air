# Gekko Air — Resend, Netlify, Airtable setup

## Netlify environment variables

Set these in Netlify → Site configuration → Environment variables, then redeploy production:

```env
RESEND_API_KEY=re_***
RESEND_FROM="Gekko Air <info@gekkoair.co.il>"
RESEND_NOTIFY_TO=gekkoclean.air@gmail.com
RESEND_REPLY_TO=info@gekkoair.co.il

# Optional: separate recipient for checkout/order-step notifications.
# If omitted, ORDER_NOTIFY_TO falls back to RESEND_NOTIFY_TO.
ORDER_NOTIFY_TO=gekkoclean.air@gmail.com

# Airtable checkout leads
# Airtable is intentionally hardcoded in netlify/functions/order-intake.js:
# base appm9KxX1DklkhRUK, table tbllePRiqRj9KxRpY, view viwMsQwr3gaBX3w7U.
# No Netlify Airtable env vars are required for the current implementation.
```

## Contact form behavior

The homepage contact form posts to `/.netlify/functions/contact`.

On successful submit:

1. An internal notification is sent to `RESEND_NOTIFY_TO` — default `gekkoclean.air@gmail.com`.
2. If the visitor entered an email address, they receive a branded automatic confirmation email.
3. The customer email includes a clear CTA button to buy the kit: `/checkout/`.

## Checkout part 1 behavior

The checkout details form posts to `/.netlify/functions/order-intake` when the customer finishes step 1.

On successful submit:

1. A record is created in Airtable base `appm9KxX1DklkhRUK`, table `tbllePRiqRj9KxRpY`.
2. A branded internal email is sent to `ORDER_NOTIFY_TO` or `RESEND_NOTIFY_TO`, default `gekkoclean.air@gmail.com`.
3. The customer is moved to the confirmation panel on the page.

Expected Airtable columns:

- `שם מלא`
- `טלפון`
- `אימייל`
- `מוצר`
- `מחיר`
- `שעה`
- `תאריך יצירה`
- `מקור`
- `סטטוס`
- `מספר ליד`

If `AIRTABLE_AUTO_CREATE_FIELDS=true` and the Airtable token has `schema.bases:read` + `schema.bases:write`, the function will try to create missing columns automatically. The token also needs `data.records:write` for inserting leads.

## Resend sending domain DNS

In Resend, add/verify the domain `gekkoair.co.il`, then add the DNS records Resend gives you, typically SPF/DKIM/DMARC style TXT/CNAME records. Do not change the values from this file; copy the exact values from the Resend dashboard.

## Direct email to info@gekkoair.co.il

Important: Resend sending verification does not automatically create a receiving inbox. To make normal emails sent directly to `info@gekkoair.co.il` arrive at Gmail, configure one receiving/forwarding layer:

- Cloudflare Email Routing; or
- Google Workspace / Zoho / registrar email forwarding; or
- Resend inbound routing if enabled on the account, with forwarding/webhook configured.

After routing is configured, test with a real email from an external mailbox and confirm it lands in Inbox/Spam. Provider acceptance alone is not inbox-delivery proof.

## Production test checklist

1. Env vars are set in Netlify and production was redeployed.
2. `https://gekkoair.co.il/.netlify/functions/contact` returns 405 on GET.
3. Submit the contact form with a unique marker.
4. Submit checkout step 1 with a unique marker.
5. Netlify function logs show `Gekko contact sent` and `Gekko order intake saved and notified`.
6. Airtable contains the checkout record with `שעה` filled.
7. `gekkoclean.air@gmail.com` receives the contact/order notifications.
8. The test contact customer email receives the branded automatic confirmation.
