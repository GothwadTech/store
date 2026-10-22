# 🧑‍💻 DEVELOPER GUIDE — Publishing Android Apps on Kiwi Store

Anyone with a **Gothwad Account** can publish Android apps and games on **Kiwi Store** for free.

---

## 1. Register as a Developer

1. Open **`https://kiwiconsole.gothwadtech.com`**.
2. If you are already signed in to any Gothwad service (`accounts`, `mail`, `kiwistore`), your session is detected automatically via silent SSO. Otherwise, click **Sign in**.
3. Complete the one-time developer registration form (Display Name, Organization Name, Support Email, optional Website). There are no registration fees.

---

## 2. Create an App Listing

1. Click **Create app** and enter:
   - **App Name**
   - **Package Name** (e.g. `com.example.myapp` — must be unique and cannot be changed once created)
   - **Kind** (`app` or `game`) and **Category**
2. Fill out the store listing details:
   - **Short Description** and **Full Description**
   - **App Icon** (512×512 PNG/JPG/WebP) and **3–8 Screenshots** (automatically compressed in the browser to `<= 380 KB` WebP and served via D1 `store_images` + Cloudflare Edge Cache CDN `/api/images/:id`)
   - **Privacy Policy URL** and **Support Email**

---

## 3. Upload an APK & Submit for Review

1. Open the **Releases** tab for your app and select your signed `.apk` file (`<= 50 MB`).
2. Kiwi Console automatically inspects the binary `AndroidManifest.xml` inside the APK to pre-fill `packageName`, `versionCode`, `versionName`, `minSdk`, `targetSdk`, and requested Android permissions.
3. Add release notes (changelog) and upload the APK. Live byte-level upload progress is shown while the Worker uploads the binary to GitHub Releases (`GothwadTech/storefiles`).
4. Click **Submit for review** to send the release to the Kiwi Admin moderation queue.

---

## 4. Review Standards & Post-Publication Management

- **Manual Moderation**: Every APK release is reviewed before going live to ensure the app launches properly, metadata is accurate, and requested permissions match the app's functionality.
- **Zero Piracy / Malware**: Pirated, modded, or malicious APKs are rejected and result in developer suspension.
- **Listing Updates & Analytics**: Text and screenshot updates can be saved at any time. In Kiwi Console you can view daily download charts, reply to user reviews, and unpublish or relist your app whenever needed.
