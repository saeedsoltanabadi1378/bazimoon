// Builds the static search pages from seo/content.ts. Called by vite.config.ts at build time.
import { appGame, games, site, type Game, type Lang } from './content.ts'

const ORIGIN = 'https://bazimoon.com'
const langs: Lang[] = ['en', 'fa']
const other = (lang: Lang): Lang => (lang === 'en' ? 'fa' : 'en')

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const digits = (lang: Lang, s: string) => (lang === 'fa' ? s.replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]) : s)

export const landingPath = (lang: Lang) => `/${lang}/`
export const gamePath = (lang: Lang, slug: string) => `/${lang}/${slug}/`
const playHref = (lang: Lang, slug?: string) => (slug ? `/play/${appGame[slug]}?lang=${lang}` : `/?lang=${lang}`)

const css = `
*{box-sizing:border-box}
html{background:#0B0D1A;color-scheme:dark}
body{margin:0;background:#0B0D1A;color:#EDEBF5;font-family:'IBM Plex Sans',system-ui,sans-serif;line-height:1.6}
html[lang=fa] body,html[lang=fa] .brand,html[lang=fa] h1{font-family:'Vazirmatn',Tahoma,sans-serif}
a{color:#C3B9FF}a:hover{color:#E0DAFF}
.wrap{max-width:720px;margin:0 auto;padding:0 16px}
header.top{border-bottom:1px solid #1E2138}
header.top .wrap{display:flex;align-items:center;gap:10px;padding-block:14px}
.logo{display:grid;grid-template-columns:repeat(2,12px);gap:3px}
.logo span{width:12px;height:12px;border-radius:3px}
.brand{flex:1;display:flex;align-items:center;gap:10px;min-height:44px;color:#EDEBF5;text-decoration:none;font-family:'Bricolage Grotesque',sans-serif;font-size:20px;font-weight:800}
.lang{min-height:44px;display:flex;align-items:center;padding:0 10px;color:#C9C8DC;font-size:14px;text-decoration:none}
.btn{display:flex;align-items:center;justify-content:center;min-height:52px;border-radius:16px;background:#C3B9FF;color:#14112B;font-weight:700;font-size:16px;text-decoration:none}
.btn:hover{color:#14112B;filter:brightness(1.08)}
.btn.small{min-height:44px;padding:0 16px;font-size:14px;border-radius:14px}
main{display:flex;flex-direction:column;gap:28px;padding-block:24px 32px}
section{display:flex;flex-direction:column;gap:10px}
h1{margin:0;font-family:'Bricolage Grotesque',sans-serif;font-size:28px;line-height:1.3;font-weight:800}
h2{margin:0;font-size:18px;font-weight:700}
h3{margin:0;font-size:15px;font-weight:600}
p{margin:0}
.lead{font-size:15px;line-height:1.8;color:#C9C8DC}
.note{font-size:12px;color:#9A9CB8;text-align:center}
.muted{font-size:13px;line-height:1.7;color:#C9C8DC}
.card{display:flex;gap:12px;align-items:center;padding:12px;border-radius:16px;background:#151829;color:#EDEBF5;text-decoration:none;min-height:44px}
.card:hover{color:#EDEBF5;background:#1A1E33}
.tile{width:40px;height:40px;flex:none;border-radius:12px;display:flex;align-items:center;justify-content:center;font-weight:800}
.card .t{flex:1;display:flex;flex-direction:column;gap:2px}
.card .n{font-size:15px;font-weight:600}
.card .l{font-size:13px;line-height:1.5;color:#9A9CB8}
.chev{color:#6E7194}
html[dir=rtl] .chev{transform:scaleX(-1)}
.box{padding:12px 14px;border-radius:14px;background:#151829}
.step{display:flex;gap:12px;align-items:flex-start}
.num{width:28px;height:28px;flex:none;border-radius:999px;background:#151829;color:#C3B9FF;font-size:14px;font-weight:700;display:flex;align-items:center;justify-content:center}
.box .num{background:#0B0D1A;width:26px;height:26px;font-size:13px}
.faq{border-bottom:1px solid #1E2138;padding-bottom:10px}
.faq h3{margin-bottom:4px}
ul.feat{margin:0;padding-inline-start:20px;display:flex;flex-direction:column;gap:6px;font-size:14px;color:#C9C8DC}
.chips{display:flex;flex-wrap:wrap;gap:8px}
.chips a{min-height:44px;display:flex;align-items:center;padding:0 14px;border-radius:999px;background:#151829;color:#EDEBF5;font-size:14px;text-decoration:none}
nav.crumb{font-size:13px;color:#9A9CB8}
footer{border-top:1px solid #1E2138}
footer .wrap{padding-block:20px 28px;display:flex;flex-direction:column;gap:8px;font-size:13px;color:#9A9CB8}
footer .links{display:flex;flex-wrap:wrap;gap:16px}
`

