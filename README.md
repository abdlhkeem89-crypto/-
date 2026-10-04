# تطبيق عبد الحكيم محمد للدراسة

تطبيق React Native / Expo لمتابعة دراسة الصف الأول الثانوي، مع دعم العربية وRTL.

## التشغيل

```bash
npm install
npx expo start
```

يمكن فتحه عبر Expo Go أو تشغيله على محاكي Android/iOS.

## بناء نسخة تثبيت Android

بعد تثبيت EAS CLI وتسجيل الدخول إلى حساب Expo:

```bash
npm install -g eas-cli
eas build:configure
eas build --platform android --profile preview
```

ينتج البناء ملف APK للتثبيت على الهاتف. أما نسخة المتجر فيمكن بناؤها عبر profile production.

## المزايا

- سجل دروس اليوم والأرشيف بالصور.
- جدول أسبوعي قابل للتعديل والحفظ.
- الدروس الناقصة والواجبات والاختبارات.
- دروس منفصلة لكل مادة.
- AsyncStorage للحفظ المحلي.
- expo-image-picker للكاميرا والصور.
- expo-notifications للتذكيرات.
