# Load — calorie & strength planner

A bilingual (English / 简体中文) planner for a diet, maintenance or bulk. It works out
your daily calories and macros, projects where your body composition and lifts land at
the end, tells you how often you can afford a cheat meal, and lets you build a day of
food from a tap-to-add list.

Lifting and cardio are tracked as separate modalities, each with its own days, session
length and type. Carbs can run steady, cycled, or **phased** — the default — which is
flat for the first 40% of the plan and fully cycled for the last 40%, with a graded
transition between. Every block is re-solved at the weight you will actually be
carrying by then, so the calorie targets step down as the plan runs.

The daily calorie number is editable: type over it, or click any checkpoint row to
adopt that week's figure. Protein is a flat g/kg of bodyweight and never moves;
carbs and fat swing in opposite directions between training and rest days, with the
weekly total of every macro preserved exactly.

**It keeps a record.** Press start and it logs a weigh-in a day for the length of
the plan, averages each week, draws those averages against the planned line, and
compares your measured rate to the planned one — telling you what calorie change
would close the gap, or to leave it alone when the difference is just noise.
Everything is stored on your own device; if the browser blocks storage the page
says so rather than losing your record quietly, and a backup box exports the whole
thing as text.

**The meal planner solves portions for you.** Pick what goes into each of three meals
plus an optional post-workout meal, and the grams — or piece counts — are worked out
so the day lands on its targets. Type or nudge any amount to pin it and everything
else re-solves around it.

**The whole app is one self-contained `index.html`.** No build step, no dependencies,
no network requests at runtime — the display font and the favicon are inlined as data
URIs, and the CSS and JS are inline. You can email the file to someone and it works.
Your inputs are saved in `localStorage` on your own device and never leave it.

---

## Run it locally

Any of these — no install required beyond what you already have:

```bash
# Python (already on most machines)
python3 -m http.server 8080

# Node
npx serve . --listen 8080
# or: npm run dev

# PHP
php -S localhost:8080
```

Then open <http://localhost:8080>.

You can also just double-click `index.html`. Serving it over HTTP is slightly better
(it guarantees the UTF-8 charset header, which matters for the Chinese text), but
the file declares its own charset so opening it directly works too.

---

## Deploy it

The site is static, so every host below is a one-liner. Pick one.

### GitHub Pages

Push to `main` and the included workflow does the rest.

```bash
git init && git add -A && git commit -m "Load — calorie & strength planner"
git branch -M main
git remote add origin git@github.com:USER/REPO.git
git push -u origin main
```

Then in the repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
`.github/workflows/deploy-pages.yml` syntax-checks the inline script before publishing.

### Netlify

```bash
npx netlify-cli deploy --prod --dir .
```

Or connect the repo in the Netlify UI — leave the build command empty and set the
publish directory to `.`. `netlify.toml` supplies the security headers.

### Vercel

```bash
npx vercel --prod
```

`vercel.json` supplies the same headers. There is no framework to detect; accept the
"Other" preset.

### Cloudflare Pages

```bash
npx wrangler pages deploy . --project-name load-planner
```

Build command: none. Output directory: `.`

### Docker / your own server

```bash
docker build -t load-planner .
docker run --rm -p 8080:8080 load-planner
```

Serves on port 8080 as an unprivileged user, with gzip, UTF-8 and the CSP from
`nginx.conf`. Behind a reverse proxy, terminate TLS there and forward to 8080.

### Anything else

Copy `index.html` (and optionally `404.html`, `robots.txt`) to any static host — S3 +
CloudFront, nginx, Apache, Caddy, a USB stick. Make sure HTML is served as
`text/html; charset=utf-8`.

---

## Security headers

The app makes zero outbound requests, so the shipped Content-Security-Policy locks it
down to exactly what it needs:

```
default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline';
script-src 'unsafe-inline'; font-src data:; base-uri 'none';
form-action 'none'; frame-ancestors 'none'
```

`'unsafe-inline'` is required because the CSS and JS are inline — that is the price of
the single-file design. Since `default-src` is `'none'`, no script can call out
anywhere even if one were injected.

---

## Files

| File | Purpose |
|---|---|
| `index.html` | The entire application |
| `404.html` | Bilingual not-found page |
| `netlify.toml`, `vercel.json` | Host config + security headers |
| `Dockerfile`, `nginx.conf` | Self-hosting |
| `.github/workflows/deploy-pages.yml` | GitHub Pages CI |
| `package.json` | Local preview scripts only — no runtime dependencies |

---

## Editing

Everything lives in `index.html`, in this order: `<style>` (design tokens first),
markup, then one `<script>` containing — in order — the English strings (`EN`), the
Chinese strings (`ZH`), the food database and model, and the render/wiring layer.

- **Translations**: edit the `EN` and `ZH` objects. Keys match; a value is a plain
  string, or a function when a number is interpolated. Static markup pulls strings via
  `data-i18n` / `data-i18n-html` / `data-i18n-ph` / `data-i18n-aria` attributes.
