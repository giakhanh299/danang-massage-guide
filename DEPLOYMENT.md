# DEPLOYMENT

Guide for publishing and maintaining `danang-massage-guide` in production.

## GitHub Setup

### Repository

1. Create or use the GitHub repository for the site.
2. Push the local project to the default branch.
3. Confirm the branch used for deployment. The current repo uses `master`.

Basic commands:

```powershell
git status
git add .
git commit -m "Your message"
git push
```

### Recommended repository settings

- enable branch protection if multiple editors are involved
- require pull request review if the site grows into a team workflow
- keep `.wrangler/` ignored in `.gitignore`

## Cloudflare Pages Setup

### Git-connected setup

1. Open Cloudflare Dashboard.
2. Go to `Workers & Pages`.
3. Create a Pages project.
4. Connect the GitHub repository.
5. Select the production branch: `master`.
6. Use these settings:
   - Framework preset: `None`
   - Build command: blank
   - Build output directory: `.`
7. Save and deploy.

### Direct deployment with Wrangler

Use this if the Git integration does not update production reliably.

Prerequisites:

- authenticated Wrangler session
- Pages project already created
- access to the repo root

Check auth:

```powershell
npx wrangler whoami
```

Deploy:

```powershell
npx wrangler pages deploy . --project-name danang-massage-guide --branch master --commit-hash <sha> --commit-message "<message>"
```

### Verify current production deployment

List Pages deployments:

```powershell
npx wrangler pages deployment list --project-name danang-massage-guide
```

Check the live URL:

```powershell
curl.exe https://danang-massage-guide.pages.dev/
```

## Custom Domain Setup

### Add a custom domain in Cloudflare Pages

1. Open the Pages project.
2. Go to `Custom domains`.
3. Add your domain or subdomain.
4. Follow the DNS instructions shown by Cloudflare.

Typical setups:

- apex domain: `example.com`
- subdomain: `www.example.com`

### DNS notes

- if the domain is already on Cloudflare DNS, setup is usually automatic
- if the domain is external, update the required DNS records where the domain is managed
- wait for DNS propagation before verifying the final URL

### After attaching the domain

- update homepage JSON-LD if you move away from `pages.dev`
- update any social profile or advertising links
- verify HTTPS is active

## Troubleshooting Guide

## Problem: Git push succeeds but production does not update

Possible causes:

- Pages is still building the previous commit
- Git integration is disconnected
- the wrong branch is configured for production

What to do:

1. Run:

```powershell
npx wrangler pages deployment list --project-name danang-massage-guide
```

2. Compare the deployment source commit with:

```powershell
git rev-parse HEAD
```

3. If production is behind, run a direct Wrangler deploy.

## Problem: Live site still shows old content after deployment

Possible causes:

- browser cache
- Cloudflare edge cache
- deployment finished but the wrong hostname is being checked

What to do:

1. hard refresh the browser
2. test in an incognito window
3. fetch the site with `curl.exe`
4. confirm the deployment ID in the Pages dashboard

## Problem: Wrangler deployment warns about uncommitted changes

Wrangler may show a warning if the repo has local edits.

Resolution:

- commit first if the state should be preserved
- or pass `--commit-dirty=true` only when you intentionally want a manual deploy from a dirty workspace

## Problem: Git commands fail with dubious ownership

If Git reports a `safe.directory` error, add the repo as safe:

```powershell
git config --global --add safe.directory "D:/lending page"
```

## Cache Clearing Instructions

### Browser cache

- hard refresh
- open in a private window
- clear local browser cache if the old build persists

### Cloudflare cache

For a custom domain proxied through Cloudflare:

1. Open Cloudflare Dashboard.
2. Go to `Caching`.
3. Use `Purge Cache`.
4. Prefer single-file purge when possible.

For `pages.dev` URLs, the fastest fallback is often redeploying the current production build.

## Production Release Checklist

- confirm `git status` is clean
- confirm booking links resolve correctly
- confirm CTAs are visible on mobile
- confirm review links open correctly
- confirm structured data URL matches the live domain
- confirm the latest commit is the latest production deployment
