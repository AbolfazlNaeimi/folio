# راه‌اندازی لاگین پنل CMS (یک‌بار، حدود ۱۰ دقیقه)

این پوشه یک Cloudflare Worker کوچیکه که کارش فقط رد و بدل کردن مراحل ورود گیت‌هابه — هیچ دسترسی مستقیمی به محتوای ریپو نداره و هیچ دیتابیسی نیست. بدون این، دکمه‌ی «Login» توی `/admin` کار نمی‌کنه چون گیت‌هاب پیجز سرور نداره.

## قدم ۱: ساخت GitHub OAuth App

1. برو به: `github.com/settings/developers` → **OAuth Apps** → **New OAuth App**
2. پر کن:
   - **Application name**: هر چیزی، مثلاً `AN Journal CMS`
   - **Homepage URL**: `https://abolfazlnaeimi.github.io/folio/`
   - **Authorization callback URL**: `https://<اسم-ورکرت>.workers.dev/callback` (این آدرس رو بعد از دیپلوی ورکر توی قدم ۲ می‌گیری؛ فعلاً یه چیز موقت بزن و بعداً ویرایشش کن)
3. بعد از ساخت، یه **Client ID** می‌بینی و باید روی **Generate a new client secret** بزنی تا **Client Secret** رو هم بگیری. هر دو رو جایی کپی کن.

## قدم ۲: دیپلوی Worker

اگه Wrangler (ابزار خط‌فرمان Cloudflare) رو نداری:
```
npm install -g wrangler
wrangler login
```

بعد، از همین پوشه (`cms-oauth-worker/`):
```
wrangler deploy
```

آدرسی که برمی‌گردونه (چیزی شبیه `an-journal-cms-oauth.<subdomain>.workers.dev`) رو یادداشت کن.

## قدم ۳: ست کردن Secretها

```
wrangler secret put GITHUB_CLIENT_ID
```
(Client ID رو که از قدم ۱ کپی کردی پیست کن)

```
wrangler secret put GITHUB_CLIENT_SECRET
```
(همینطور Client Secret)

## قدم ۴: برگشت به GitHub OAuth App

برو دوباره به تنظیمات همون OAuth App که ساختی و **Authorization callback URL** رو دقیق‌اش کن:
```
https://<آدرس واقعی ورکرت>/callback
```

## قدم ۵: وصل کردن به config.yml

توی `admin/config.yml`، خط `base_url` رو با آدرس واقعی ورکرت جایگزین کن:
```yaml
base_url: https://<آدرس واقعی ورکرت>
```
(بدون `/callback` یا `/auth` در آخرش — فقط آدرس خودِ ورکر)

## تست

برو به `https://abolfazlnaeimi.github.io/folio/admin/` و روی **Login with GitHub** بزن. باید یه پنجره‌ی گیت‌هاب باز بشه، اجازه بدی، و خودکار برگردی به پنل CMS، لاگین‌شده.

---

### این Worker دقیقاً چیکار می‌کنه (برای خیالت راحت باشه)

- `/auth` → مرورگرت رو به صفحه‌ی اجازه‌ی گیت‌هاب می‌فرسته
- `/callback` → کدی که گیت‌هاب برمی‌گردونه رو با Client Secret مبادله می‌کنه به یه توکن، و همون توکن رو به تب CMS پس می‌ده
- هیچ توکنی جایی ذخیره نمی‌شه؛ هر بار لاگین می‌کنی، یه توکن تازه ساخته می‌شه
- خودِ محتوای ریپو (پست‌ها، عکس‌ها) هیچ‌وقت از این Worker رد نمی‌شه — فقط و فقط مرحله‌ی ورود
