---
name: Resend verified sender domain
description: Which domain K&S Solar emails must be sent FROM, and why the wrong one silently fails delivery.
---

# Resend sender domain for K&S Solar

All outbound email (password reset in `auth.ts`, absent alerts / notifications in `notifications.ts`) MUST send `from:` an address on the **verified** Resend domain: `knssolar.com.pk` (e.g. `noreply@knssolar.com.pk`).

**Why:** Resend rejects sends whose `from` domain is not verified on the account. The code shipped `noreply@kssolar.pk` (note: no `n`, `.pk` not `.com.pk`) — an unverified domain — so every email was rejected and "domain is verified" reports were about a *different* domain. The verified domain can only be confirmed against the live Resend account (`GET https://api.resend.com/domains` with `RESEND_API_KEY`), not from the codebase.

**How to apply:** before debugging "emails not arriving", verify the `EMAIL_FROM` / `from:` domain exactly matches a `verified` entry from the Resend domains API. A 200 from `POST /emails` means Resend accepted it (delivery/spam is separate). Recipient (`to`) address can be any domain once the sender domain is verified — only the FROM domain must match.
