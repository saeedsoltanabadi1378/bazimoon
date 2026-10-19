import type { Lang } from './content.ts'

export interface GuideSection {
  heading: string
  paragraphs: string[]
  bullets?: string[]
}

export interface GuidePage {
  label: string
  title: string
  description: string
  h1: string
  intro: string
  readTime: string
  sections: GuideSection[]
  faq: [string, string][]
  gameSlug: 'mafia' | 'spy'
  playLabel: string
}

export interface Guide {
  slug: string
  bg: string
  fg: string
  en: GuidePage
  fa: GuidePage
}

export const guideHub: Record<Lang, {
  title: string
  description: string
  h1: string
  intro: string
  label: string
  read: string
}> = {
  en: {
    title: 'Game guides: rules, roles and tips | Bazimoon',
    description: 'Learn how to play Mafia and Spy with clear rules, examples, role explanations and practical tips for your next game night.',
    h1: 'Game guides',
    intro: 'Clear rules, useful examples and beginner-friendly tips for the games you can play with friends on Bazimoon.',
    label: 'Guides',
    read: 'Read guide',
  },
  fa: {
    title: 'آموزش بازی‌ها؛ قوانین، نقش‌ها و نکته‌ها | بازیمون',
    description: 'قوانین بازی مافیا و جاسوس را همراه با مثال، توضیح نقش‌ها و نکته‌های کاربردی برای دورهمی بعدی یاد بگیرید.',
    h1: 'آموزش بازی‌ها',
    intro: 'قوانین روشن، مثال‌های کاربردی و نکته‌های ساده برای بازی‌هایی که می‌توانید با دوستانتان در بازیمون انجام دهید.',
    label: 'آموزش‌ها',
    read: 'خواندن آموزش',
  },
}

