# 🧑‍💻 DEVELOPER GUIDE — Gothwad Store par app kaise publish karein

## 1. Developer bano
`console.gothwadtech.com` kholo → **Sign in with Gothwad** (wahi account jo
Mail/Drive me hai) → ek-baar ki developer registration (naam, organisation,
support email). Koi fees nahi hai.

## 2. App banao
**Create app** → naam + **package name** (`com.tumhari.app`) + category.
⚠️ Package name baad me badla **nahi** jayega — aur kisi ki li hui package
id dobara nahi milegi.

## 3. Listing taiyaar karo
- Title, short description (80 akshar), full description
- Icon 512×512 + kam se kam **2 screenshots** (images ImgBB par jati hain —
  upload se pehle browser khud unhe halka kar deta hai)
- Privacy policy URL (agar app personal data leta hai to lazmi)

## 4. APK upload karo
**Releases → Naya release** → signed APK file chuno. Har supported APK
(**maximum 50 MB**) GitHub `storefiles` Releases par secure Worker upload se
jata hai. Upload me live byte progress dikhega; connection temporary drop ho
to same APK ko phir select karke retry karna safe hai.

Version name (`1.0.0`) + badhta hua version code (`1`, `2`, `3`...) +
"What's new" likho → **Upload & create release** → **Submit for review**.

## 5. Manual review
Har naya APK pehle admin review se guzrega (Play Store jaisa):
- App sach me khulti hai, naam/icon kisi aur ki chori nahi
- Khatarnak permissions (SMS, contacts, accessibility) ka kaaran saaf hai
- **Pirated / mod APK hargiz nahi** — aisi app reject + developer ban hoga

Approve → app `store.gothwadtech.com` par live. Reject → admin ka kaaran
Console me dikhega, sudhaar karke phir submit kar do. Listing ke text/photo
wale badlav bina review live hote hain; APK hamesha review se hi jayega.

## 6. Live ke baad
Console me: downloads ke charts (**Statistics**), users ke **Reviews** aur
un par tumhare jawab, aur kabhi bhi **Delist** (app chhupana) — sab milega.
