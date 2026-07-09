# OAuth Connected Accounts – Console Setup

After deploying with `NEXT_PUBLIC_APP_URL=https://contentflywheel.co.uk`, add these redirect URIs in each provider so the app’s callback URL is allowed.

---

## 1. Google Cloud Console (YouTube / Google OAuth)

1. Open [Google Cloud Console](https://console.cloud.google.com/) and select your project.
2. Go to **APIs & Services** → **Credentials**.
3. Open your **OAuth 2.0 Client ID** (Web application).
4. Under **Authorized redirect URIs**, add **exactly**:
   - `https://contentflywheel.co.uk/api/connected-accounts/callback`
   - `https://www.contentflywheel.co.uk/api/connected-accounts/callback`
5. Click **Save**.

---

## 2. Facebook App (Instagram & Facebook)

1. Open [Facebook Developers](https://developers.facebook.com/) → your app.
2. Go to **Facebook Login** → **Settings** (or **Use cases** → **Customize** → **Facebook Login** → **Settings**).
3. Under **Valid OAuth Redirect URIs**, add:
   - `https://contentflywheel.co.uk/api/connected-accounts/callback`
   - `https://www.contentflywheel.co.uk/api/connected-accounts/callback`
   - For **localhost testing**, also add: `http://localhost:3000/api/connected-accounts/callback`
4. Save changes.

**Scopes:** The app requests only `public_profile` for Facebook. Instagram will use Instagram Basic Display API (separate app type) later.

---

## 3. Using the same Facebook App for localhost

You can use the **same** `FACEBOOK_APP_ID` and `FACEBOOK_APP_SECRET` from your production app in `.env.local` for local testing. Ensure the Facebook app has `http://localhost:3000/api/connected-accounts/callback` in **Valid OAuth Redirect URIs** (see step 2 above). Do not commit `.env.local`; it is gitignored.

---

## 4. Production env

In Vercel (or your host), set:

- `NEXT_PUBLIC_APP_URL=https://contentflywheel.co.uk`  
  (or `https://www.contentflywheel.co.uk` if that’s your canonical domain)

This makes the app use the same callback base as the URIs above.

---

## 5. Testing the flows

1. Deploy with the env above and open **Dashboard → Settings → Connected accounts**.
2. Click **Connect** for YouTube: you should be sent to Google; after allowing, you should return to the app without `redirect_uri_mismatch`.
3. Click **Connect** for Instagram or Facebook: you should see the Meta consent screen with the correct scopes and return without invalid-scope or redirect errors.

If you still see errors, confirm the URIs in the consoles match **exactly** (including `https`, no trailing slash before `?`).