const logo = `<span class="logo" aria-hidden="true"><span style="background:#5FD0BE"></span><span style="background:#9C8CFF"></span><span style="background:#F0A83A"></span><span style="background:#F2A7C3"></span></span>`
const chevron = `<svg class="chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 5 7 7-7 7"></path></svg>`

function head(lang: Lang, path: string, otherPath: string, title: string, description: string, jsonLd: object[]) {
  const enPath = lang === 'en' ? path : otherPath
  const faPath = lang === 'fa' ? path : otherPath
  return `<!doctype html>
<html lang="${lang}" dir="${lang === 'fa' ? 'rtl' : 'ltr'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="robots" content="index, follow">
<link rel="canonical" href="${ORIGIN}${path}">
<link rel="alternate" hreflang="en" href="${ORIGIN}${enPath}">
<link rel="alternate" hreflang="fa" href="${ORIGIN}${faPath}">
<link rel="alternate" hreflang="x-default" href="${ORIGIN}${enPath}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(site[lang].brand)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${ORIGIN}${path}">
<meta property="og:image" content="${ORIGIN}/og-image.png">
<meta property="og:locale" content="${lang === 'fa' ? 'fa_IR' : 'en_US'}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#0B0D1A">
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="apple-touch-icon" href="/apple-touch-icon-180x180.png">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@700;800&amp;family=IBM+Plex+Sans:wght@400;600;700&amp;family=Vazirmatn:wght@400;600;700;800&amp;display=swap">
<style>${css}</style>
${jsonLd.map((j) => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, '\\u003c')}</script>`).join('\n')}
</head>
<body>
<header class="top"><div class="wrap">
<a class="brand" href="${landingPath(lang)}">${logo}${esc(site[lang].brand)}</a>
<a class="lang" href="${otherPath}" hreflang="${other(lang)}" lang="${other(lang)}">${esc(site[lang].otherLang)}</a>
<a class="btn small" href="${playHref(lang)}">${esc(site[lang].open)}</a>
</div></header>
<main class="wrap">`
}

function foot(lang: Lang, otherPath: string, extra = '') {
  const s = site[lang]
  return `</main>
<footer><div class="wrap">
<div>${esc(s.footer)}</div>
<div class="links"><a href="${landingPath(lang)}">${esc(s.allGames)}</a><a href="${landingPath(lang)}#install">${esc(s.install)}</a><a href="${otherPath}" hreflang="${other(lang)}" lang="${other(lang)}">${esc(s.otherLangLong)}</a><a href="${playHref(lang)}">${esc(s.open)}</a>${extra}</div>
</div></footer>
</body>
</html>
`
}

const faqLd = (faq: [string, string][]) => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
})

const faqHtml = (faq: [string, string][]) => faq.map(([q, a]) => `<div class="faq"><h3>${esc(q)}</h3><p class="muted">${esc(a)}</p></div>`).join('\n')

function landing(lang: Lang) {
  const s = site[lang]
  const path = landingPath(lang)
  const otherPath = landingPath(other(lang))
  const groups = (Object.keys(s.groups) as Game['group'][]).map((g) => {
    const cards = games.filter((x) => x.group === g).map((x) => {
      const p = x[lang]
      return `<a class="card" href="${gamePath(lang, x.slug)}"><span class="tile" aria-hidden="true" style="background:${x.bg};color:${x.fg}">${esc(p.name.charAt(0))}</span><span class="t"><span class="n">${esc(p.name)}</span><span class="l">${esc(p.line)}</span></span>${chevron}</a>`
    })
    return `<section><h2>${esc(s.groups[g])}</h2>\n${cards.join('\n')}\n</section>`
  })
  const ld = [
    {
      '@context': 'https://schema.org', '@type': 'WebSite', name: s.brand, alternateName: lang === 'fa' ? 'Bazimoon' : 'بازیمون',
      url: `${ORIGIN}${path}`, inLanguage: lang, description: s.description,
    },
    faqLd(s.faq),
  ]
  return head(lang, path, otherPath, s.title, s.description, ld) + `
