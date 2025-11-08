# AWS Amplify Rewrite/Redirect Configuration Guide

## Overview
AWS Amplify supports redirects and rewrites through two methods:
1. **`_redirects` file** (recommended for static sites)
2. **Amplify Console UI** (for dynamic configuration)

## Method 1: Using `_redirects` File (Current Setup)

### File Location
Place `_redirects` in your `public` folder (for Vite) or root of `dist` folder. Vite will copy it to `dist` during build.

### Syntax
```
source    target    status_code
```

### Status Codes
- **200** = Rewrite (serve target without changing URL)
- **301/302** = Redirect (browser follows to new URL)
- **404** = Custom 404 page

### Current Configuration
Your `_redirects` file is configured to:
1. Serve config JSON files directly (status 200 = rewrite)
2. Fallback all other routes to `index.html` for SPA routing

### Rules Order Matters!
**Important**: Rules are processed top-to-bottom. More specific rules must come BEFORE catch-all rules.

```redirects
# ✅ CORRECT: Specific rules first
/config/pools.json    /config/pools.json    200
/*    /index.html   200

# ❌ WRONG: Catch-all will intercept everything
/*    /index.html   200
/config/pools.json    /config/pools.json    200
```

### Common Patterns

#### Serve Static Files
```redirects
# Serve specific file
/config/pools.json    /config/pools.json    200

# Serve all JSON files in directory (if supported)
/config/*.json    /config/:splat    200
```

#### SPA Routing
```redirects
# Redirect all routes to index.html (except static files)
/*    /index.html   200
```

#### Force HTTPS
```redirects
http://example.com/*    https://example.com/:splat    301
```

#### Custom 404
```redirects
/*    /404.html    404
```

## Method 2: Amplify Console UI

### Steps to Configure via Console

1. **Navigate to Amplify Console**
   - Go to [AWS Amplify Console](https://console.aws.amazon.com/amplify)
   - Select your app

2. **Access Rewrite/Redirect Settings**
   - Click on your app
   - Go to **"Rewrites and redirects"** in the left sidebar
   - Or go to **App settings** → **Rewrites and redirects**

3. **Add Rules**
   - Click **"Add rewrite/redirect rule"**
   - Configure:
     - **Source address**: `/config/pools.json`
     - **Target address**: `/config/pools.json`
     - **Type**: Select "Rewrite (200)"
     - **Country code**: (optional, leave blank for all)

4. **Rule Priority**
   - Rules are processed in order (top to bottom)
   - Use **"Move up"** / **"Move down"** to reorder
   - Ensure static file rules come before catch-all

5. **Save Changes**
   - Click **"Save"**
   - Changes take effect immediately (no redeploy needed)

### Console UI Example Configuration

```
Rule 1:
  Source: /config/pools.json
  Target: /config/pools.json
  Type: Rewrite (200)

Rule 2:
  Source: /config/tokens.json
  Target: /config/tokens.json
  Type: Rewrite (200)

Rule 3:
  Source: /config/api.json
  Target: /config/api.json
  Type: Rewrite (200)

Rule 4:
  Source: /config/app.json
  Target: /config/app.json
  Type: Rewrite (200)

Rule 5:
  Source: /*
  Target: /index.html
  Type: Rewrite (200)
```

## Troubleshooting

### Config Files Not Accessible

1. **Verify files exist in dist folder**
   ```bash
   ls apps/web/dist/config/
   ```

2. **Check `_redirects` file is in dist**
   ```bash
   cat apps/web/dist/_redirects
   ```

3. **Verify rule order** (specific before catch-all)

4. **Test locally after build**
   ```bash
   cd apps/web
   pnpm build
   pnpm preview
   # Test: http://localhost:4173/config/pools.json
   ```

5. **Check Amplify build logs**
   - Amplify Console → Your app → Build history
   - Verify `_redirects` is copied to dist

### Alternative: Use Amplify Console Instead

If `_redirects` file isn't working:
1. Remove or simplify `_redirects` file
2. Configure all rules via Amplify Console UI
3. Console rules override `_redirects` file

### Debugging Tips

- **Browser DevTools**: Check Network tab for actual response
- **cURL test**: `curl -I https://main.d17dr39nax0lds.amplifyapp.com/config/pools.json`
- **Amplify Logs**: Check CloudWatch logs for redirect processing

## Best Practices

1. ✅ Use `_redirects` file for version-controlled config
2. ✅ Test locally with `vite preview` after build
3. ✅ Put specific rules before catch-all
4. ✅ Use status 200 for rewrites (SPA routing, static files)
5. ✅ Use status 301/302 for actual redirects
6. ✅ Document your redirect rules in comments

## References

- [AWS Amplify Redirects Documentation](https://docs.aws.amazon.com/amplify/latest/userguide/redirects.html)
- [Netlify Redirects (similar syntax)](https://docs.netlify.com/routing/redirects/)

