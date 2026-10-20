# Deploying to Vercel at stockanalyses.org

The goal is to serve the app at `https://stockanalyses.org` from Vercel (Hobby, free), with `www.stockanalyses.org` redirecting to the apex. DNS stays at Cloudflare. Allow about 15 minutes, plus DNS propagation, which usually takes a few minutes.

Everything in the repo is ready: `vercel.json` (US East region, Fluid compute), function time limits for the AI routes, the www → apex redirect, `robots.txt`, metadata, and `.env.example`.

## 0. Before you start

- **Merge [PR #27](https://github.com/hawikk/stock-analysis-tool/pull/27) into `master`.** Vercel builds production from the default branch. If you import before merging, production will build the old `master` code.
  - Alternatively, import first, check the PR's preview deployment, and merge afterwards. Merging redeploys production automatically.
- **Create an OpenRouter key:** [openrouter.ai/keys](https://openrouter.ai/keys). Sign in with Google or GitHub, click **Create key** and copy it. No card is needed for the free models.
- **Optional insurance key:** [finnhub.io/register](https://finnhub.io/register). This is a free backup data source used if Yahoo ever blocks Vercel's servers.

## 1. Import the project into Vercel

1. Go to [vercel.com/signup](https://vercel.com/signup) and choose **Continue with GitHub**. Pick the **Hobby** plan.
2. Open [vercel.com/new](https://vercel.com/new) and select `hawikk/stock-analysis-tool` under **Import Git Repository**.
   - If the repo doesn't appear, click **Adjust GitHub App Permissions** and grant access to it.
3. On the configure screen:
   - **Framework Preset:** Next.js. It is detected from `vercel.json`.
   - **Root Directory:** `./`. Leave the build, install and output commands at their defaults.
4. Expand **Environment Variables** and add the variables below before the first deploy. If you add them later, redeploy once.

   | Name                 | Value                                                                                                  | Environments        |
   | -------------------- | ------------------------------------------------------------------------------------------------------ | ------------------- |
   | `OPENROUTER_API_KEY` | your `sk-or-...` key                                                                                   | Production, Preview |
   | `SITE_URL`           | `https://stockanalyses.org`                                                                            | Production          |
   | `FINNHUB_API_KEY`    | optional, Finnhub key                                                                                  | Production, Preview |
   | `AI_MODEL`           | optional, e.g. `minimax/minimax-m3.1-flash:free` to pin a favourite model first                        | Production, Preview |
   | `GEMINI_API_KEY`     | optional, a second free AI provider ([aistudio.google.com/apikey](https://aistudio.google.com/apikey)) | Production, Preview |

5. Click **Deploy**. The first build takes about 2 minutes.
6. Open the `*.vercel.app` URL and check:
   - The Overview page shows live prices with no "Demo data" badges.
   - **Settings → AI analysis** lists the OpenRouter model chain.
   - **Settings → Data sources** reads "Yahoo transport: Chrome TLS impersonation (impit)".

## 2. Add the domain in Vercel

1. Go to Project → **Settings → Domains → Add Domain**.
2. Enter `stockanalyses.org` and click **Add**.
3. When Vercel asks, choose the recommended option: **Add `www.stockanalyses.org` and redirect it to `stockanalyses.org`** (308).
   - If it doesn't ask, add `www.stockanalyses.org` yourself, click **Edit**, and set **Redirect to** `stockanalyses.org` with a 308.
4. Both domains show **Invalid Configuration** and list the DNS records they need. **Use the values Vercel shows.** They look like this:

   | Type    | Name  | Value (example, copy yours from Vercel)                                  |
   | ------- | ----- | ------------------------------------------------------------------------ |
   | `A`     | `@`   | `216.198.79.1` (older projects show `76.76.21.21`; both are Vercel)      |
   | `CNAME` | `www` | `cname.vercel-dns.com` (or a project-specific `xxxx.vercel-dns-0xx.com`) |

## 3. Point Cloudflare DNS at Vercel

In the Cloudflare dashboard, open `stockanalyses.org` → **DNS → Records**.

1. **Delete any existing records named `stockanalyses.org` (`@`) or `www`.** This includes A, AAAA and CNAME records, and anything pointing at old hosting, a parking page or Cloud Run. AAAA records in particular must go, because Vercel does not answer on them.
2. **Add the apex record:**
   - Type `A`, Name `@`, IPv4 address = the value from Vercel.
   - **Proxy status: DNS only (grey cloud)**, TTL Auto.
3. **Add the www record:**
   - Type `CNAME`, Name `www`, Target = the value from Vercel.
   - **Proxy status: DNS only (grey cloud)**, TTL Auto.
4. **Turn the proxy off (grey cloud).** Vercel already runs a global CDN and issues the TLS certificate. With the orange cloud on:
   - Cloudflare's proxy sits in front of Vercel's CDN, so you get two CDNs.
   - Certificate issuance and renewal can fail.
   - Vercel sees Cloudflare's IP addresses instead of your visitors'.
5. **Set the SSL mode.** Go to **SSL/TLS → Overview** and set the encryption mode to **Full (strict)**.
   - **Never use Flexible.** With Flexible, Cloudflare talks plain HTTP to Vercel, Vercel redirects to HTTPS, and the browser ends up in an endless redirect loop (`ERR_TOO_MANY_REDIRECTS`).
   - With grey-cloud records the mode doesn't affect traffic. Full (strict) simply keeps things safe if someone flips the proxy on later.
6. **Check for leftover redirects.** Go to **Rules** (Page Rules, Redirect Rules, Bulk Redirects) and remove any rule that forwards `stockanalyses.org` or `www` somewhere else.
7. **Check CAA records.** Only needed if the zone has `CAA` records: add `CAA @ 0 issue "letsencrypt.org"` so Vercel can issue the certificate. If there are no CAA records, do nothing.

## 4. Verify

- In Vercel → **Settings → Domains**, both entries turn to **Valid Configuration** within a few minutes. The certificate is issued automatically.
- From a terminal:

  ```bash
  dig +short stockanalyses.org          # the Vercel A record IP
  dig +short www.stockanalyses.org      # cname.vercel-dns.com. (then a Vercel IP)
  curl -sI https://www.stockanalyses.org | head -3   # HTTP/2 308, location: https://stockanalyses.org/
  curl -s https://stockanalyses.org/api/status | head -c 300
  ```

- Open `https://stockanalyses.org`, then any stock page and its **AI Analysis** tab. The analysis badge should name the OpenRouter model that answered.

## Free AI limits and what happens when they run out

- **OpenRouter free models:** 20 requests per minute and **50 requests per day per account**. Buying $10 of credit once raises the daily limit to 1,000 permanently, and the free models stay free.
- **When a model is rate-limited, retired or returns bad JSON,** the app skips it for a while (1 minute up to 6 hours, depending on the error) and tries the next model.
- **When the daily cap is hit,** all `:free` models pause until the reset. Analyses then come from the next configured provider (e.g. Gemini, if `GEMINI_API_KEY` is set) or the built-in quant engine. The page never breaks.
- **AI results are cached** for 6 hours per stock and 30 minutes for the market brief, so normal use stays well under 50 calls a day.
- **Changing the model list:** set `AI_MODEL` or `AI_FALLBACK_MODELS` in Vercel and redeploy. No code change is needed. Free models currently on offer are listed at [openrouter.ai/models?max_price=0](https://openrouter.ai/models?max_price=0).

## Notes

- **Region:** `vercel.json` pins functions to `iad1` (Washington, D.C.). Yahoo can show EU IP addresses a GDPR consent page that breaks its API handshake, and most data sources are in the US.
- **impit on Vercel:** this Chrome-impersonating HTTP client was verified against a real `vercel build` output.
  - The function bundle contains its native binary.
  - Running the built `/api/quotes` function on the AWS Lambda Node 24 / Amazon Linux 2023 image (glibc 2.34, the base Vercel uses) returned live Yahoo data.
  - If the binary ever fails to load, the app logs a warning and switches to plain `fetch`, then Finnhub (if keyed), then labelled demo data. Settings shows which transport is active.
- **Hobby plan terms:** Hobby is for personal, non-commercial use. If the site ever makes money, Vercel Pro is $20/month, or use the Cloud Run container path in the README.
- **CLI alternative:** with a Vercel token (Account Settings → Tokens), the same setup can be scripted:

  ```bash
  vercel link
  vercel env add OPENROUTER_API_KEY production
  vercel deploy --prod
  vercel domains add stockanalyses.org
  ```

  The dashboard flow above also sets up automatic deploys on every push, which the token-only flow does not.