export const guides: Guide[] = [
  {
    slug: 'how-to-play-mafia', bg: '#1E2138', fg: '#C3B9FF',
    en: {
      label: 'Mafia rules and roles',
      title: 'How to play Mafia: complete rules and roles | Bazimoon',
      description: 'Learn how to play Mafia step by step: setup, night and day phases, voting, win conditions, common roles and beginner strategy.',
      h1: 'How to play Mafia: rules, roles and strategy',
      intro: 'Mafia is a social deduction game about reading people, hiding information and persuading the group. A small Mafia team acts in secret while the Town tries to identify and vote them out.',
      readTime: '8 minute read',
      sections: [
        {
          heading: 'What you need',
          paragraphs: ['You need at least 3 players, although 6 to 10 creates a more balanced discussion. In Bazimoon, one player creates a table and shares its link or code. Voice chat, role assignment, timers and voting are handled inside the game.'],
          bullets: ['3 to 12 players', 'One private role for every player', 'A quiet place to talk', 'About 15 to 40 minutes'],
        },
        {
          heading: 'The teams and win conditions',
          paragraphs: ['Most players belong to the Town. Their goal is to remove every Mafia player. The smaller Mafia team knows each other and wins when its surviving members equal the number of Town players. Independent roles such as the Joker can have their own win condition.'],
        },
        {
          heading: 'Set up the game',
          paragraphs: ['Choose a Classic setup for a straightforward first game, or customise the roles and table rules. Each player joins the table, checks their secret role alone and marks themselves ready. Never reveal the role screen to another player.'],
          bullets: ['For a first game, use one Mafia member for roughly every three players.', 'Keep advanced roles limited until everyone knows the day-and-night rhythm.', 'Agree whether eliminated roles are revealed and whether night victims receive last words.'],
        },
        {
          heading: 'Night phase',
          paragraphs: ['During the night, players with actions use them privately. The Mafia choose a target. The Doctor may protect one player, the Detective may investigate someone, and other enabled roles act when prompted. Players should not describe or react to secret information until daytime.'],
        },
        {
          heading: 'Day discussion and voting',
          paragraphs: ['The result of the night is announced, then the surviving players discuss suspicions. Look for stories that change, votes that protect a teammate, and confident claims unsupported by earlier behaviour. When discussion ends, everyone votes. The player with the most votes may defend themselves before the final decision.'],
          bullets: ['Ask specific questions instead of only making accusations.', 'Explain why you suspect someone so other players can test your reasoning.', 'Track who voted together; voting patterns often reveal more than speeches.', 'If the vote is tied, follow the table’s defence and re-vote rules.'],
        },
        {
          heading: 'Common Mafia roles',
          paragraphs: ['Exact abilities depend on the selected setup, but these roles appear often in Bazimoon games.'],
          bullets: ['Citizen: no night action; observes, discusses and votes.', 'Mafia: knows the Mafia team and helps choose the night target.', 'Godfather: leads the Mafia and may appear innocent to investigations.', 'Detective: investigates one player at night.', 'Doctor: protects a player from the Mafia attack.', 'Sniper: can attempt to eliminate a suspected Mafia member.', 'Joker: wins by persuading the Town to vote them out.'],
        },
        {
          heading: 'Beginner strategy',
          paragraphs: ['Town players should share useful reasoning without giving special roles away too early. Mafia players need a believable view of the game, not silence. A good bluff includes ordinary uncertainty; perfect certainty can be as suspicious as avoiding every opinion.'],
          bullets: ['Town: compare claims with votes and earlier statements.', 'Special roles: reveal only when the information is worth the risk.', 'Mafia: participate consistently and avoid defending teammates automatically.', 'Everyone: focus on game behaviour, never personal traits or knowledge outside the game.'],
        },
      ],
      faq: [
        ['Is Mafia the same as Werewolf?', 'They are versions of the same hidden-role social deduction game. Names and special roles vary, but the day, night and voting structure is similar.'],
        ['How many Mafia should there be?', 'A useful starting point is one Mafia player for every three players. Adjust special roles to keep both teams competitive.'],
        ['Can Mafia be played online?', 'Yes. Bazimoon includes private roles, timers, voting and voice chat, so players can join from different places.'],
        ['Can eliminated players keep talking?', 'Usually no. They may receive last words when the table rules allow it, then should not influence the remaining players.'],
      ],
      gameSlug: 'mafia', playLabel: 'Play Mafia on Bazimoon',
    },
    fa: {
      label: 'قوانین و نقش‌های مافیا',
      title: 'آموزش کامل بازی مافیا؛ قوانین و نقش‌ها | بازیمون',
      description: 'بازی مافیا را قدم‌به‌قدم یاد بگیرید: آماده‌سازی، شب و روز، رأی‌گیری، شرایط برد، نقش‌های رایج و نکته‌های مناسب تازه‌کارها.',
      h1: 'آموزش بازی مافیا؛ قوانین، نقش‌ها و استراتژی',
      intro: 'مافیا یک بازی استدلالی و گفت‌وگومحور است که در آن باید رفتار دیگران را بخوانید، اطلاعاتتان را پنهان کنید و بقیه را قانع کنید. گروه کوچک مافیا مخفیانه فعالیت می‌کند و شهر باید اعضای آن را پیدا و با رأی حذف کند.',
      readTime: '۸ دقیقه مطالعه',
      sections: [
        {
          heading: 'چه چیزهایی لازم است؟',
          paragraphs: ['حداقل ۳ بازیکن لازم دارید، اما جمع ۶ تا ۱۰ نفره گفت‌وگوی متعادل‌تری می‌سازد. در بازیمون یک نفر میز می‌سازد و لینک یا کد آن را می‌فرستد. گفت‌وگوی صوتی، پخش نقش‌ها، زمان‌سنج و رأی‌گیری داخل بازی انجام می‌شود.'],
          bullets: ['۳ تا ۱۲ بازیکن', 'یک نقش محرمانه برای هر نفر', 'فضایی آرام برای گفت‌وگو', 'حدود ۱۵ تا ۴۰ دقیقه زمان'],
        },
        {
          heading: 'تیم‌ها و شرایط برد',
          paragraphs: ['بیشتر بازیکن‌ها عضو شهر هستند و باید همه اعضای مافیا را حذف کنند. اعضای تیم کوچک‌تر مافیا یکدیگر را می‌شناسند و وقتی تعداد مافیای زنده با شهروندان برابر شود برنده می‌شوند. نقش‌های مستقلی مثل جوکر ممکن است شرط برد جداگانه داشته باشند.'],
        },
        {
          heading: 'آماده‌سازی بازی',
          paragraphs: ['برای اولین بازی چینش کلاسیک را انتخاب کنید یا نقش‌ها و قوانین میز را تغییر دهید. هر بازیکن وارد میز می‌شود، نقش محرمانه‌اش را به‌تنهایی می‌بیند و اعلام آمادگی می‌کند. صفحه نقش را هرگز به بازیکن دیگری نشان ندهید.'],
          bullets: ['برای شروع به‌ازای تقریباً هر سه بازیکن یک مافیا بگذارید.', 'تا وقتی همه با چرخه شب و روز آشنا نشده‌اند، نقش‌های پیشرفته را محدود کنید.', 'از قبل مشخص کنید نقش حذف‌شده‌ها فاش شود یا نه و کشته شب وصیت داشته باشد یا نه.'],
        },
        {
          heading: 'مرحله شب',
          paragraphs: ['شب، نقش‌های فعال به‌صورت محرمانه کارشان را انجام می‌دهند. مافیا یک هدف انتخاب می‌کند، دکتر می‌تواند از یک نفر محافظت کند، کارآگاه می‌تواند یک نفر را استعلام کند و نقش‌های فعال دیگر در نوبت خود وارد می‌شوند. تا آغاز روز کسی نباید درباره اطلاعات شب حرف بزند یا واکنش نشان دهد.'],
        },
        {
          heading: 'گفت‌وگوی روز و رأی‌گیری',
          paragraphs: ['نتیجه شب اعلام می‌شود و بازیکن‌های زنده درباره مظنون‌ها بحث می‌کنند. به داستان‌هایی که عوض می‌شوند، رأی‌هایی که از هم‌تیمی محافظت می‌کنند و ادعاهای محکمی که پشتوانه ندارند دقت کنید. بعد از پایان گفت‌وگو همه رأی می‌دهند و بازیکنی که بیشترین رأی را دارد ممکن است پیش از تصمیم نهایی از خودش دفاع کند.'],
          bullets: ['به‌جای اتهام کلی، سؤال مشخص بپرسید.', 'دلیل ظنتان را بگویید تا بقیه بتوانند آن را بررسی کنند.', 'رأی‌های مشترک را دنبال کنید؛ الگوی رأی گاهی بیشتر از صحبت‌ها اطلاعات می‌دهد.', 'در رأی مساوی، طبق قانون دفاع و رأی‌گیری دوباره همان میز پیش بروید.'],
        },
        {
          heading: 'نقش‌های رایج مافیا',
          paragraphs: ['توانایی دقیق هر نقش به چینش انتخاب‌شده بستگی دارد، اما نقش‌های زیر در بازی‌های بازیمون رایج‌اند.'],
          bullets: ['شهروند: کار شب ندارد و با مشاهده، گفت‌وگو و رأی به شهر کمک می‌کند.', 'مافیا: اعضای تیم مافیا را می‌شناسد و در انتخاب هدف شب همکاری می‌کند.', 'پدرخوانده: رهبر مافیاست و ممکن است در استعلام کارآگاه شهروند دیده شود.', 'کارآگاه: هر شب یک بازیکن را استعلام می‌کند.', 'دکتر: از یک بازیکن در برابر حمله مافیا محافظت می‌کند.', 'تک‌تیرانداز: می‌تواند برای حذف مافیای مشکوک شلیک کند.', 'جوکر: با قانع کردن شهر برای رأی دادن به خودش برنده می‌شود.'],
        },
        {
          heading: 'استراتژی برای تازه‌کارها',
          paragraphs: ['شهروندها باید استدلال مفیدشان را بگویند، اما نقش‌های مهم را خیلی زود لو ندهند. بازیکن مافیا هم باید دیدگاه قابل‌باوری داشته باشد و فقط ساکت نماند. بلوف خوب کمی تردید طبیعی دارد؛ اطمینان بیش‌ازحد می‌تواند به‌اندازه فرار از نظر دادن مشکوک باشد.'],
          bullets: ['شهر: ادعاها را با رأی‌ها و حرف‌های قبلی مقایسه کنید.', 'نقش‌های فعال: فقط وقتی اطلاعات ارزش خطر را دارد خودتان را معرفی کنید.', 'مافیا: منظم در بحث شرکت کنید و همیشه ناخودآگاه از هم‌تیمی دفاع نکنید.', 'همه: فقط رفتار داخل بازی را بررسی کنید، نه ویژگی‌های شخصی یا اطلاعات بیرون بازی.'],
        },
      ],
      faq: [
        ['مافیا با گرگینه فرق دارد؟', 'هر دو نسخه‌هایی از یک بازی نقش مخفی و استدلالی هستند. نام‌ها و نقش‌های ویژه فرق می‌کند، اما ساختار شب، روز و رأی‌گیری شبیه است.'],
        ['چند مافیا در بازی بگذاریم؟', 'برای شروع، به‌ازای هر سه بازیکن یک مافیا مناسب است. نقش‌های ویژه را طوری تنظیم کنید که شانس دو تیم متعادل بماند.'],
        ['می‌شود مافیا را آنلاین بازی کرد؟', 'بله. بازیمون نقش‌های محرمانه، زمان‌سنج، رأی‌گیری و گفت‌وگوی صوتی دارد تا بازیکن‌ها از جاهای مختلف وارد شوند.'],
        ['بازیکن حذف‌شده می‌تواند حرف بزند؟', 'معمولاً نه. اگر قانون میز اجازه دهد وصیت می‌کند و بعد از آن نباید روی تصمیم بازیکن‌های زنده اثر بگذارد.'],
      ],
      gameSlug: 'mafia', playLabel: 'بازی مافیا در بازیمون',
    },
  },
  {
    slug: 'how-to-play-spy', bg: '#2A1418', fg: '#F08A7A',
    en: {
      label: 'Spy rules and question ideas',
      title: 'How to play Spy: rules, questions and tips | Bazimoon',
      description: 'Learn how to play the Spy word game on one phone, with clear rules, example questions and winning tips for players and spies.',
      h1: 'How to play Spy: rules, questions and tips',
      intro: 'Spy is a quick party game for one phone. Everyone except the spy sees the same secret word. Players ask careful questions to prove they know it without making the answer obvious.',
      readTime: '6 minute read',
      sections: [
        {
          heading: 'What you need',
          paragraphs: ['You need at least 3 players and one phone. Five to eight players usually creates the best mix of information and uncertainty. Choose a word pack, the number of spies and a timer, then pass the phone around privately.'],
          bullets: ['3 or more players', 'One phone for the whole group', 'A word pack such as Places, Food or Jobs', 'About 5 to 10 minutes per round'],
        },
        {
          heading: 'Deal the secret cards',
          paragraphs: ['Each player takes the phone, reveals their card alone, hides it and passes the phone on. Most cards show the same secret word. The spy card does not show the word. Nobody should reveal their card, facial reaction or the number of taps they made.'],
        },
        {
          heading: 'Ask questions',
          paragraphs: ['A randomly chosen player asks first. Take turns asking one person a question about the secret word. Answers should demonstrate knowledge without giving the word away to the spy. Avoid questions with only an obvious yes or no answer.'],
          bullets: ['Would you go there with children?', 'Is it more common in summer or winter?', 'What would you wear or bring?', 'Would it be expensive?', 'What sound, smell or feeling do you associate with it?', 'Would you be surprised to find it at home?'],
        },
        {
          heading: 'Vote for the spy',
          paragraphs: ['When the group feels ready or the timer ends, discuss the answers and select one player. If the group accuses an ordinary player, the spy wins. If the accusation is correct, the spy receives one last chance to guess the secret word. A correct guess still gives the spy the win.'],
        },
        {
          heading: 'Tips for ordinary players',
          paragraphs: ['Your job is not to prove the word by saying everything you know. Give an answer that another informed player understands, but that can fit more than one possible word. Change the kind of question each turn so the spy cannot build the answer from a single pattern.'],
          bullets: ['Listen for answers that repeat information someone else already gave.', 'Ask follow-up questions when an answer is vague.', 'Do not punish unusual but reasonable answers too quickly.', 'Watch whether a player’s later answers fit their earlier ones.'],
        },
        {
          heading: 'Tips for the spy',
          paragraphs: ['Listen before volunteering details. Use the category and other answers to narrow the possibilities. Ask broad questions that sound useful but do not require you to know the word. If accused, your final guess should combine every clue from the round.'],
          bullets: ['Answer at the same level of detail as the group.', 'Avoid copying the previous answer word for word.', 'Ask about opinions or experiences rather than a defining feature.', 'Keep a shortlist of possible words for the final guess.'],
        },
      ],
      faq: [
        ['How many people can play Spy?', 'Three or more can play. Five to eight usually gives the spy enough cover while leaving enough clues for the group.'],
        ['Does every player need a phone?', 'No. One phone is passed around so each player can privately see their card.'],
        ['Can there be two spies?', 'Yes. A larger group can use two spies. Both lack the word, so they may not know who the other spy is.'],
        ['What makes a good Spy question?', 'A good question has several plausible answers and lets informed players recognise whether an answer fits without directly revealing the word.'],
      ],
      gameSlug: 'spy', playLabel: 'Play Spy on Bazimoon',
    },
    fa: {
      label: 'قوانین جاسوس و ایده سؤال',
      title: 'آموزش بازی جاسوس؛ قوانین، سؤال‌ها و نکته‌ها | بازیمون',
      description: 'بازی کلمه‌ای جاسوس را با یک گوشی یاد بگیرید؛ قوانین روشن، نمونه سؤال و نکته‌های برد برای بازیکن‌ها و جاسوس.',
      h1: 'آموزش بازی جاسوس؛ قوانین، سؤال‌ها و ترفندها',
      intro: 'جاسوس یک بازی دورهمی سریع با یک گوشی است. همه به‌جز جاسوس یک کلمه مخفی مشترک می‌بینند. بازیکن‌ها با سؤال‌های حساب‌شده ثابت می‌کنند کلمه را می‌دانند، بدون اینکه جواب را برای جاسوس آشکار کنند.',
      readTime: '۶ دقیقه مطالعه',
      sections: [
        {
          heading: 'چه چیزهایی لازم است؟',
          paragraphs: ['حداقل ۳ بازیکن و یک گوشی لازم دارید. جمع ۵ تا ۸ نفره معمولاً بهترین تعادل میان اطلاعات و ابهام را می‌سازد. بسته کلمات، تعداد جاسوس‌ها و زمان دور را انتخاب کنید و گوشی را محرمانه دست‌به‌دست کنید.'],
          bullets: ['۳ بازیکن یا بیشتر', 'یک گوشی برای همه', 'یک بسته کلمه مثل مکان‌ها، غذاها یا شغل‌ها', 'حدود ۵ تا ۱۰ دقیقه برای هر دور'],
        },
        {
          heading: 'پخش کارت‌های محرمانه',
          paragraphs: ['هر بازیکن گوشی را می‌گیرد، کارتش را به‌تنهایی می‌بیند، آن را پنهان می‌کند و گوشی را به نفر بعد می‌دهد. بیشتر کارت‌ها یک کلمه مخفی یکسان دارند، اما روی کارت جاسوس کلمه نوشته نشده است. هیچ‌کس نباید کارت، واکنش چهره یا تعداد لمس‌هایش را لو بدهد.'],
        },
        {
          heading: 'سؤال پرسیدن',
          paragraphs: ['یک بازیکن به‌صورت تصادفی شروع می‌کند. هر نفر در نوبتش از یک بازیکن درباره کلمه مخفی سؤال می‌پرسد. جواب باید نشان دهد که کلمه را می‌دانید، اما آن را برای جاسوس آشکار نکند. سؤال‌های خیلی واضح بله یا خیر انتخاب خوبی نیستند.'],
          bullets: ['بچه‌ها را هم با خودت به آنجا می‌بری؟', 'بیشتر مناسب تابستان است یا زمستان؟', 'چه چیزی می‌پوشی یا با خودت می‌بری؟', 'معمولاً گران است؟', 'چه صدا، بو یا حسی را با آن مرتبط می‌دانی؟', 'اگر آن را در خانه ببینی تعجب می‌کنی؟'],
        },
        {
          heading: 'رأی دادن به جاسوس',
          paragraphs: ['وقتی گروه آماده بود یا زمان تمام شد، درباره جواب‌ها گفت‌وگو کنید و یک نفر را انتخاب کنید. اگر یک بازیکن عادی متهم شود، جاسوس می‌برد. اگر جاسوس درست پیدا شود، یک فرصت آخر برای حدس کلمه مخفی دارد و با حدس درست باز هم برنده می‌شود.'],
        },
        {
          heading: 'نکته برای بازیکن‌های عادی',
          paragraphs: ['قرار نیست با گفتن همه چیز ثابت کنید که کلمه را می‌دانید. جوابی بدهید که بازیکن آگاه منظورش را بفهمد، اما با چند کلمه احتمالی جور دربیاید. نوع سؤال‌ها را تغییر دهید تا جاسوس نتواند جواب را از یک الگوی ثابت حدس بزند.'],
          bullets: ['به جواب‌هایی دقت کنید که فقط حرف نفر قبلی را تکرار می‌کنند.', 'وقتی جواب بیش‌ازحد مبهم است سؤال تکمیلی بپرسید.', 'یک جواب متفاوت اما منطقی را خیلی زود محکوم نکنید.', 'بررسی کنید جواب‌های بعدی هر نفر با حرف‌های قبلی او هماهنگ باشد.'],
        },
        {
          heading: 'نکته برای جاسوس',
          paragraphs: ['پیش از گفتن جزئیات به جواب دیگران گوش دهید. از دسته کلمه و سرنخ‌ها برای محدود کردن گزینه‌ها استفاده کنید. سؤال‌های کلی بپرسید که مفید به نظر برسند، اما دانستن کلمه را لازم نداشته باشند. اگر متهم شدید، برای حدس آخر همه سرنخ‌های دور را کنار هم بگذارید.'],
          bullets: ['به‌اندازه بقیه جزئیات بدهید؛ نه خیلی کمتر و نه خیلی بیشتر.', 'جواب نفر قبلی را کلمه‌به‌کلمه تکرار نکنید.', 'درباره نظر یا تجربه بپرسید، نه ویژگی اصلی کلمه.', 'چند کلمه احتمالی را برای حدس نهایی در ذهن نگه دارید.'],
        },
      ],
      faq: [
        ['بازی جاسوس چند نفره است؟', 'سه نفر یا بیشتر می‌توانند بازی کنند. جمع ۵ تا ۸ نفره معمولاً هم برای پنهان شدن جاسوس و هم برای پیدا کردن سرنخ مناسب است.'],
        ['همه بازیکن‌ها گوشی لازم دارند؟', 'نه. یک گوشی دست‌به‌دست می‌شود تا هر بازیکن کارتش را محرمانه ببیند.'],
        ['می‌شود دو جاسوس داشت؟', 'بله. در گروه بزرگ‌تر می‌توانید دو جاسوس بگذارید. هیچ‌کدام کلمه را نمی‌دانند و ممکن است یکدیگر را هم نشناسند.'],
        ['سؤال خوب برای جاسوس چه ویژگی‌ای دارد؟', 'سؤال خوب چند جواب منطقی دارد و بازیکن‌های آگاه می‌توانند درست بودن جواب را تشخیص دهند، بدون اینکه خود کلمه مستقیم آشکار شود.'],
      ],
      gameSlug: 'spy', playLabel: 'بازی جاسوس در بازیمون',
    },
  },
]
