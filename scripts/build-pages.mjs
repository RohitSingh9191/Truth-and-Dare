// Writes the question-list pages (for people who search Google for truth and dare questions)
// into public/<page>/index.html. Each page is plain HTML that Google can read without running
// the game, uses real questions from content/questions/, and links to the game.
// Run by `npm run dev` and `npm run build`. Never puts 18+ "Very hot" cards on a public page.

import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';

const env = readFileSync('.env', 'utf8');
const SITE = (process.env.VITE_SITE_URL || env.match(/^VITE_SITE_URL=(.+)$/m)?.[1] || '').trim().replace(/\/$/, '');
const bank = (level) => JSON.parse(readFileSync(`content/questions/${level}.json`, 'utf8')).cards;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** n cards of a type, spread evenly through the level so the list feels varied (and stays stable). */
function pick(level, type, n, { heats = [0, 1, 2], lang = 'en' } = {}) {
  const list = bank(level).filter((c) => c.type === type && heats.includes(c.heat || 0) && (lang === 'en' || c.hi));
  const step = Math.max(1, Math.floor(list.length / n));
  return list.filter((_, i) => i % step === 0).slice(0, n).map((c) => (lang === 'hi' ? c.hi : c.en));
}

const PAGES = [
  {
    slug: 'truth-and-dare-questions',
    title: 'Truth and Dare Questions: 100 Best Truths and Dares | Truth n Dare',
    h1: 'Truth and Dare Questions',
    desc: 'The best truth and dare questions for friends, family and parties: funny truths, easy dares and group games. Play them free with a spinning bottle.',
    play: '/?level=friends&ref=page',
    intro: [
      'Running out of ideas is the fastest way to end a game of truth and dare. Here are 100 of our favourite questions, taken from the 800 in the Truth n Dare game: honest but kind truths, dares you can do right where you sit, and quick group questions everyone answers at once.',
      'Every dare stays in the room and takes about a minute. No calling, no posting and nothing risky. And anyone can skip a card, no questions asked.',
    ],
    lists: [
      ['Funny truth questions', pick('friends', 'truth', 30)],
      ['Dares you can do anywhere', pick('friends', 'dare', 30)],
      ['Bolder truths for parties (16+)', pick('party', 'truth', 20)],
      ['Would you rather', pick('friends', 'would-you-rather', 10)],
      ['Never have I ever', pick('friends', 'never-have-i-ever', 10)],
    ],
    faq: [
      ['How do you play truth and dare?', 'Sit in a circle. One player is picked, for example by spinning a bottle, and chooses truth or dare. A truth is a question they answer honestly; a dare is a small task they do right away. Then the next player is picked.'],
      ['What are good truth and dare questions for friends?', 'Good questions are funny and a little embarrassing but never mean, like asking about a secret favourite song or the weirdest thing someone searched online. The lists above are a good start, and the Friends page has more.'],
      ['What if someone does not want to answer?', 'Let them skip. In Truth n Dare, Skip is free and unlimited, because the game should be fun for everyone.'],
      ['Is Truth n Dare free?', 'Yes. It is free, needs no sign-up, has no ads and works offline after the first visit.'],
    ],
  },
  {
    slug: 'truth-and-dare-questions-for-friends',
    title: 'Truth and Dare Questions for Friends: Funny Truths and Dares | Truth n Dare',
    h1: 'Truth and Dare Questions for Friends',
    desc: 'Funny truth and dare questions for friends: 75 truths, dares and group questions for hangouts, sleepovers and college nights. Free, with a spinning bottle.',
    play: '/?level=friends&ref=page',
    intro: [
      'These questions are made for school and college friends, cousins and hostel nights: funny and a little embarrassing, never mean. Crushes stay unnamed, and nothing touches on looks, exes or anything that could hurt.',
      'Want to play them properly? Put a phone in the middle, open Truth n Dare and spin the bottle. It picks fairly and never shows the same card twice until you have seen them all.',
    ],
    lists: [
      ['Truth questions for friends', pick('friends', 'truth', 30)],
      ['Dares for friends', pick('friends', 'dare', 25)],
      ['Never have I ever (friends edition)', pick('friends', 'never-have-i-ever', 10)],
      ['Who is most likely to…', pick('friends', 'most-likely-to', 10)],
    ],
    faq: [
      ['What are funny truth questions to ask friends?', 'Ask about harmless secrets and awkward moments, like a song they secretly love or a habit they hope nobody has noticed. Funny works best when nobody is embarrassed in a hurtful way.'],
      ['What are good dares for friends at home?', 'Dares that need nothing but the room: acting, silly voices, quick challenges with a cushion or paper. Every dare above takes about a minute.'],
      ['How many players do you need?', 'Two or more. With Truth n Dare you can add up to 20 names, or just put the phone in the middle and let everyone pick a number on the circle.'],
      ['Is this suitable for teenagers?', 'Yes. The Friends level is made for ages 13 and up: no kissing, touching, alcohol or sexual topics.'],
    ],
  },
  {
    slug: 'truth-and-dare-questions-for-couples',
    title: 'Truth and Dare Questions for Couples: Romantic and Fun | Truth n Dare',
    h1: 'Truth and Dare Questions for Couples',
    desc: 'Romantic and fun truth and dare questions for couples: sweet memories, playful dares and would-you-rather questions for date night. Free couples game.',
    play: '/?level=couples&ref=page',
    intro: [
      'A good couples game is part memory lane, part flirting. These questions are for two partners on a date night, together or on a video call: sweet truths about your story, playful dares, and would-you-rather questions that start a real conversation.',
      'Every touch dare asks for your partner’s okay first, and either of you can skip any card. In the game, the Couples level has three heat levels, from sweet to very hot, for adults only.',
    ],
    lists: [
      ['Truth questions for couples', [...pick('couples', 'truth', 15, { heats: [1] }), ...pick('couples', 'truth', 10, { heats: [2] })]],
      ['Dares for couples', [...pick('couples', 'dare', 15, { heats: [1] }), ...pick('couples', 'dare', 5, { heats: [2] })]],
      ['Would you rather (couples)', pick('couples', 'would-you-rather', 8, { heats: [1, 2] })],
      ['Which of you is more likely to…', pick('couples', 'most-likely-to', 8, { heats: [1, 2] })],
    ],
    faq: [
      ['What are good truth questions for couples?', 'Questions about your shared story work best: your first impression of each other, a small moment that made you fall for them, or a habit of theirs you secretly love.'],
      ['Can we play over a video call?', 'Yes. Most truths and many dares work on a video call. Open Truth n Dare on one phone and take turns.'],
      ['Is the couples game only for adults?', 'The Couples level in the game is 18+ and asks everyone to confirm their age. The questions on this page are the sweet and lightly flirty ones.'],
      ['Do we need names?', 'No. With two names the bottle simply alternates between you, so you both get the same number of turns.'],
    ],
  },
  {
    slug: 'truth-and-dare-for-kids',
    title: 'Truth and Dare for Kids and Family: Safe, Funny Questions | Truth n Dare',
    h1: 'Truth and Dare for Kids and Family',
    desc: 'Safe, funny truth and dare questions for kids and the whole family: silly truths, acting and animal dares, would-you-rather questions. Free family game.',
    play: '/?level=kids&ref=page',
    intro: [
      'Truth and dare can be a lovely family game when the questions are right. These are made for children playing with parents, grandparents and cousins: silly, kind and imaginative, with acting and animal dares instead of anything embarrassing.',
      'No crushes, no romance, no phones and no scary topics. In the game, Family mode keeps the grown-up levels hidden behind a PIN.',
    ],
    lists: [
      ['Truth questions for kids', pick('kids', 'truth', 30)],
      ['Dares for kids', pick('kids', 'dare', 25)],
      ['Would you rather (for kids)', pick('kids', 'would-you-rather', 10)],
    ],
    faq: [
      ['What are good truth questions for kids?', 'Imaginative ones: which animal would be you for a day, what you would invent, or the funniest dream you remember. Kids love questions where there is no wrong answer.'],
      ['What are safe dares for kids?', 'Acting, animal sounds, silly walks and small challenges with things like a cushion or paper. Nothing with food, phones or anything that could hurt.'],
      ['Is Truth n Dare safe for children?', 'The Kids & Family level is for all ages, and Family mode hides the Party and 18+ levels. There are no ads, no accounts and nothing personal is collected.'],
    ],
  },
  {
    slug: 'truth-and-dare-questions-in-hindi',
    lang: 'hi-Latn',
    title: 'Truth and Dare Questions in Hindi (Hinglish) | Truth n Dare',
    h1: 'Truth and Dare Questions in Hindi',
    desc: 'Truth and dare questions in Hindi (Hinglish): funny truth sawaal aur dares dosto aur family ke liye. Bottle ghumaiye aur free mein kheliye.',
    play: '/?level=friends&lang=hi&ref=page',
    intro: [
      'Dosto ke saath truth and dare khelna hai, par Hindi mein? Yahan Hinglish mein (Hindi, English letters mein) best truth sawaal aur dares hain: thode funny, thode embarrassing, par kabhi mean nahi.',
      'Truth n Dare game mein ek tap mein English aur Hinglish badal sakte hain. Phone ko beech mein rakhiye, bottle ghumaiye aur kheliye. Free hai, sign-up nahi chahiye.',
    ],
    lists: [
      ['Truth sawaal (dosto ke liye)', pick('friends', 'truth', 30, { lang: 'hi' })],
      ['Dares (dosto ke liye)', pick('friends', 'dare', 20, { lang: 'hi' })],
      ['Family ke liye truth sawaal', pick('kids', 'truth', 15, { lang: 'hi' })],
      ['Never have I ever (Hinglish)', pick('friends', 'never-have-i-ever', 10, { lang: 'hi' })],
    ],
    faq: [
      ['Truth and dare Hindi mein kaise khelte hain?', 'Sab gol ghere mein baith jaiye. Bottle ghumaiye; jiski taraf ruke, woh truth ya dare chune. Truth mein sach bolna hai, dare mein ek chhota sa task karna hai.'],
      ['Kya yeh game free hai?', 'Haan, Truth n Dare bilkul free hai, koi sign-up nahi, koi ads nahi, aur pehli baar ke baad internet ke bina bhi chalta hai.'],
      ['Kya Hindi script (देवनागरी) mein bhi milega?', 'Abhi sawaal Hinglish mein hain, yaani Hindi English letters mein. Devanagari jaldi aayega.'],
    ],
  },
  {
    slug: 'spin-the-bottle-game',
    title: 'Spin the Bottle Game Online: Free Truth or Dare | Truth n Dare',
    h1: 'Spin the Bottle Game Online',
    desc: 'Play spin the bottle online for free: a real spinning bottle on your phone that picks a player for truth or dare. Fair, no sign-up, works offline.',
    play: '/?ref=page',
    intro: [
      'Spin the bottle without a bottle: open Truth n Dare on any phone, put it in the middle of the group and tap SPIN, or flick the bottle with your finger. It spins and slows down like a real one, then points at whoever plays next.',
      'Then that player picks truth or dare, and the game shows a question. It is a friendly party game: the bottle only picks who plays, there are no kissing rules, and anyone can skip a card.',
    ],
    lists: [
      ['Truths to start with', pick('friends', 'truth', 10)],
      ['Dares to start with', pick('friends', 'dare', 10)],
    ],
    howTo: [
      'Open the game and put the phone in the middle of the group.',
      'Everyone takes the numbered part of the circle nearest them, or type your names so they sit around the bottle.',
      'Tap SPIN, tap the bottle, or flick it. Whoever it points at chooses truth or dare.',
      'Play the card, tap Done, and spin again.',
    ],
    faq: [
      ['Is the online bottle spin random?', 'Yes. The game picks the result with secure random numbers before the bottle stops, so nobody can aim. With names, everyone plays once before anyone goes again.'],
      ['Can we play spin the bottle without names?', 'Yes. The circle has 12 numbered parts; everyone takes the number nearest them and the bottle always stops clearly inside one part.'],
      ['Does it work offline?', 'Yes. After the first visit the whole game works without internet, and you can install it on your phone or computer like an app.'],
    ],
  },
  {
    slug: 'never-have-i-ever-questions',
    title: 'Never Have I Ever Questions: Funny List for Friends and Family | Truth n Dare',
    h1: 'Never Have I Ever Questions',
    desc: 'Funny never have I ever questions for friends, family and parties. Anyone who has done it raises a hand. Clean, easy and free to play.',
    play: '/?level=friends&ref=page',
    intro: [
      'Never have I ever is the easiest group game there is: someone reads a line, and everyone who has done it raises a hand and, if they want, tells the story. These questions are clean and funny, sorted from family-friendly to party.',
      'In Truth n Dare, a never have I ever round comes up every few turns between truths and dares, so the whole group gets to play.',
    ],
    lists: [
      ['For kids and family', pick('kids', 'never-have-i-ever', 10)],
      ['For friends', pick('friends', 'never-have-i-ever', 10)],
      ['For parties (16+)', pick('party', 'never-have-i-ever', 10)],
    ],
    faq: [
      ['How do you play never have I ever?', 'One person reads a line starting “Never have I ever…”. Everyone who has done it raises a hand. Players can share the story behind it if they like.'],
      ['Can kids play never have I ever?', 'Yes, with the family questions above: they are about everyday things like forgetting homework or getting lost, never anything embarrassing.'],
    ],
  },
  {
    slug: 'would-you-rather-questions',
    title: 'Would You Rather Questions: Funny Choices for Everyone | Truth n Dare',
    h1: 'Would You Rather Questions',
    desc: 'Funny would you rather questions for kids, friends and parties: impossible choices that start the best conversations. Free to play with your group.',
    play: '/?level=friends&ref=page',
    intro: [
      'A good would you rather question has no easy answer. Everyone picks a side at the same time, then a few people explain why, and that is where the fun starts. Here are some of our favourites, sorted from kids to party.',
      'In Truth n Dare these come up as group rounds between truths and dares, so nobody sits out for long.',
    ],
    lists: [
      ['For kids and family', pick('kids', 'would-you-rather', 10)],
      ['For friends', pick('friends', 'would-you-rather', 10)],
      ['For parties (16+)', pick('party', 'would-you-rather', 10)],
    ],
    faq: [
      ['How do you play would you rather?', 'One person reads a question with two choices. Everyone answers at the same moment by pointing left or right, then a few players explain their choice.'],
      ['What makes a good would you rather question?', 'Two options that are equally good, or equally bad, so the group is split. Funny beats gross, and kind beats mean.'],
    ],
  },
];

