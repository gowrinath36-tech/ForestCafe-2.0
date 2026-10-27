/* ==========================================================================
   Forest Cafe - Firebase settings
   --------------------------------------------------------------------------
   !! DUMMY VALUES !!  Replace each value below with the ones from your own
   Firebase project:  Firebase Console > Project settings (gear icon) >
   General > "Your apps" > Web app > SDK setup and configuration > Config.

   While apiKey / projectId still contain "DUMMY", the website simply ignores
   the database and shows the built-in text (the dashboard runs in demo mode).

   It is OK for these values to be public. The real protection is the
   Firestore rules (firestore.rules) + restricting the key to your domain.
   ========================================================================== */
window.FOREST_FIREBASE = {
  apiKey: "AIzaSyB3xbkyAOy2JFWGi6CWhna_zH6SiYl6tPw",   // <-- 1. paste your Web API key
  projectId: "forest-cafe-b70f6",          // <-- 2. paste your Project ID
  authDomain: "forest-cafe-b70f6.firebaseapp.com",  // <-- 3. (informational) your auth domain
  collection: "site",     // Firestore collection  (leave as is)
  docId: "content"        // Firestore document    (leave as is)
};