- **Adding a language**: add a third object, register it in `DICT`, and add a button
  to the language `.seg` in the masthead.
- **Foods**: add an entry to `FOODS` with `n` (English) and `z` (Chinese) names,
  macros per 100 g, and a default serving. Give it `each` (grams per piece) plus
  `eu`/`zeu` (unit names) and it is counted in pieces instead of grams — that is
  how eggs, bananas, apples, bread slices and whey scoops behave. Grams stay the
  storage unit either way, so nothing downstream changes. Users can also add
  their own foods in-app.
- **The record**: `S.log.entries` is a flat `{ 'YYYY-MM-DD': kg }` map; `compute()`
  turns it into `logWeeks` (weekly averages against the planned weight at each
  week's midpoint) and `trend` (measured vs planned rate, plus the calorie
  adjustment that would close the gap). `STORAGE_OK` records whether
  `localStorage` actually worked, so a sandboxed frame is reported rather than
  silently dropping everything.
- **Meal solver**: `solveAmounts` is non-negative least squares by multiplicative
  update, over four objectives (protein, carbs, fat, calories) with the weights in
  `OBJ_W`. `foodCap` decides how much of one food is a sane maximum for a meal —
  keyed off protein density, not calories, because a lean protein has to be allowed
  to dominate a small rest-day meal. `roundPortion` snaps to 5 g or half-pieces.
- **Carb strategy**: `PHASE_PLAN` defines the phased blocks as
  `{from, to, spread}` fractions of the plan — the default is 40% flat, 20% at
  half cycling amplitude, 40% fully cycled. `spread` blends between no cycling
  and full; the weekly carb total is preserved at every value, so changing the
  split cannot change the rate the scale moves.
- **Model constants** (muscle-gain ceilings, MET values, rate guardrails, tissue
  energy costs) sit near the top of the script with the assumptions spelled out in the
  page's own "How the numbers are worked out" section — keep the two in sync.

---

## What the numbers mean

Every figure is an estimate from population averages; individual burn varies by
roughly ±10% around any formula. The page documents its own assumptions in full —
BMR formula, MET rates, tissue energy costs, muscle-gain ceilings, the concurrent
training penalty, the p-ratio for lean-mass loss, and all three carb strategies.

General fitness information, not medical advice.

---

## 简体中文

**Load** 是一个中英双语的热量与力量规划器，支持减脂 / 保持 / 增肌三种模式，会计算每日热量和三大营养素、
预测计划结束时的身体成分与力量变化、告诉你多久能吃一次欺骗餐，并提供点击即加的食物清单。

整个应用就是一个自包含的 `index.html`：没有构建步骤、没有依赖、运行时不发起任何网络请求。字体和图标都以
data URI 内联，CSS 和 JS 也都内联。你的输入保存在本机浏览器的 `localStorage` 中，不会离开你的设备。

**本地运行**：`python3 -m http.server 8080`，然后打开 <http://localhost:8080>。也可以直接双击
`index.html` 打开。

**部署**：推送到 GitHub 即可用自带的 Actions 发布到 GitHub Pages；或者
`npx vercel --prod`、`npx netlify-cli deploy --prod --dir .`、
`npx wrangler pages deploy .`；也可以用 `docker build -t load-planner . && docker run -p 8080:8080 load-planner`
自行托管。请确保 HTML 以 `text/html; charset=utf-8` 提供。

**语言切换**：页面右上角的 `EN / 中文` 按钮，选择会随其他设置一起保存。

**每日目标可改**：直接在大数字上输入，或点击检查点表格中的任意一行采用那一周的数值。
蛋白质按每公斤体重固定克数、全程不变；碳水和脂肪在训练日与休息日之间反向摆动，三大营养素的一周总量精确保留。

**分餐会自动算份量**：在三餐加一个可选的练后加餐里选好食物，程序会算出每样吃多少克（或几个），
让全天正好落在目标上。手动输入或用加减号调整任一份量即可固定它，其余部分会围着它重新求解。

**记录功能**：点「今天开始」后，页面会按计划天数每天记录一次体重，自动算出周平均，
把它画在计划曲线旁边，并把实测速度和计划速度做对照——差距大就告诉你每天该调整多少热量，
差距在噪音范围内就明确让你别动。所有数据保存在你自己的设备上；如果浏览器禁止保存，
页面会直说，而不是悄悄丢掉你的记录，下面的备份框可以把全部内容导出成文本。

**碳水策略**：默认使用「分阶段」——前 40% 恒定，中间 20% 过渡，最后 40% 完全碳水循环；
每个阶段都按你那时的实际体重重新计算热量。也可以切换为全程恒定或全程循环。
鸡蛋、香蕉、苹果、面包片、蛋白粉等按「个 / 根 / 片 / 勺」计数，其余食物按克计。

页面内的"这些数字是怎么算出来的"一节完整说明了所有计算假设。本页面提供的是一般健身信息，不构成医疗建议。

---

MIT licensed. Food values are USDA reference data, per 100 g of the edible portion.