const css = `:root{color-scheme:dark light;--bg:#15112b;--surface:#262051;--text:#f7f4ff;--muted:#b9b1df;--lvl:#2ed3c1;--ink:#002420}
@media (prefers-color-scheme:light){:root{--bg:#f6f3ff;--surface:#fff;--text:#1b1638;--muted:#5d5683;--lvl:#0f8f83;--ink:#fff}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:17px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
header{position:sticky;top:0;display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 16px;background:var(--bg);border-bottom:1px solid rgba(127,127,127,.2)}
.brand{font-weight:900;color:var(--text);text-decoration:none;font-size:1.15em;display:flex;align-items:center;gap:8px}.brand img{width:28px;height:28px}
.play{background:var(--lvl);color:var(--ink);font-weight:800;text-decoration:none;padding:10px 16px;border-radius:999px;min-height:44px;display:inline-flex;align-items:center}
main{max-width:760px;margin:0 auto;padding:12px 16px 40px}.crumbs{font-size:.85em;color:var(--muted)}.crumbs a{color:var(--muted)}
h1{font-size:clamp(1.7em,6vw,2.3em);line-height:1.15;margin:.4em 0}h2{font-size:1.3em;margin:1.6em 0 .5em}h3{font-size:1.05em;margin:1.2em 0 .3em}
.lead{color:var(--muted)}.cta{display:block;text-align:center;margin:18px 0;padding:16px;border-radius:18px;background:var(--lvl);color:var(--ink);font-weight:900;font-size:1.15em;text-decoration:none}
ol{padding-left:1.4em}li{margin:.45em 0}a{color:var(--lvl)}.more{display:flex;flex-wrap:wrap;gap:8px;padding:0;list-style:none}
.more a{display:inline-block;padding:10px 14px;border-radius:999px;background:var(--surface);text-decoration:none;color:var(--text);min-height:44px}
footer{max-width:760px;margin:0 auto;padding:20px 16px 40px;color:var(--muted);font-size:.85em}footer a{color:var(--muted)}`;

