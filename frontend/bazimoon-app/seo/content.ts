// Text of the search pages (/en/, /fa/ and one page per game in each language).
// Design: "Web — pages for Google" artboards (SeoLanding, SeoGame).

export type Lang = 'en' | 'fa'

export interface GamePage {
  name: string
  /** One line for the landing page list. */
  line: string
  h1: string
  title: string
  description: string
  intro: string
  steps: [string, string][]
  features: string[]
  faq: [string, string][]
}

export interface Game {
  slug: string
  bg: string
  fg: string
  group: 'puzzles' | 'words' | 'party' | 'classics'
  en: GamePage
  fa: GamePage
}

export const games: Game[] = [
{
  "slug": "shelem",
  "bg": "#173A46",
  "fg": "#E2B86B",
  "group": "party",
  "en": {
    "name": "Shelem",
    "line": "A four-player card game: bid, choose trump and win with your partner.",
    "h1": "Play Shelem online with friends or bots",
    "title": "Shelem Online – Play with Friends or Bots | Bazimoon",
    "description": "Play Shelem online in English or Persian. Invite friends, arrange two teams, practise with bots and follow every round’s score in your browser.",
    "intro": "Bring your Shelem table online. Four players form two teams, bid for the right to choose trump and compete to fulfil their contract. Create a room and invite friends with a link or room code, or start a game with bots. Bazimoon runs in your browser on a phone or computer, with English and Persian interfaces.",
    "steps": [
      [
        "Set up your table",
        "Create a room and share its invitation. The host can move players between seats or swap teammates before play starts. Guests confirm readiness after team changes."
      ],
      [
        "Bid on your hand",
        "Each player receives 12 cards, with four cards reserved as Zamin. Bid from 100 to 165 in steps of five, raise the current bid or pass. Calling Shelem is a separate commitment to win every trick."
      ],
      [
        "Choose Zamin and trump",
        "The winning bidder takes the four Zamin cards, discards four cards and chooses the trump suit."
      ],
      [
        "Play with your partner",
        "Follow the led suit when you can. If you cannot, play another suit or a trump. The highest trump wins the trick; without trump, the highest card of the led suit wins."
      ],
      [
        "Check the score",
        "Review completed rounds in the scoreboard. Bazimoon’s match target is 660 points."
      ]
    ],
    "features": [
      "Private rooms with invitation links and room codes",
      "Host controls for seats and teams before the match",
      "Bots for practice or filling empty seats",
      "In-room voice chat with microphone and mute controls",
      "Round-by-round scoreboard and match totals",
      "English and Persian, including right-to-left layouts"
    ],
    "faq": [
      [
        "How many people play Shelem?",
        "A table has four seats in two teams of two. Partners sit opposite each other. You can play with friends or fill seats with bots."
      ],
      [
        "Can I play Shelem without downloading an app?",
        "Yes. Open Bazimoon in your mobile or desktop browser. An internet connection is required for Shelem, including bot games."
      ],
      [
        "Can the host change teams?",
        "Yes, before the match starts. Moving a player onto an occupied seat swaps the two players. Guests need to confirm readiness after a change."
      ],
      [
        "What is the difference between bidding 165 and calling Shelem?",
        "A 165 bid is a points contract. Calling Shelem requires winning all 12 tricks and scores +330 if successful or −330 if unsuccessful in Bazimoon."
      ],
      [
        "Why can’t I join an invitation?",
        "The room may be full, the game may already have started, or the room may no longer exist. Ask the host for an invitation to an available room."
      ]
    ]
  },
  "fa": {
    "name": "شلم",
    "line": "شلم چهارنفره؛ بخوانید، حکم انتخاب کنید و با یارتان ببرید.",
    "h1": "شلم آنلاین با دوستان یا ربات‌ها",
    "title": "شلم آنلاین؛ بازی با دوستان یا ربات‌ها | بازیمون",
    "description": "شلم آنلاین را در بازیمون بازی کنید؛ دعوت دوستان، انتخاب هم‌تیمی، تمرین با ربات و جدول امتیازات هر دست. فارسی و انگلیسی، مستقیم در مرورگر.",
    "intro": "میز شلم را به جمع آنلاین دوستانتان بیاورید. چهار بازیکن در دو تیم دونفره بازی می‌کنند؛ امتیاز می‌خوانند، حکم انتخاب می‌کنند و برای رسیدن به تعهدشان دست می‌برند. در بازیمون می‌توانید میز بسازید و دوستانتان را با لینک یا کد اتاق دعوت کنید، یا با ربات‌ها بازی کنید. بازی روی مرورگر گوشی و کامپیوتر اجرا می‌شود و محیط فارسی و انگلیسی دارد.",
    "steps": [
      [
        "میز و تیم‌ها را آماده کنید",
        "یک اتاق بسازید و دعوت‌نامه را بفرستید. میزبان می‌تواند پیش از شروع بازی، صندلی یا هم‌تیمی بازیکنان را تغییر دهد. مهمان‌ها بعد از تغییر تیم‌ها دوباره آمادگی خود را تأیید می‌کنند."
      ],
      [
        "امتیاز بخوانید",
        "هر بازیکن ۱۲ کارت می‌گیرد و چهار کارت روی زمین می‌ماند. می‌توانید از ۱۰۰ تا ۱۶۵، با فاصله‌های پنج‌امتیازی و بالاتر از پیشنهاد قبلی بخوانید یا پاس بدهید. اعلام شلم گزینه‌ای جداگانه برای تعهد به بردن تمام دست‌هاست."
      ],
      [
        "زمین و حکم را انتخاب کنید",
        "برندهٔ مزایده چهار کارت زمین را برمی‌دارد، چهار کارت کنار می‌گذارد و خال حکم را مشخص می‌کند."
      ],
      [
        "با یارتان دست ببرید",
        "اگر از خال شروع‌شده کارت دارید، باید همان خال را بازی کنید. در غیر این صورت می‌توانید کارت دیگری یا حکم بیندازید. بالاترین حکم برنده است؛ اگر حکم بازی نشده باشد، بالاترین کارت از خال شروع‌شده دست را می‌برد."
      ],
      [
        "امتیازها را دنبال کنید",
        "نتیجهٔ دورهای تمام‌شده را در جدول امتیازات ببینید. امتیاز هدف مسابقه در بازیمون ۶۶۰ است."
      ]
    ],
    "features": [
      "اتاق خصوصی با لینک دعوت و کد ورود",
      "تغییر صندلی و تیم بازیکنان توسط میزبان پیش از شروع",
      "بازی تمرینی با ربات و پر کردن صندلی‌های خالی",
      "گفت‌وگوی صوتی با کنترل میکروفن و قطع صدای بازیکنان",
      "جدول امتیازات هر دور و مجموع امتیاز تیم‌ها",
      "محیط فارسی راست‌به‌چپ و نسخهٔ انگلیسی"
    ],
    "faq": [
      [
        "شلم چندنفره است؟",
        "شلم چهار صندلی دارد و در دو تیم دونفره بازی می‌شود. هم‌تیمی‌ها روبه‌روی هم می‌نشینند. می‌توانید با دوستان بازی کنید یا صندلی‌ها را با ربات پر کنید."
      ],
      [
        "برای شلم آنلاین باید برنامه نصب کنم؟",
        "نه. بازیمون را در مرورگر گوشی یا کامپیوتر باز کنید. بازی شلم، حتی با ربات‌ها، به اینترنت نیاز دارد."
      ],
      [
        "میزبان می‌تواند تیم‌ها را عوض کند؟",
        "بله، پیش از شروع مسابقه. اگر صندلی مقصد پر باشد، جای دو بازیکن عوض می‌شود. مهمان‌ها پس از تغییر باید دوباره آماده شوند."
      ],
      [
        "خواندن ۱۶۵ چه فرقی با اعلام شلم دارد؟",
        "خواندن ۱۶۵ تعهد به گرفتن امتیاز است. با اعلام شلم باید هر ۱۲ دست را ببرید؛ در بازیمون موفقیت آن ۳۳۰ امتیاز مثبت و شکست آن ۳۳۰ امتیاز منفی دارد."
      ],
      [
        "چرا لینک دعوت وارد بازی نمی‌شود؟",
        "ممکن است میز پر باشد، بازی شروع شده باشد یا اتاق دیگر وجود نداشته باشد. از میزبان دعوت‌نامهٔ یک میز در دسترس را بگیرید."
      ]
    ]
  }
},
  {
    slug: 'zip', bg: '#173A36', fg: '#5FD0BE', group: 'puzzles',
    en: {
      name: 'Zip', line: 'One path through every cell, level after level.',
      h1: 'Zip: a free path puzzle with endless levels', title: 'Zip – free path puzzle online, level by level | Bazimoon',
      description: 'Draw one path through every cell, hitting the numbers in order. Start at level 1 and play as many levels as you like, free in your browser.',
      intro: 'Zip is a short logic puzzle: draw a single path that passes through every cell of the grid and visits the numbers in order. Start at level 1 and keep going for as long as you like; the grids grow as you climb, and your level is saved on every device.',
      steps: [['Start at 1', 'Drag from the cell marked 1. Your path moves up, down, left or right.'], ['Hit the numbers in order', 'Pass through 2, 3, 4… in order.'], ['Fill every cell', 'The puzzle is solved when the path covers the whole grid and ends on the last number.']],
      features: ['Levels that grow from 5×5 to 8×8', 'Play as many levels a day as you like', 'Streaks and a weekly league', 'Undo and hints'],
      faq: [['How long does a Zip puzzle take?', 'Early levels take about a minute; bigger grids take a few.'], ['Is there a limit per day?', 'No. Play one level or fifty; you always carry on from where you stopped.']],
    },
    fa: {
      name: 'زیپ', line: 'یک مسیر از میان همه خانه‌ها، مرحله به مرحله.',
      h1: 'زیپ: پازل مسیر رایگان با مرحله‌های بی‌پایان', title: 'زیپ – پازل مسیر آنلاین و رایگان، مرحله‌به‌مرحله | بازیمون',
      description: 'یک مسیر از میان همه خانه‌ها بکشید و عددها را به ترتیب بگذرانید. از مرحله‌ی ۱ شروع کنید و هر چند مرحله که خواستید بازی کنید، رایگان در مرورگر.',
      intro: 'زیپ یک پازل منطقی کوتاه است: یک مسیر بکشید که از همه خانه‌های جدول بگذرد و عددها را به ترتیب ببیند. از مرحله‌ی ۱ شروع کنید و تا هر جا خواستید پیش بروید؛ هرچه بالاتر بروید جدول بزرگ‌تر می‌شود و مرحله‌تان روی همه‌ی دستگاه‌ها ذخیره می‌ماند.',
      steps: [['از ۱ شروع کنید', 'از خانه‌ای که عدد ۱ دارد بکشید. مسیر به بالا، پایین، چپ یا راست می‌رود.'], ['عددها به ترتیب', 'از ۲، ۳، ۴ و بقیه به ترتیب بگذرید.'], ['همه خانه‌ها را پر کنید', 'وقتی مسیر کل جدول را پوشاند و روی آخرین عدد تمام شد، پازل حل شده است.']],
      features: ['مرحله‌هایی که از ۵×۵ تا ۸×۸ بزرگ می‌شوند', 'هر روز هر چند مرحله که بخواهید', 'رکورد روزانه و لیگ هفتگی', 'برگرداندن حرکت و راهنما'],
      faq: [['حل هر پازل زیپ چقدر طول می‌کشد؟', 'مرحله‌های اول حدود یک دقیقه؛ جدول‌های بزرگ‌تر چند دقیقه.'], ['در روز محدودیتی دارد؟', 'نه. یک مرحله یا پنجاه مرحله؛ همیشه از همان جایی که ماندید ادامه می‌دهید.']],
    },
  },
  {
    slug: 'queens', bg: '#2E2340', fg: '#B79CF2', group: 'puzzles',
    en: {
      name: 'Queens', line: 'One queen in every row, column and colour.',
      h1: 'Queens: a free logic puzzle, level by level', title: 'Queens – free logic puzzle online with endless levels | Bazimoon',
      description: 'Place one queen in every row, column and colour region, with no two queens touching. Climb from small grids to big ones, as many levels as you like, free.',
      intro: 'Queens is a logic grid played level by level. Place exactly one queen in each row, each column and each colour region, and make sure no two queens touch, not even at the corners. Grids start at 5×5 and grow as you climb; every one has a single solution and needs no guessing.',
      steps: [['Tap once to mark X', 'Use X to rule out cells where a queen cannot go.'], ['Tap twice to place a queen', 'Each row, each column and each colour region gets exactly one queen.'], ['Queens never touch', 'Two queens cannot sit next to each other, including diagonally.'], ['Conflicts turn red', 'Any rule you break is highlighted, so you can fix it right away.']],
      features: ['Levels from 5×5 up to 9×9', 'Streaks and a weekly league', 'Conflicts shown straight away', 'Undo and hints'],
      faq: [['Do I need to know chess?', 'No. The queens only follow the rules above, not chess moves.'], ['Is there always one answer?', 'Yes, every grid has exactly one solution.']],
    },
    fa: {
      name: 'ملکه‌ها', line: 'یک ملکه در هر ردیف، ستون و رنگ.',
      h1: 'ملکه‌ها: پازل منطقی رایگان، مرحله‌به‌مرحله', title: 'ملکه‌ها – پازل منطقی آنلاین با مرحله‌های بی‌پایان | بازیمون',
      description: 'در هر ردیف، ستون و ناحیه رنگی یک ملکه بگذارید، بدون اینکه دو ملکه به هم بچسبند. از جدول‌های کوچک تا بزرگ، هر چند مرحله که خواستید، رایگان.',
      intro: 'ملکه‌ها یک جدول منطقی است که مرحله‌به‌مرحله بازی می‌شود. در هر ردیف، هر ستون و هر ناحیه رنگی دقیقاً یک ملکه بگذارید و مراقب باشید هیچ دو ملکه‌ای به هم نچسبند، حتی از گوشه. جدول‌ها از ۵×۵ شروع می‌شوند و کم‌کم بزرگ‌تر می‌شوند؛ هر کدام یک جواب دارد و بدون حدس زدن حل می‌شود.',
      steps: [['یک بار بزنید تا X بگذارید', 'با X خانه‌هایی را که ملکه نمی‌تواند آنجا باشد کنار بگذارید.'], ['دو بار بزنید تا ملکه بگذارید', 'هر ردیف، هر ستون و هر رنگ دقیقاً یک ملکه دارد.'], ['ملکه‌ها به هم نمی‌چسبند', 'دو ملکه نمی‌توانند کنار هم باشند، حتی به‌صورت مورب.'], ['اشتباه قرمز می‌شود', 'هر قانونی که شکسته شود مشخص می‌شود تا فوراً درستش کنید.']],
      features: ['مرحله‌ها از ۵×۵ تا ۹×۹', 'رکورد روزانه و لیگ هفتگی', 'نمایش فوری اشتباه‌ها', 'برگرداندن حرکت و راهنما'],
      faq: [['باید شطرنج بلد باشم؟', 'نه. ملکه‌ها فقط همین قانون‌ها را دارند، نه حرکت‌های شطرنج.'], ['همیشه یک جواب دارد؟', 'بله، هر جدول دقیقاً یک جواب دارد.']],
    },
  },
  {
    slug: 'sudoku', bg: '#12304A', fg: '#7CC4FA', group: 'puzzles',
    en: {
      name: 'Sudoku', line: '9×9 grids level by level, from Easy to Expert.',
      h1: 'Free online Sudoku: levels and classic grids', title: 'Free online Sudoku – levels from Easy to Expert | Bazimoon',
      description: 'Play Sudoku free in your browser. Climb through levels that get harder as you go, or pick a difficulty from Easy to Expert, with notes and hints.',
      intro: 'Play Sudoku free in your browser, no download. Levels start with easy grids and get harder as you climb, as many a day as you like, and your level is saved on every device. Classic gives you unlimited grids at the difficulty you choose. Every grid is solvable by logic alone, with one answer.',
      steps: [['Pick a cell, then a number', 'Tap an empty cell, then a number on the pad below.'], ['Every number once', 'Each row, column and 3×3 box holds 1 to 9 exactly once.'], ['Pencil in notes', 'Jot the numbers that could fit, then decide later.'], ['Clashes turn red', 'A number repeated in its row, column or box turns red so you spot it early.']],
      features: ['Levels with streaks and a league', 'Four difficulties: Easy, Medium, Hard, Expert', 'Notes, hints and undo', 'Works offline'],
      faq: [['How do Sudoku levels work?', 'Level 1 is easy and each level unlocks the next, getting harder as you go. Solve one a day to keep your streak.'], ['Is it good for beginners?', 'Yes. The first levels start with more numbers filled in, and hints are always there.']],
    },
    fa: {
      name: 'سودوکو', line: 'جدول ۹×۹ مرحله‌به‌مرحله، از آسان تا استاد.',
      h1: 'سودوکو آنلاین رایگان؛ مرحله‌ای و کلاسیک', title: 'سودوکو آنلاین رایگان – مرحله‌ها از آسان تا استاد | بازیمون',
      description: 'سودوکو را رایگان در مرورگر بازی کنید. مرحله‌هایی که هرچه جلوتر بروید سخت‌تر می‌شوند، یا جدول کلاسیک با سختی دلخواه، با یادداشت و راهنما.',
      intro: 'سودوکو را رایگان و بدون دانلود در مرورگر بازی کنید. مرحله‌ها با جدول‌های آسان شروع می‌شوند و هرچه بالاتر بروید سخت‌تر می‌شوند؛ هر روز هر چند مرحله که بخواهید، و مرحله‌تان روی همه‌ی دستگاه‌ها ذخیره می‌ماند. در حالت کلاسیک می‌توانید بی‌پایان با سختی دلخواه بازی کنید. همه جدول‌ها فقط با منطق حل می‌شوند و یک جواب دارند.',
      steps: [['یک خانه، بعد یک عدد', 'خانه خالی را بزنید و عدد را از صفحه‌کلید پایین انتخاب کنید.'], ['هر عدد یک بار', 'در هر ردیف، هر ستون و هر خانه ۳×۳ عددهای ۱ تا ۹ فقط یک بار می‌آیند.'], ['یادداشت بگذارید', 'عددهای ممکن را کوچک در خانه بنویسید تا بعد تصمیم بگیرید.'], ['تکرار قرمز می‌شود', 'عدد تکراری در ردیف، ستون یا خانه قرمز می‌شود تا اشتباه را زود ببینید.']],
      features: ['مرحله‌ها با رکورد و لیگ', 'چهار سختی: آسان، متوسط، سخت، استاد', 'یادداشت، راهنما و برگرداندن حرکت', 'بدون اینترنت هم کار می‌کند'],
      faq: [['مرحله‌های سودوکو چطور کار می‌کنند؟', 'مرحله‌ی ۱ آسان است و هر مرحله مرحله‌ی بعد را باز می‌کند و کم‌کم سخت‌تر می‌شود. هر روز یک مرحله حل کنید تا رکوردتان ادامه پیدا کند.'], ['سودوکو برای مبتدی‌ها هم هست؟', 'بله. مرحله‌های اول با عددهای بیشتری شروع می‌شوند و راهنما همیشه در دسترس است.']],
    },
  },
  {
    slug: '2048', bg: '#2A2650', fg: '#9C8CFF', group: 'puzzles',
    en: {
      name: '2048', line: 'Merge tiles until you reach 2048.',
      h1: '2048: play the merge puzzle free', title: '2048 – play free online | Bazimoon',
      description: 'Slide and merge number tiles to reach 2048, then keep going for a new best. Free, endless, no download.',
      intro: 'Swipe to slide every tile on the board. Two tiles with the same number merge into one, and a new tile appears after every move. Reach 2048, then keep going for a new best score.',
      steps: [['Swipe to slide', 'All tiles move as far as they can in the direction you swipe.'], ['Equal tiles merge', 'Two tiles with the same number join into one. 8 + 8 makes 16.'], ['A new tile appears', 'After every move, a 2 or a 4 drops into an empty cell.'], ['Stay unstuck', 'The game ends when the board is full and no merges are left.']],
      features: ['Endless play', 'Undo', 'Your best score is saved', 'Works offline'],
      faq: [['What is the best strategy?', 'Keep your biggest tile in one corner and build towards it.'], ['Can I keep playing after 2048?', 'Yes, keep going for bigger tiles and a new best.']],
    },
    fa: {
      name: '۲۰۴۸', line: 'کاشی‌ها را ادغام کنید تا به ۲۰۴۸ برسید.',
      h1: 'بازی ۲۰۴۸ آنلاین و رایگان', title: 'بازی ۲۰۴۸ آنلاین رایگان | بازیمون',
      description: 'کاشی‌های عددی را بلغزانید و ادغام کنید تا به ۲۰۴۸ برسید، بعد برای رکورد تازه ادامه دهید. رایگان و بدون دانلود.',
      intro: 'با کشیدن انگشت همه کاشی‌ها را جابه‌جا کنید. دو کاشی با عدد یکسان یکی می‌شوند و بعد از هر حرکت کاشی تازه‌ای می‌آید. به ۲۰۴۸ برسید و برای رکورد بهتر ادامه دهید.',
      steps: [['بکشید تا بلغزد', 'همه کاشی‌ها تا جایی که بشود در جهت کشیدن حرکت می‌کنند.'], ['کاشی‌های یکسان ادغام می‌شوند', 'دو کاشی با عدد یکسان یکی می‌شوند؛ ۸ و ۸ می‌شود ۱۶.'], ['کاشی تازه می‌آید', 'بعد از هر حرکت یک ۲ یا ۴ در خانه خالی ظاهر می‌شود.'], ['گیر نکنید', 'وقتی صفحه پر شود و ادغامی نماند، بازی تمام است.']],
      features: ['بازی بی‌پایان', 'برگرداندن حرکت', 'ذخیره بهترین امتیاز', 'بدون اینترنت هم کار می‌کند'],
      faq: [['بهترین روش بازی چیست؟', 'بزرگ‌ترین کاشی را در یک گوشه نگه دارید و به سمت آن بسازید.'], ['بعد از ۲۰۴۸ می‌شود ادامه داد؟', 'بله، برای کاشی‌های بزرگ‌تر و رکورد تازه ادامه دهید.']],
    },
  },
  {
    slug: 'minesweeper', bg: '#2A1A1A', fg: '#F08A7A', group: 'puzzles',
    en: {
      name: 'Minesweeper', line: 'Clear the board without hitting a mine.',
      h1: 'Minesweeper: play free online', title: 'Minesweeper – play free online | Bazimoon',
      description: 'Classic Minesweeper in your browser: read the numbers, flag the mines and clear every safe cell. Free and endless.',
      intro: 'Classic Minesweeper with the original rules. Numbers tell you how many mines touch each cell; use them to flag the mines and open every safe cell. Your first tap is always safe.',
      steps: [['Tap to dig', 'Your first tap is always safe and often opens a big area.'], ['Read the numbers', 'A number shows how many of the 8 neighbouring cells hide a mine.'], ['Flag the mines', 'Switch to Flag mode, or long-press, to mark cells you know are mines.'], ['Clear every safe cell', 'You win when only mines are left. One wrong dig ends the game.']],
      features: ['Classic rules', 'Safe first tap', 'Flag mode for phones', 'Works offline'],
      faq: [['How big is the board?', '9 × 9 with 10 mines.'], ['How do I flag on a phone?', 'Turn on Flag mode or long-press a cell.']],
    },
    fa: {
      name: 'مین‌روب', line: 'صفحه را بدون برخورد با مین پاک کنید.',
      h1: 'بازی مین‌روب آنلاین رایگان', title: 'مین‌روب آنلاین رایگان | بازیمون',
      description: 'مین‌روب کلاسیک در مرورگر: عددها را بخوانید، مین‌ها را علامت بزنید و همه خانه‌های امن را باز کنید. رایگان و بی‌پایان.',
      intro: 'مین‌روب کلاسیک با همان قانون‌های همیشگی. هر عدد می‌گوید چند مین کنار آن خانه است؛ با این عددها مین‌ها را علامت بزنید و همه خانه‌های امن را باز کنید. اولین ضربه همیشه امن است.',
      steps: [['بزنید تا باز شود', 'اولین ضربه همیشه امن است و اغلب بخش بزرگی را باز می‌کند.'], ['عددها را بخوانید', 'هر عدد نشان می‌دهد چند تا از ۸ خانه کناری مین دارند.'], ['مین‌ها را علامت بزنید', 'حالت پرچم را روشن کنید یا انگشت را نگه دارید تا خانه مین‌دار را علامت بزنید.'], ['همه خانه‌های امن را باز کنید', 'وقتی فقط مین‌ها بمانند برنده‌اید. یک اشتباه بازی را تمام می‌کند.']],
      features: ['قانون‌های کلاسیک', 'اولین ضربه امن', 'حالت پرچم برای گوشی', 'بدون اینترنت هم کار می‌کند'],
      faq: [['صفحه چقدر بزرگ است؟', '۹ در ۹ با ۱۰ مین.'], ['در گوشی چطور پرچم بگذارم؟', 'حالت پرچم را روشن کنید یا انگشت را روی خانه نگه دارید.']],
    },
  },
  {
    slug: 'daily-word', bg: '#14241A', fg: '#9ED98C', group: 'words',
    en: {
      name: 'Word Guess', line: 'Six tries to guess the five-letter word, level after level.',
      h1: 'Word Guess: guess the word in six tries', title: 'Word Guess – free word game in English and Persian | Bazimoon',
      description: 'Guess the five-letter word in six tries. Hundreds of levels in English and in Persian, as many a day as you like. Free in your browser.',
      intro: 'Every level is a new five-letter word, in English or in Persian. Type a guess and the colours tell you which letters are right. Find the word in six tries or fewer, then go straight on to the next level, and share your result without spoilers.',
      steps: [['Guess the word', 'Type any valid five-letter word and submit it.'], ['Read the colours', 'Green is the right letter in the right spot. Yellow is in the word but elsewhere. Grey is not in the word.'], ['Solve in six', 'Use what you learn to find the word in six tries or fewer.']],
      features: ['English and Persian words', 'Hundreds of levels, no daily limit', 'High-contrast colours', 'Spoiler-free sharing'],
      faq: [['Is there a Persian version?', 'Yes, switch to Persian for its own levels of five-letter Persian words.'], ['Can I play more than once a day?', 'Yes. Each level opens the next one, so you can play as many words as you like.']],
    },
    fa: {
      name: 'حدس کلمه', line: 'شش فرصت برای حدس کلمه پنج‌حرفی فارسی، مرحله به مرحله.',
      h1: 'حدس کلمه: وردل فارسی آنلاین', title: 'حدس کلمه – وردل فارسی آنلاین و رایگان | بازیمون',
      description: 'کلمه پنج‌حرفی را در شش فرصت حدس بزنید. صدها مرحله به فارسی و انگلیسی، هر روز هر چند تا که بخواهید. بازی رایگان کلمات در مرورگر.',
      intro: 'هر مرحله یک کلمه پنج‌حرفی تازه است، به فارسی یا انگلیسی. حدستان را بنویسید و رنگ‌ها می‌گویند کدام حرف درست است. کلمه را در شش فرصت یا کمتر پیدا کنید، بعد سراغ مرحله‌ی بعد بروید و نتیجه را بدون لو دادن جواب با دوستان به اشتراک بگذارید.',
      steps: [['کلمه را حدس بزنید', 'یک کلمه پنج‌حرفی درست بنویسید و ثبت کنید.'], ['رنگ‌ها را بخوانید', 'سبز یعنی حرف درست در جای درست. زرد یعنی حرف در کلمه هست ولی جای دیگری. خاکستری یعنی در کلمه نیست.'], ['در شش فرصت حل کنید', 'با سرنخ‌ها کلمه را در شش حدس یا کمتر پیدا کنید.']],
      features: ['کلمه‌های فارسی و انگلیسی', 'صدها مرحله، بدون محدودیت روزانه', 'رنگ‌های پرکنتراست', 'اشتراک نتیجه بدون لو دادن جواب'],
      faq: [['این همان وردل است؟', 'بله، همان ایده با کلمه‌های فارسی و انگلیسی.'], ['روزی چند بار می‌شود بازی کرد؟', 'هر چند بار که بخواهید. هر مرحله مرحله‌ی بعد را باز می‌کند.']],
    },
  },
  {
    slug: 'word-ladder', bg: '#3A2A16', fg: '#F0A83A', group: 'words',
    en: {
      name: 'Word Ladder', line: 'Change one letter at a time to reach the target.',
      h1: 'Word Ladder: change one letter at a time', title: 'Word Ladder – free word puzzle with endless levels | Bazimoon',
      description: 'Turn the top word into the bottom word by changing one letter at a time, making a real word at every step. Play level after level, free.',
      intro: 'Get from the top word to the bottom word by changing one letter at a time. Every step has to be a real word. Match par, or beat it, for a better score.',
      steps: [['Pick a letter', 'Tap one letter of your last word to change it.'], ['Make a real word', 'Type the new letter. The new word must be in the dictionary.'], ['Reach the target', 'Get to the bottom word. Matching par is good; beating it is better.']],
      features: ['A new ladder on every level', 'Par to beat', 'English and Persian', 'Hints'],
      faq: [['What is par?', 'The fewest steps we found. Matching it is good; beating it is better.'], ['Does it work in Persian?', 'Yes, ladders come in both languages.']],
    },
    fa: {
      name: 'نردبان کلمات', line: 'هر بار یک حرف را عوض کنید و به کلمه مقصد برسید.',
      h1: 'نردبان کلمات: هر بار یک حرف', title: 'نردبان کلمات – پازل کلمه رایگان با مرحله‌های بی‌پایان | بازیمون',
      description: 'کلمه بالا را با عوض کردن یک حرف در هر پله به کلمه پایین برسانید؛ هر پله باید کلمه درستی باشد. مرحله به مرحله و رایگان.',
      intro: 'از کلمه بالا به کلمه پایین برسید، هر بار فقط با عوض کردن یک حرف. هر پله باید یک کلمه واقعی باشد. با تعداد پله‌های «پار» برسید یا کمتر، تا امتیاز بهتری بگیرید.',
      steps: [['یک حرف را انتخاب کنید', 'یکی از حرف‌های آخرین کلمه را بزنید تا عوضش کنید.'], ['کلمه درست بسازید', 'حرف تازه را بنویسید. کلمه جدید باید در فرهنگ لغت باشد.'], ['به مقصد برسید', 'به کلمه پایین برسید. رسیدن با پار خوب است، کمتر از آن بهتر.']],
      features: ['در هر مرحله یک نردبان تازه', 'پار برای رقابت', 'فارسی و انگلیسی', 'راهنما'],
      faq: [['پار یعنی چه؟', 'کمترین تعداد پله‌ای که ما پیدا کردیم. رسیدن با آن خوب است و کمتر از آن عالی.'], ['به فارسی هم هست؟', 'بله، نردبان‌ها به هر دو زبان هستند.']],
    },
  },
  {
    slug: 'esm-famil', bg: '#2A2113', fg: '#F6C377', group: 'words',
    en: {
      name: 'Esm-Famil', line: 'The classic Persian word game, online with friends or solo.',
      h1: 'Esm-Famil online: the Persian word game', title: 'Esm-Famil online – play with friends | Bazimoon',
      description: 'Play Esm-Famil (name, place, animal…) online with 2–8 friends, on one phone, or solo against the clock. Free, in English and Persian.',
      intro: 'Esm-Famil is the classic Persian word game: everyone gets the same letter and writes a word for each category (name, surname, city, animal, food…). Play online in a room with 2 to 8 friends, pass one phone around, or race the clock alone.',
      steps: [['A letter is drawn', 'Everyone gets the same letter. Write a word starting with it for each category.'], ['Stop!', 'When you have filled every category, tap Stop. Everyone else gets 5 more seconds.'], ['Judge the answers', 'Everyone votes on the others\' answers. An answer most players reject scores 0.'], ['Score', '10 for a unique answer, 5 for a shared one, 20 if you are the only one with an answer.']],
      features: ['Online rooms for 2–8 players', 'Solo mode with a daily letter', 'One-phone mode', 'Pick your own categories'],
      faq: [['How do I invite friends?', 'Create a room and share its link or 6-character code.'], ['Can I play alone?', 'Yes, Solo checks your answers against word lists and scores your speed.']],
    },
    fa: {
      name: 'اسم فامیل', line: 'اسم فامیل آنلاین با دوستان یا تنها با ساعت.',
      h1: 'اسم فامیل آنلاین با دوستان', title: 'اسم فامیل آنلاین – بازی با دوستان | بازیمون',
      description: 'اسم فامیل آنلاین با ۲ تا ۸ دوست، با یک گوشی، یا تنها در برابر ساعت. اسم، فامیل، شهر، حیوان، غذا و بیشتر. رایگان.',
      intro: 'اسم فامیل همان بازی کلاسیک ایرانی است: همه یک حرف می‌گیرند و برای هر دسته (اسم، فامیل، شهر، حیوان، غذا و…) یک کلمه می‌نویسند. آنلاین در یک اتاق با ۲ تا ۸ دوست بازی کنید، گوشی را دست‌به‌دست بدهید، یا تنها با ساعت مسابقه بدهید.',
      steps: [['یک حرف می‌آید', 'همه یک حرف می‌گیرند. برای هر دسته کلمه‌ای بنویسید که با آن حرف شروع شود.'], ['استپ!', 'وقتی همه دسته‌ها را پر کردید، استپ را بزنید. بقیه ۵ ثانیه دیگر وقت دارند.'], ['داوری جواب‌ها', 'همه به جواب‌های دیگران رأی می‌دهند. جوابی که بیشتر بازیکن‌ها رد کنند صفر می‌گیرد.'], ['امتیاز', 'جواب تک ۱۰، جواب مشترک ۵، و اگر فقط شما جواب داده باشید ۲۰ امتیاز.']],
      features: ['اتاق آنلاین برای ۲ تا ۸ نفر', 'حالت تکی با حرف روزانه', 'بازی با یک گوشی', 'انتخاب دسته‌ها'],
      faq: [['چطور دوستانم را دعوت کنم؟', 'یک اتاق بسازید و لینک یا کد ۶ حرفی‌اش را بفرستید.'], ['تنها هم می‌شود بازی کرد؟', 'بله، در حالت تکی جواب‌ها با فهرست کلمات بررسی و سرعتتان امتیاز می‌گیرد.']],
    },
  },
  {
    slug: 'mafia', bg: '#1E2138', fg: '#C3B9FF', group: 'party',
    en: {
      name: 'Mafia', line: 'Voice Mafia online, 3 to 12 players.',
      h1: 'Mafia online with voice chat', title: 'Mafia online – play with friends, voice chat | Bazimoon',
      description: 'Play Mafia (Werewolf) online with 3 to 12 friends and voice chat. Godfather, Detective, Doctor, Sniper and more. Free, no download.',
      intro: 'The party game of hidden roles, online. Create a table, send the link, and talk it out with built-in voice chat. At night the Mafia choose a target; by day everyone debates and votes. Classic and Iranian role setups, from 3 to 12 players.',
      steps: [['Create or join a table', 'Make a table and share its link or code, or join an open table.'], ['Get your secret role', 'Town, Mafia or a special role like Detective, Doctor or Sniper.'], ['Night and day', 'At night roles act in secret. By day everyone talks, then votes someone out.'], ['Win as a team', 'Town wins when every Mafia is out; Mafia wins when they match the Town.']],
      features: ['Built-in voice chat', '3 to 12 players', 'Classic and Iranian role setups', 'Spectators and game recaps'],
      faq: [['Is Mafia the same as Werewolf?', 'Yes, the same hidden-role game under another name.'], ['Do we need to be in the same room?', 'No, voice chat is built in, so friends can play from anywhere.']],
    },
    fa: {
      name: 'مافیا', line: 'مافیا آنلاین با صدا، از ۳ تا ۱۲ نفر.',
      h1: 'مافیا آنلاین با چت صوتی', title: 'مافیا آنلاین – بازی با دوستان و چت صوتی | بازیمون',
      description: 'مافیا آنلاین با ۳ تا ۱۲ دوست و چت صوتی داخل بازی. پدرخوانده، کارآگاه، دکتر، تک‌تیرانداز و نقش‌های دیگر. رایگان و بدون دانلود.',
      intro: 'بازی گروهی نقش‌های مخفی، این بار آنلاین. میز بسازید، لینک را بفرستید و با چت صوتی داخل بازی بحث کنید. شب مافیا هدف را انتخاب می‌کند و روز همه بحث و رأی‌گیری می‌کنند. چینش کلاسیک و ایرانی نقش‌ها، از ۳ تا ۱۲ نفر.',
      steps: [['میز بسازید یا وارد شوید', 'میز بسازید و لینک یا کدش را بفرستید، یا به یک میز باز بپیوندید.'], ['نقش مخفی‌تان را ببینید', 'شهروند، مافیا یا نقش ویژه مثل کارآگاه، دکتر یا تک‌تیرانداز.'], ['شب و روز', 'شب نقش‌ها مخفیانه کار می‌کنند. روز همه حرف می‌زنند و یک نفر را با رأی بیرون می‌کنند.'], ['تیمی ببرید', 'شهروندها وقتی همه مافیاها بیرون بروند می‌برند؛ مافیا وقتی هم‌تعداد شهروندها شود.']],
      features: ['چت صوتی داخل بازی', '۳ تا ۱۲ بازیکن', 'چینش کلاسیک و ایرانی', 'تماشاگر و مرور بازی'],
      faq: [['باید کنار هم باشیم؟', 'نه، چت صوتی داخل بازی است و دوستان از هر جایی می‌توانند بازی کنند.'], ['چه نقش‌هایی دارد؟', 'پدرخوانده، مافیا، کارآگاه، دکتر، تک‌تیرانداز، جان‌سخت، ناتو، جوکر، شهردار و شهروند.']],
    },
  },
  {
    slug: 'spy', bg: '#2A1418', fg: '#F08A7A', group: 'party',
    en: {
      name: 'Spy', line: 'Find the spy, one phone passed around.',
      h1: 'Spy: the party game on one phone', title: 'Spy – party game on one phone | Bazimoon',
      description: 'Everyone knows the secret word except the spy. Pass one phone around, ask questions and vote. Free party game for groups.',
      intro: 'A party game for a group around one phone. Everyone sees the same secret word, except the spy. Ask each other questions, then vote on who the spy is before time runs out.',
      steps: [['Deal the cards', 'Pass the phone around. Each player looks at their card alone, then hides it.'], ['Ask questions', 'Take turns asking about the word. Be clear enough to prove you know it, vague enough that the spy can\'t work it out.'], ['Vote', 'When you are ready, or the clock runs out, agree on who the spy is.'], ['Spy\'s last chance', 'If you catch the spy, they get one guess at the word. Guess right and the spy still wins.']],
      features: ['One phone for the whole group', 'Word packs in English and Persian', 'Timer', 'No sign-up'],
      faq: [['How many players?', 'Three or more, the more the better.'], ['Does everyone need a phone?', 'No, one phone is passed around.']],
    },
    fa: {
      name: 'جاسوس', line: 'جاسوس را پیدا کنید؛ با یک گوشی.',
      h1: 'بازی جاسوس با یک گوشی', title: 'بازی جاسوس – بازی گروهی با یک گوشی | بازیمون',
      description: 'همه کلمه مخفی را می‌دانند جز جاسوس. گوشی را دست‌به‌دست کنید، سؤال بپرسید و رأی بدهید. بازی گروهی رایگان.',
      intro: 'یک بازی دورهمی با یک گوشی. همه یک کلمه مخفی را می‌بینند، جز جاسوس. از هم سؤال بپرسید و پیش از تمام شدن وقت، رأی بدهید که جاسوس کیست.',
      steps: [['کارت‌ها را پخش کنید', 'گوشی را دست‌به‌دست کنید. هر کس کارتش را تنها ببیند و پنهان کند.'], ['سؤال بپرسید', 'به نوبت درباره کلمه سؤال بپرسید؛ آن‌قدر روشن که معلوم شود می‌دانید، آن‌قدر مبهم که جاسوس نفهمد.'], ['رأی بدهید', 'وقتی آماده شدید یا وقت تمام شد، روی جاسوس توافق کنید.'], ['شانس آخر جاسوس', 'اگر جاسوس را پیدا کنید، یک بار کلمه را حدس می‌زند. اگر درست بگوید باز هم می‌برد.']],
      features: ['یک گوشی برای همه', 'کلمه‌های فارسی و انگلیسی', 'زمان‌سنج', 'بدون ثبت‌نام'],
      faq: [['چند نفر لازم است؟', 'سه نفر یا بیشتر؛ هر چه بیشتر بهتر.'], ['همه گوشی لازم دارند؟', 'نه، یک گوشی دست‌به‌دست می‌شود.']],
    },
  },
  {
    slug: 'couple-quiz', bg: '#24121C', fg: '#F2A7C3', group: 'party',
    en: {
      name: 'Couple Quiz', line: 'Three questions a day to know each other better.',
      h1: 'Couple Quiz: how well do you know each other?', title: 'Couple Quiz – a daily game for couples | Bazimoon',
      description: 'Three questions a day for you and your partner: answer about yourself, guess their answers, then reveal together. Free and private.',
      intro: 'A daily game for two. Each day you answer three light questions about yourself and guess your partner\'s answers. Answers unlock only when you both finish, then you see how well you know each other.',
      steps: [['Send a private link', 'Invite your partner with a private link; it works once.'], ['Answer and guess', 'Each day: 3 questions about you, then guess the same 3 for your partner.'], ['Reveal together', 'Answers unlock only when you both finish, so nobody peeks.']],
      features: ['3 questions a day', 'Private to the two of you', 'Streaks together', 'Skip any question'],
      faq: [['Can others see our answers?', 'No, your answers are only for the two of you.'], ['Can we stop any time?', 'Yes, either partner can leave whenever they like.']],
    },
    fa: {
      name: 'کوییز زوج‌ها', line: 'روزی سه سؤال برای اینکه هم را بهتر بشناسید.',
      h1: 'کوییز زوج‌ها: چقدر همدیگر را می‌شناسید؟', title: 'کوییز زوج‌ها – بازی روزانه برای زوج‌ها | بازیمون',
      description: 'روزی سه سؤال برای شما و همراهتان: درباره خودتان جواب بدهید، جواب‌های او را حدس بزنید و با هم ببینید. رایگان و خصوصی.',
      intro: 'یک بازی روزانه برای دو نفر. هر روز به سه سؤال سبک درباره خودتان جواب می‌دهید و جواب‌های همراهتان را حدس می‌زنید. جواب‌ها فقط وقتی هر دو تمام کنید باز می‌شوند و می‌بینید چقدر همدیگر را می‌شناسید.',
      steps: [['لینک خصوصی بفرستید', 'همراهتان را با یک لینک خصوصی یک‌بارمصرف دعوت کنید.'], ['جواب بدهید و حدس بزنید', 'هر روز ۳ سؤال درباره خودتان، بعد حدس همان ۳ سؤال برای همراهتان.'], ['با هم ببینید', 'جواب‌ها فقط وقتی هر دو تمام کنید باز می‌شوند؛ کسی نمی‌تواند زودتر ببیند.']],
      features: ['روزی ۳ سؤال', 'فقط برای شما دو نفر', 'رکورد مشترک', 'رد کردن هر سؤال'],
      faq: [['دیگران جواب‌های ما را می‌بینند؟', 'نه، جواب‌ها فقط برای شما دو نفر است.'], ['هر وقت بخواهیم می‌توانیم خارج شویم؟', 'بله، هر کدام هر وقت بخواهد می‌تواند خارج شود.']],
    },
  },
  {
    slug: 'tic-tac-toe', bg: '#1E2138', fg: '#C3B9FF', group: 'classics',
    en: {
      name: 'Tic-tac-toe (Dooz)', line: 'Tic-tac-toe against a bot or a friend.',
      h1: 'Tic-tac-toe (Dooz) online', title: 'Tic-tac-toe (Dooz) – play free online | Bazimoon',
      description: 'Play tic-tac-toe on 3×3 or 5×5 against a bot or a friend on the same phone. Free, quick matches.',
      intro: 'Dooz is the Persian name for tic-tac-toe. Play on 3 × 3, or on 5 × 5 where you need four in a row, against the bot or a friend on the same phone. Win the most rounds to take the match.',
      steps: [['Take turns', 'You are X and the bot is O. Tap an empty square to place your mark.'], ['Make a line', 'Three in a row on 3 × 3, or four in a row on 5 × 5, across, down or diagonally.'], ['Win the match', 'Win the most rounds. Draws don\'t count, and who starts swaps each round.']],
      features: ['3 × 3 and 5 × 5 boards', 'Bot or a friend', 'Best-of matches', 'Works offline'],
      faq: [['Can two people play on one phone?', 'Yes, choose Friend and take turns.'], ['Is the bot beatable?', 'Yes, pick the level that suits you.']],
    },
    fa: {
      name: 'دوز', line: 'دوز با ربات یا یک دوست.',
      h1: 'بازی دوز آنلاین', title: 'دوز آنلاین رایگان | بازیمون',
      description: 'دوز را روی صفحه ۳×۳ یا ۵×۵ در برابر ربات یا با دوستتان روی یک گوشی بازی کنید. رایگان و سریع.',
      intro: 'دوز را روی صفحه ۳ در ۳، یا ۵ در ۵ که چهار در یک ردیف لازم است، با ربات یا با یک دوست روی همان گوشی بازی کنید. هر کس دورهای بیشتری ببرد، مسابقه را برده است.',
      steps: [['به نوبت بازی کنید', 'شما X هستید و ربات O. خانه خالی را بزنید تا علامتتان را بگذارید.'], ['یک ردیف بسازید', 'سه در یک ردیف روی ۳×۳، یا چهار در یک ردیف روی ۵×۵، افقی، عمودی یا مورب.'], ['مسابقه را ببرید', 'دورهای بیشتری ببرید. مساوی حساب نمی‌شود و شروع‌کننده هر دور عوض می‌شود.']],
      features: ['صفحه ۳×۳ و ۵×۵', 'با ربات یا دوست', 'مسابقه چنددوره‌ای', 'بدون اینترنت هم کار می‌کند'],
      faq: [['دو نفر روی یک گوشی می‌توانند بازی کنند؟', 'بله، «دوست» را انتخاب کنید و به نوبت بازی کنید.'], ['ربات را می‌شود برد؟', 'بله، سطحی را انتخاب کنید که مناسب شماست.']],
    },
  },
  {
    slug: 'memory', bg: '#1B2A44', fg: '#8FA8FF', group: 'classics',
    en: {
      name: 'Memory', line: 'Find the matching cards.',
      h1: 'Memory: a card matching game', title: 'Memory – free card matching game | Bazimoon',
      description: 'Flip two cards at a time and find every pair in as few moves as you can. Free memory game in your browser.',
      intro: 'Flip two cards at a time and remember where everything is. Find every pair in as few moves as you can to earn up to three stars and unlock new card backs.',
      steps: [['Flip two cards', 'Tap any two face-down cards to turn them over.'], ['Match the pair', 'If both show the same picture, they stay open. If not, they flip back.'], ['Remember and finish', 'Find every pair. Fewer moves give up to 3 stars.']],
      features: ['Stars for fewer moves', 'Unlockable card backs', 'Several board sizes', 'Works offline'],
      faq: [['Is it good for kids?', 'Yes, it is simple and has no time limit.'], ['How do I get three stars?', 'Find every pair in fewer moves.']],
    },
    fa: {
      name: 'بازی حافظه', line: 'کارت‌های جفت را پیدا کنید.',
      h1: 'بازی حافظه: جفت کارت‌ها را پیدا کنید', title: 'بازی حافظه آنلاین رایگان | بازیمون',
      description: 'هر بار دو کارت را برگردانید و همه جفت‌ها را با کمترین حرکت پیدا کنید. بازی حافظه رایگان در مرورگر.',
      intro: 'هر بار دو کارت را برگردانید و جای کارت‌ها را به خاطر بسپارید. همه جفت‌ها را با حرکت‌های کمتر پیدا کنید تا تا سه ستاره بگیرید و پشت کارت‌های تازه باز کنید.',
      steps: [['دو کارت برگردانید', 'دو کارت بسته را بزنید تا رو شوند.'], ['جفت را پیدا کنید', 'اگر هر دو یک تصویر باشند باز می‌مانند؛ اگر نه، دوباره بسته می‌شوند.'], ['به خاطر بسپارید و تمام کنید', 'همه جفت‌ها را پیدا کنید. حرکت کمتر تا ۳ ستاره می‌دهد.']],
      features: ['ستاره برای حرکت کمتر', 'پشت کارت‌های تازه', 'چند اندازه صفحه', 'بدون اینترنت هم کار می‌کند'],
      faq: [['برای بچه‌ها مناسب است؟', 'بله، ساده است و محدودیت زمانی ندارد.'], ['چطور سه ستاره بگیرم؟', 'همه جفت‌ها را با حرکت کمتری پیدا کنید.']],
    },
  },
  {
    slug: 'stack-tower', bg: '#13302C', fg: '#5FD0BE', group: 'classics',
    en: {
      name: 'Stack Tower', line: 'Stack blocks as high as you can.',
      h1: 'Stack Tower: a one-tap arcade game', title: 'Stack Tower – free one-tap arcade game | Bazimoon',
      description: 'Tap to drop each sliding block and build the tallest tower you can. Line them up perfectly for double points. Free.',
      intro: 'A one-tap arcade game. A block slides back and forth above your tower; tap to drop it. Anything hanging over the edge is cut off, so line it up and see how high you can build.',
      steps: [['A block slides across', 'Each new block moves back and forth above your tower.'], ['Tap to drop it', 'Any part hanging past the block below is cut off.'], ['Go for perfect', 'Line it up exactly: the block keeps its size and you score double.'], ['Miss and it ends', 'If the block misses the tower completely, the game is over.']],
      features: ['One-tap controls', 'Perfect-drop bonus', 'Your best is saved', 'Works offline'],
      faq: [['How do I score more?', 'Perfect drops keep the block wide and score double.'], ['Does it need the internet?', 'No, it works offline once opened.']],
    },
    fa: {
      name: 'برج', line: 'بلوک‌ها را تا جایی که می‌توانید بالا ببرید.',
      h1: 'بازی برج: آرکید تک‌ضربه', title: 'بازی برج – آرکید تک‌ضربه رایگان | بازیمون',
      description: 'با یک ضربه هر بلوک را بیندازید و بلندترین برج را بسازید. اگر دقیق بیندازید امتیاز دو برابر می‌گیرید. رایگان.',
      intro: 'یک بازی آرکید تک‌ضربه. بلوکی بالای برج شما رفت‌وبرگشت می‌کند؛ بزنید تا بیفتد. هر چه از لبه بیرون بزند بریده می‌شود، پس دقیق بیندازید و ببینید تا کجا بالا می‌روید.',
      steps: [['بلوک می‌لغزد', 'هر بلوک تازه بالای برج رفت‌وبرگشت می‌کند.'], ['بزنید تا بیفتد', 'هر بخشی که از بلوک پایینی بیرون بزند بریده می‌شود.'], ['دقیق بیندازید', 'اگر کاملاً روی هم بیفتد، اندازه‌اش می‌ماند و امتیاز دو برابر می‌گیرید.'], ['خطا یعنی پایان', 'اگر بلوک کاملاً از برج بیرون بیفتد، بازی تمام است.']],
      features: ['کنترل تک‌ضربه', 'جایزه انداختن دقیق', 'ذخیره بهترین امتیاز', 'بدون اینترنت هم کار می‌کند'],
      faq: [['چطور امتیاز بیشتری بگیرم؟', 'انداختن دقیق بلوک را پهن نگه می‌دارد و امتیاز دو برابر می‌دهد.'], ['به اینترنت نیاز دارد؟', 'نه، بعد از باز شدن بدون اینترنت هم کار می‌کند.']],
    },
  },
  {
    slug: 'snake', bg: '#14241A', fg: '#9ED98C', group: 'classics',
    en: {
      name: 'Snake', line: 'Classic snake, endless.',
      h1: 'Snake: the classic arcade game', title: 'Snake – play the classic game free | Bazimoon',
      description: 'Swipe to steer, eat the fruit and grow longer without hitting the wall or your tail. Classic Snake, free in your browser.',
      intro: 'The classic arcade game. Swipe to steer the snake, eat fruit to grow longer and faster, and avoid the walls and your own tail. Every fifth fruit is golden and worth three points.',
      steps: [['Swipe to steer', 'Swipe anywhere on the board, or use the arrows. Your first swipe starts the game.'], ['Eat to grow', 'Each fruit is a point and makes the snake longer, and a little faster.'], ['Golden fruit', 'Every fifth fruit is golden and worth 3 points.'], ['Don\'t crash', 'Hitting a wall or your own body ends the game.']],
      features: ['Swipe or arrow controls', 'Golden fruit bonus', 'Your best is saved', 'Works offline'],
      faq: [['Can I play on a computer?', 'Yes, use the arrow keys or the on-screen arrows.'], ['Does it speed up?', 'Yes, a little with every fruit.']],
    },
    fa: {
      name: 'مار', line: 'مار کلاسیک، بی‌پایان.',
      h1: 'بازی مار کلاسیک آنلاین', title: 'بازی مار آنلاین رایگان | بازیمون',
      description: 'با کشیدن انگشت مار را هدایت کنید، میوه بخورید و بلندتر شوید بدون اینکه به دیوار یا دمتان بخورید. مار کلاسیک، رایگان.',
      intro: 'همان بازی آرکید کلاسیک. با کشیدن انگشت مار را هدایت کنید، میوه بخورید تا بلندتر و سریع‌تر شوید و به دیوار و دم خودتان نخورید. هر پنجمین میوه طلایی است و ۳ امتیاز دارد.',
      steps: [['بکشید تا بچرخد', 'هر جای صفحه بکشید یا از فلش‌ها استفاده کنید. اولین حرکت بازی را شروع می‌کند.'], ['بخورید تا بزرگ شوید', 'هر میوه یک امتیاز است و مار را بلندتر و کمی سریع‌تر می‌کند.'], ['میوه طلایی', 'هر پنجمین میوه طلایی است و ۳ امتیاز دارد.'], ['برخورد نکنید', 'برخورد با دیوار یا بدن خودتان بازی را تمام می‌کند.']],
      features: ['کنترل با کشیدن یا فلش', 'جایزه میوه طلایی', 'ذخیره بهترین امتیاز', 'بدون اینترنت هم کار می‌کند'],
      faq: [['با کامپیوتر می‌شود بازی کرد؟', 'بله، با کلیدهای جهت یا فلش‌های روی صفحه.'], ['سریع‌تر می‌شود؟', 'بله، با هر میوه کمی سریع‌تر.']],
    },
  },
  {
    slug: 'blocks', bg: '#25141E', fg: '#F2B8D0', group: 'classics',
    en: {
      name: 'Blocks', line: 'Place pieces and clear lines.',
      h1: 'Blocks: a block puzzle game', title: 'Blocks – free block puzzle game | Bazimoon',
      description: 'Place pieces on the board and fill rows or columns to clear them. No timer, think as long as you like. Free and endless.',
      intro: 'A calm block puzzle with no timer. Place the three pieces you are given anywhere they fit; a full row or column clears. Clear several at once for a big bonus, and keep space open as long as you can.',
      steps: [['Pick a piece', 'Tap one of the three pieces below the board.'], ['Place it', 'Tap the board where it should go. Pieces cannot rotate.'], ['Clear lines', 'A full row or column disappears. Clearing several at once scores much more.'], ['Keep space open', 'When none of your pieces fit anywhere, the game ends.']],
      features: ['No timer', 'Combo bonuses', 'Your best is saved', 'Works offline'],
      faq: [['Is there a time limit?', 'No, take as long as you like.'], ['Can pieces rotate?', 'No, place them as they come.']],
    },
    fa: {
      name: 'بلوک‌ها', line: 'قطعه بگذارید و ردیف‌ها را پاک کنید.',
      h1: 'بازی بلوک‌ها: پازل قطعه‌ها', title: 'بازی بلوک‌ها – پازل آنلاین رایگان | بازیمون',
      description: 'قطعه‌ها را روی صفحه بگذارید و ردیف یا ستون را پر کنید تا پاک شود. بدون زمان‌سنج. رایگان و بی‌پایان.',
      intro: 'یک پازل آرام بدون زمان‌سنج. سه قطعه‌ای را که می‌گیرید هر جا جا شوند بگذارید؛ ردیف یا ستون پر پاک می‌شود. چند خط را با هم پاک کنید تا جایزه بزرگ بگیرید و تا می‌توانید جا خالی نگه دارید.',
      steps: [['یک قطعه انتخاب کنید', 'یکی از سه قطعه زیر صفحه را بزنید.'], ['بگذاریدش', 'جایی از صفحه را بزنید که قطعه باید برود. قطعه‌ها نمی‌چرخند.'], ['خط پاک کنید', 'ردیف یا ستون پر ناپدید می‌شود. پاک کردن چند خط با هم امتیاز خیلی بیشتری دارد.'], ['جا خالی نگه دارید', 'وقتی هیچ قطعه‌ای جا نشود، بازی تمام است.']],
      features: ['بدون زمان‌سنج', 'جایزه ترکیبی', 'ذخیره بهترین امتیاز', 'بدون اینترنت هم کار می‌کند'],
      faq: [['محدودیت زمانی دارد؟', 'نه، هر قدر بخواهید فکر کنید.'], ['قطعه‌ها می‌چرخند؟', 'نه، همان‌طور که می‌آیند بگذاریدشان.']],
    },
  },
]

