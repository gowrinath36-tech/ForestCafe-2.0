# Forest Cafe website - project notes

## Folder map
```
index.html, dashboard.html, 404.html     pages (dashboard = owner login + editor)
css/style.css                            all styles
js/main.js                               site behaviour (menu, gallery, rooms, farm-shop popup)
js/cms.js                                CMS: database, login, prices, photo upload
js/firebase-config.js                    Firebase keys (web keys are OK to be public)
data/content.json                        offline fallback (used only if the database cannot be reached)
images/ fonts/ *.webm logo*              assets
firebase.json .firebaserc firestore.rules   Firebase hosting + database rules
robots.txt sitemap.xml                   SEO
```

## What the owner can edit in dashboard.html
Hero / About text, phone, email, social links, **Articles & Blog buttons**, menu prices,
**farm-shop prices + availability**, and **17 photos** (9 cafe, 8 Tiny Cot incl. the Secret Attic).
Flow: edit -> Save draft -> Preview draft -> Publish live.
Photos are resized (max 1600 px) and converted to WebP in the browser before upload.

## Deploy (do these in order)
1. **Firestore rules first** (new rules allow photo upload):
   Firebase console > Firestore Database > Rules > paste `firestore.rules` > Publish.
   (or `firebase deploy --only firestore:rules`)
2. `firebase deploy --only hosting`
3. Open `https://<project>.web.app/dashboard.html`, sign in, change one price, Publish live, check the website.
4. Test the 404 page at `https://<project>.web.app/abc/xyz` (Live Server cannot show it).

## Photo storage
Uploaded photos are stored in the Firestore collection `site_images` (one compressed WebP per document,
no paid plan needed). The list of replaced photos is inside `site/content` under `images`.
Visitors cache them in the browser. Replaced photos are deleted automatically on publish.

## After going live
- Authentication > Settings > User actions: turn OFF "Enable create (sign-up)".
- Google Cloud > Credentials > Browser key: restrict to your domain (HTTP referrers) and to
  Identity Toolkit API, Token Service API, Cloud Firestore API.
- Hosting > Add custom domain (DNS records at the registrar), then add the domain to
  Authentication > Settings > Authorized domains.
- Submit `https://forestcafe.in/sitemap.xml` in Google Search Console; claim the Google Business Profile.
- Optional: analytics, weekly "Download backup" from the dashboard.


## 403 error in the browser console ("Failed to load resource ... 403")
That is the browser asking Firestore for `site/content`. The site keeps working (built-in text), but fix it:
1. Open DevTools > Network > click the red `content?key=...` row > **Response** tab (the console now also prints the reason).
2. Match the message:

| Message / reason | Cause | Fix |
|---|---|---|
| `Requests from referer ... are blocked` (API_KEY_HTTP_REFERRER_BLOCKED) | the API key's website restriction does not include this address | Google Cloud Console > APIs & Services > Credentials > Browser key > Websites: add `http://127.0.0.1:5500/*`, `http://localhost:5500/*`, `https://forest-cafe-b70f6.web.app/*`, `https://forest-cafe-b70f6.firebaseapp.com/*`, your real domain (`https://forestcafe.in/*`, `https://www.forestcafe.in/*`) and your GitHub Pages link |
| `Requests to this API ... are blocked` (API_KEY_SERVICE_BLOCKED) | Cloud Firestore API missing in the key's API restrictions | add Cloud Firestore API, Identity Toolkit API, Token Service API |
| `Missing or insufficient permissions` (PERMISSION_DENIED) | Firestore rules not published yet | Firestore > Rules > paste `firestore.rules` > Publish |
| `... API has not been used ... disabled` | API not enabled | enable Cloud Firestore API |
| mentions App Check | App Check enforcement is ON | turn enforcement off (the site does not use App Check) |

A 404 from this request is normal until the first "Publish live" (nothing published yet).

## GitHub "Google API key public leak" alert
The Firebase *web* API key is an identifier, not a password, so it is meant to be in the page code. GitHub still flags every `AIza...` key.
1. Restrict the key (table above): websites + the 3 APIs. After this the key is useless for anything else.
2. GitHub > repo > Security and quality > Secret scanning > open the alert > **Close as** > "Won't fix" (or "False positive") > comment
   "Firebase web key, restricted by HTTP referrer and API" > Close alert.
3. Optional (only if you want zero alerts): Google Cloud > Credentials > Create credentials > API key, restrict it the same way,
   paste it in `js/firebase-config.js`, deploy, then delete the old key.
4. Never commit: service-account JSON, Admin SDK keys, passwords, `.env` files (already listed in `.gitignore`).

## Performance notes (this version)
- Images resized/recompressed (max 1600 px for photos), hero videos re-encoded without audio, intro loader video shrunk.
- Hero: the still photo (`images/cafe/cafe-01.webp`, `hero-mob-poster.webp`) shows first, the video fades in on top.
- Google Fonts load without blocking the page. Intro screen hard-stops after 4 s.
- Re-test with Lighthouse on the deployed URL (not Live Server): Hosting adds compression and caching.
