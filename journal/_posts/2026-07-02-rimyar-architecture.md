---
title: "معماری فنی ریمیار"
subtitle: "چطور یک دستیار تصمیم‌گیری را روی Cloudflare Workers ساختم"
date: 2026-07-02
category: "Development"
tags: ["AI", "RimYar", "Cloudflare Workers", "Architecture"]
cover: "/journal/uploads/rimyar-promo.jpg"
featured: false
pinned: false
series: "ساخت ریم‌نوا"
series_order: 2
gallery:
  - "/journal/uploads/rimnova-tech-architecture.jpg"
  - "/journal/uploads/rimyar-desk-scene.jpg"
---

ریمیار رو از اول روی Cloudflare Workers ساختم، نه یک سرور سنتی. دلیلش ساده بود: می‌خواستم چیزی سبک، سریع، و تقریباً بدون هزینه‌ی نگه‌داری داشته باشم.

## چرا Workers؟

:::tip
اگه پروژه‌ت کوچیکه و نیاز به یک سرور همیشه-روشن نداره، Workers یا هر پلتفرم edge دیگه‌ای معمولاً بهترین شروعه.
:::

سه دلیل اصلی:

1. **بدون سرور برای نگه‌داری** — چیزی برای آپدیت کردن یا مانیتور کردن نیست.
2. **تاخیر پایین** — کد نزدیک به کاربر اجرا می‌شه، نه در یک دیتاسنتر دور.
3. **هزینه‌ی پایین** — برای ترافیک متوسط، عملاً رایگانه.

## نمونه‌ای از ساختار پایه

```javascript
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/decide") {
      return handleDecision(request, env);
    }
    return new Response("Not found", { status: 404 });
  },
};
```

## مقایسه‌ی سریع

| ویژگی | سرور سنتی | Cloudflare Workers |
|---|---|---|
| زمان راه‌اندازی | ساعت‌ها | دقیقه |
| مقیاس‌پذیری | دستی | خودکار |
| هزینه‌ی شروع | معمولاً ماهانه | عملاً رایگان |

:::warning
Workers محدودیت‌های اجرایی خودش رو داره (مثل حجم و زمان اجرا) — برای منطق‌های سنگین یا پردازش‌های طولانی مناسب نیست.
:::

قسمت بعدی این مجموعه درباره‌ی تصمیم‌های طراحی UI ریمیار خواهد بود.