/** The app route each game page opens (see readDeepLink's "play" link). */
export const appGame: Record<string, string> = {
  shelem: 'shelem',
  zip: 'zip', queens: 'queens', sudoku: 'sudoku', '2048': 'merge', minesweeper: 'mines', 'daily-word': 'word', 'word-ladder': 'ladder',
  'esm-famil': 'esmfamil', mafia: 'mafia', spy: 'spy', 'couple-quiz': 'couple', 'tic-tac-toe': 'dooz', memory: 'memory',
  'stack-tower': 'stack', snake: 'snake', blocks: 'blocks',
}

export interface SiteText {
  brand: string
  open: string
  otherLang: string
  otherLangLong: string
  title: string
  description: string
  h1: string
  intro: string
  cta: string
  ctaNote: string
  groups: Record<Game['group'], string>
  whyTitle: string
  why: [string, string][]
  installTitle: string
  installIntro: string
  platforms: [string, string[]][]
  installNote: string
  faqTitle: string
  faq: [string, string][]
  footer: string
  home: string
  crumbLabel: string
  play: (name: string) => string
  howTitle: (name: string) => string
  featTitle: string
  moreTitle: string
  allGames: string
  install: string
  guides: string
}

export const site: Record<Lang, SiteText> = {
  en: {
    brand: 'Bazimoon', open: 'Open Bazimoon', otherLang: 'فارسی', otherLangLong: 'نسخه فارسی',
    title: 'Bazimoon – free online games: daily puzzles, Mafia and word games',
    description: 'Free games in your browser: Sudoku, Zip, Queens, Word Guess, Dooz, voice Mafia, Esm-Famil and more. In English and Persian, no download.',
    h1: 'Free online games: daily puzzles, Mafia and word games',
    intro: 'Bazimoon is a free collection of games that runs right in your browser: Sudoku and logic puzzles with endless levels, word games, tic-tac-toe, and party games like voice Mafia and Esm-Famil online. No download, no sign-up to start.',
    cta: 'Play now', ctaNote: 'Free · no download · phone and computer',
    groups: { puzzles: 'Daily and logic puzzles', words: 'Word games', party: 'Party games with friends', classics: 'Classics and arcade' },
    whyTitle: 'Why Bazimoon?',
    why: [['English and Persian', 'Every game and menu in both languages, including Persian word lists.'], ['No download', 'Runs in the browser; install it to your home screen if you like.'], ['Level after level', 'Zip, Queens, Sudoku, Word Guess and Word Ladder go on level by level, as many a day as you like. Solve one each day to build a streak.'], ['With friends', 'Create a Mafia table, send the link and play with voice.']],
    installTitle: 'Add Bazimoon to your home screen',
    installIntro: 'Install Bazimoon like an app: its icon sits on your home screen, it opens full screen and the puzzles work offline. No app store needed.',
    platforms: [['iPhone and iPad (Safari)', ['Open bazimoon.com in Safari.', 'Tap the Share button (the square with an arrow pointing up).', 'Tap Add to Home Screen, then Add.']], ['Android (Chrome)', ['Open bazimoon.com in Chrome.', 'Tap the three-dot menu at the top.', 'Tap Install app or Add to Home screen.']]],
    installNote: 'On iPhone only Safari has this option. To get notifications on iPhone, install Bazimoon first.',
    faqTitle: 'Questions',
    faq: [['Is Bazimoon free?', 'Yes, every game is free.'], ['Do I need to install anything?', 'No. Open it in your phone or computer browser. Installing to the home screen is optional.'], ['Can I play without an account?', 'Yes, you start as a guest. Sign in with Google to keep your progress on every device.'], ['How many people can play Mafia?', '3 to 12, with voice chat in the game.']],
    footer: 'Bazimoon · free online games in English and Persian',
    home: 'Games', crumbLabel: 'Breadcrumb', play: (n) => `Play ${n}`, howTitle: (n) => `How to play ${n}`,
    featTitle: 'Features', moreTitle: 'More games', allGames: 'All games', install: 'Add to home screen', guides: 'Game guides',
  },
  fa: {
    brand: 'بازیمون', open: 'باز کردن بازیمون', otherLang: 'English', otherLangLong: 'English version',
    title: 'بازیمون – بازی آنلاین رایگان: پازل روزانه، مافیا و اسم فامیل',
    description: 'بازی‌های رایگان در مرورگر: سودوکو، زیپ، ملکه‌ها، حدس کلمه، دوز، مافیا با صدا، اسم فامیل و بیشتر. کاملاً فارسی، بدون دانلود.',
    h1: 'بازی آنلاین رایگان: پازل روزانه، مافیا و اسم فامیل',
    intro: 'بازیمون مجموعه‌ای از بازی‌های فارسی و رایگان است که مستقیم در مرورگر اجرا می‌شود: سودوکو و پازل‌های فکری با مرحله‌های بی‌پایان، حدس کلمه‌ی فارسی، دوز، و بازی‌های گروهی مثل مافیا با صدا و اسم فامیل آنلاین. بدون دانلود و بدون ثبت‌نام شروع کنید.',
    cta: 'همین حالا بازی کنید', ctaNote: 'رایگان · بدون دانلود · روی گوشی و کامپیوتر',
    groups: { puzzles: 'پازل‌های روزانه و فکری', words: 'بازی با کلمات', party: 'بازی گروهی با دوستان', classics: 'کلاسیک و آرکید' },
    whyTitle: 'چرا بازیمون؟',
    why: [['کاملاً فارسی', 'همه بازی‌ها و منوها به فارسی و راست‌به‌چپ؛ حدس کلمه و اسم فامیل با واژه‌های فارسی.'], ['بدون دانلود', 'در مرورگر اجرا می‌شود و اگر بخواهید مثل اپ روی صفحه اصلی نصب می‌شود.'], ['مرحله به مرحله', 'زیپ، ملکه‌ها، سودوکو، حدس کلمه و نردبان کلمات مرحله‌به‌مرحله پیش می‌روند، هر روز هر چند مرحله که بخواهید. هر روز یکی حل کنید تا رکورد بسازید.'], ['با دوستان', 'میز مافیا بسازید، لینک بفرستید و با صدا بازی کنید.']],
    installTitle: 'نصب بازیمون روی صفحه اصلی',
    installIntro: 'بازیمون را مثل یک اپ روی گوشی نصب کنید: آیکونش روی صفحه اصلی می‌آید، تمام‌صفحه باز می‌شود و پازل‌ها بدون اینترنت هم کار می‌کنند. نیازی به گوگل‌پلی یا اپ‌استور نیست.',
    platforms: [['آیفون و آیپد (سافاری)', ['bazimoon.com را در سافاری باز کنید.', 'دکمه اشتراک‌گذاری (مربع با فلش رو به بالا) را بزنید.', '«Add to Home Screen» را بزنید و بعد «Add».']], ['اندروید (کروم)', ['bazimoon.com را در کروم باز کنید.', 'منوی سه‌نقطه بالای صفحه را بزنید.', '«نصب برنامه» یا «Add to Home screen» را بزنید.']]],
    installNote: 'در آیفون فقط سافاری این گزینه را دارد. برای دریافت اعلان‌ها در آیفون، اول بازیمون را نصب کنید.',
    faqTitle: 'پرسش‌های رایج',
    faq: [['بازیمون رایگان است؟', 'بله، همه بازی‌ها رایگان هستند.'], ['باید چیزی نصب کنم؟', 'نه. در مرورگر گوشی یا کامپیوتر باز کنید. نصب روی صفحه اصلی اختیاری است.'], ['بدون ثبت‌نام می‌شود بازی کرد؟', 'بله، به‌عنوان مهمان شروع می‌کنید. با ورود با گوگل پیشرفتتان روی همه دستگاه‌ها می‌ماند.'], ['مافیا را چند نفره بازی کنیم؟', 'از ۳ تا ۱۲ نفر، با گفت‌وگوی صوتی داخل بازی.']],
    footer: 'بازیمون · بازی‌های آنلاین رایگان به فارسی و انگلیسی',
    home: 'بازی‌ها', crumbLabel: 'مسیر صفحه', play: (n) => `شروع ${n}`, howTitle: (n) => `آموزش ${n}`,
    featTitle: 'ویژگی‌ها', moreTitle: 'بازی‌های دیگر', allGames: 'همه بازی‌ها', install: 'نصب روی صفحه اصلی', guides: 'آموزش بازی‌ها',
  },
}