<section>
<h1>${esc(s.h1)}</h1>
<p class="lead">${esc(s.intro)}</p>
<a class="btn" href="${playHref(lang)}">${esc(s.cta)}</a>
<p class="note">${esc(s.ctaNote)}</p>
</section>
${groups.join('\n')}
<section>
<h2>${esc(s.whyTitle)}</h2>
${s.why.map(([t, d]) => `<div class="box"><h3>${esc(t)}</h3><p class="muted">${esc(d)}</p></div>`).join('\n')}
</section>
<section id="install">
<h2>${esc(s.installTitle)}</h2>
<p class="muted">${esc(s.installIntro)}</p>
${s.platforms.map(([name, steps]) => `<div class="box"><h3>${esc(name)}</h3>${steps.map((t, i) => `<div class="step" style="margin-top:10px"><span class="num">${digits(lang, String(i + 1))}</span><span>${esc(t)}</span></div>`).join('')}</div>`).join('\n')}
<p class="note" style="text-align:start">${esc(s.installNote)}</p>
</section>
<section>
<h2>${esc(s.faqTitle)}</h2>
${faqHtml(s.faq)}
</section>
` + foot(lang, otherPath)
}

function gamePage(lang: Lang, g: Game) {
  const s = site[lang]
  const p = g[lang]
  const path = gamePath(lang, g.slug)
  const otherPath = gamePath(other(lang), g.slug)
  const more = games.filter((x) => x.slug !== g.slug).map((x) => `<a href="${gamePath(lang, x.slug)}">${esc(x[lang].name)}</a>`)
  const ld = [
    {
      '@context': 'https://schema.org', '@type': 'VideoGame', name: p.name, url: `${ORIGIN}${path}`, inLanguage: lang,
      description: p.description, genre: s.groups[g.group], gamePlatform: 'Web browser', applicationCategory: 'GameApplication',
      operatingSystem: 'Any', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      publisher: { '@type': 'Organization', name: 'Bazimoon', url: ORIGIN },
    },
    {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: s.home, item: `${ORIGIN}${landingPath(lang)}` },
        { '@type': 'ListItem', position: 2, name: p.name, item: `${ORIGIN}${path}` },
      ],
    },
    faqLd(p.faq),
  ]
  return head(lang, path, otherPath, p.title, p.description, ld) + `
<nav class="crumb" aria-label="${esc(s.crumbLabel)}"><a href="${landingPath(lang)}">${esc(s.home)}</a> / ${esc(p.name)}</nav>
<section>
<h1>${esc(p.h1)}</h1>
<p class="lead">${esc(p.intro)}</p>
<a class="btn" href="${playHref(lang, g.slug)}" style="background:${g.fg}">${esc(s.play(p.name))}</a>
<p class="note">${esc(s.ctaNote)}</p>
</section>
<section>
<h2>${esc(s.howTitle(p.name))}</h2>
${p.steps.map(([t, d], i) => `<div class="step"><span class="num" style="color:${g.fg}">${digits(lang, String(i + 1))}</span><div><h3>${esc(t)}</h3><p class="muted">${esc(d)}</p></div></div>`).join('\n')}
</section>
<section>
<h2>${esc(s.featTitle)}</h2>
<ul class="feat">${p.features.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>
</section>
<section>
<h2>${esc(s.faqTitle)}</h2>
${faqHtml(p.faq)}
</section>
<section>
<h2>${esc(s.moreTitle)}</h2>
<div class="chips">${more.join('')}</div>
</section>
` + foot(lang, otherPath)
}

/** Every search page as [file name in dist, html]. */
export function searchPages(): [string, string][] {
  const out: [string, string][] = []
  for (const lang of langs) {
    out.push([`${lang}/index.html`, landing(lang)])
    for (const g of games) out.push([`${lang}/${g.slug}/index.html`, gamePage(lang, g)])
  }
  return out
}

/** Sitemap with the app root, both landing pages and every game page, each with its language twin. */
export function sitemap(): string {
  const entry = (loc: string, en: string, fa: string, priority: string) => `  <url>
    <loc>${ORIGIN}${loc}</loc>
    <xhtml:link rel="alternate" hreflang="en" href="${ORIGIN}${en}" />
    <xhtml:link rel="alternate" hreflang="fa" href="${ORIGIN}${fa}" />
    <xhtml:link rel="alternate" hreflang="x-default" href="${ORIGIN}${en}" />
    <changefreq>weekly</changefreq>
    <priority>${priority}</priority>
  </url>`
  const urls = [`  <url>
    <loc>${ORIGIN}/</loc>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>`]
  for (const lang of langs) urls.push(entry(landingPath(lang), landingPath('en'), landingPath('fa'), '1.0'))
  for (const g of games) for (const lang of langs) urls.push(entry(gamePath(lang, g.slug), gamePath('en', g.slug), gamePath('fa', g.slug), '0.9'))
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.join('\n')}
</urlset>
`
}
