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
**farm-shop prices + availability**, and **16 photos** (9 cafe, 7 Tiny Cot).
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