function render(p, all) {
  const url = `${SITE}/${p.slug}/`;
  const ld = [
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Truth n Dare', item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: p.h1, item: url },
    ] },
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: p.faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
  ];
  const lists = p.lists.map(([h, items]) => `<h2>${esc(h)}</h2>\n<ol>\n${items.map((x) => `<li>${esc(x)}</li>`).join('\n')}\n</ol>`).join('\n');
  const how = p.howTo ? `<h2>How to play spin the bottle online</h2><ol>${p.howTo.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>` : '';
  const others = all.filter((o) => o.slug !== p.slug).map((o) => `<li><a href="/${o.slug}/">${esc(o.h1)}</a></li>`).join('');
  return `<!doctype html>
<html lang="${p.lang || 'en'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(p.title)}</title>
<meta name="description" content="${esc(p.desc)}">
<link rel="canonical" href="${url}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon-96.png" sizes="96x96" type="image/png">
<meta name="theme-color" content="#15112b">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Truth n Dare">
<meta property="og:title" content="${esc(p.h1)}">
<meta property="og:description" content="${esc(p.desc)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE}/og.jpg">
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">${JSON.stringify(ld)}</script>
<style>${css}</style>
</head>
<body>
<header><a class="brand" href="/"><img src="/favicon.svg" alt="" width="28" height="28">Truth n Dare</a><a class="play" href="${p.play}">Play free</a></header>
<main>
<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Truth n Dare</a> › ${esc(p.h1)}</nav>
<h1>${esc(p.h1)}</h1>
${p.intro.map((x, i) => `<p${i ? '' : ' class="lead"'}>${esc(x)}</p>`).join('\n')}
<a class="cta" href="${p.play}">▶ Play with the spinning bottle</a>
${lists}
${how}
<a class="cta" href="${p.play}">▶ Play these in the game (free)</a>
<h2>Questions people ask</h2>
${p.faq.map(([q, a]) => `<h3>${esc(q)}</h3>\n<p>${esc(a)}</p>`).join('\n')}
<h2>More question lists</h2>
<ul class="more">${others}</ul>
</main>
<footer><a href="/">Play Truth n Dare</a> · <a href="/privacy.html">Privacy</a> · Developed by Rohit Singh</footer>
</body>
</html>
`;
}

// Fresh pages every build (a removed page must not linger).
for (const p of PAGES) {
  if (existsSync(`public/${p.slug}`)) rmSync(`public/${p.slug}`, { recursive: true });
}
for (const p of PAGES) {
  for (const [h, items] of p.lists) if (items.length < 5) throw new Error(`${p.slug}: "${h}" has only ${items.length} questions`);
  mkdirSync(`public/${p.slug}`, { recursive: true });
  writeFileSync(`public/${p.slug}/index.html`, render(p, PAGES));
}
writeFileSync('public/pages.json', JSON.stringify(PAGES.map((p) => ({ slug: p.slug, title: p.h1 }))));
console.log(`question pages: ${PAGES.length} written`);
