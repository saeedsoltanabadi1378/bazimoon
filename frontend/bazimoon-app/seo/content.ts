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
    slug: 'zip', bg: '#173A36', fg: '#5FD0BE', group: 'puzzles',
    en: {
      name: 'Zip', line: 'One path through every cell; a new puzzle each day.',
      h1: 'Zip: a free daily path puzzle', title: 'Zip – free daily path puzzle online | Bazimoon',
      description: 'Draw one path through every cell, hitting the numbers in order. A new Zip puzzle every day, free in your browser.',
      intro: 'Zip is a short logic puzzle: draw a single path that passes through every cell of the grid and visits the numbers in order. There is a new puzzle every day at midnight, the same for everyone, so you can compare times with friends.',
      steps: [['Start at 1', 'Drag from the cell marked 1. Your path moves up, down, left or right.'], ['Hit the numbers in order', 'Pass through 2, 3, 4… in order.'], ['Fill every cell', 'The puzzle is solved when the path covers the whole grid and ends on the last number.']],
      features: ['A new puzzle every day', 'Streaks and a weekly league', 'Archive of past puzzles', 'Undo and hints'],
      faq: [['How long does a Zip puzzle take?', 'Most take one to three minutes.'], ['Is it the same puzzle for everyone?', 'Yes, everyone gets the same puzzle each day.']],
    },
    fa: {
      name: 'زیپ', line: 'یک مسیر از میان همه خانه‌ها؛ هر روز یک پازل تازه.',
      h1: 'زیپ: پازل مسیر روزانه رایگان', title: 'زیپ – پازل مسیر روزانه آنلاین و رایگان | بازیمون',
      description: 'یک مسیر از میان همه خانه‌ها بکشید و عددها را به ترتیب بگذرانید. هر روز یک پازل زیپ تازه، رایگان در مرورگر.',
      intro: 'زیپ یک پازل منطقی کوتاه است: یک مسیر بکشید که از همه خانه‌های جدول بگذرد و عددها را به ترتیب ببیند. هر شب ساعت ۱۲ پازل تازه‌ای می‌آید که برای همه یکسان است، پس می‌توانید زمانتان را با دوستان مقایسه کنید.',
      steps: [['از ۱ شروع کنید', 'از خانه‌ای که عدد ۱ دارد بکشید. مسیر به بالا، پایین، چپ یا راست می‌رود.'], ['عددها به ترتیب', 'از ۲، ۳، ۴ و بقیه به ترتیب بگذرید.'], ['همه خانه‌ها را پر کنید', 'وقتی مسیر کل جدول را پوشاند و روی آخرین عدد تمام شد، پازل حل شده است.']],
      features: ['هر روز یک پازل تازه', 'رکورد روزانه و لیگ هفتگی', 'آرشیو پازل‌های قبلی', 'برگرداندن حرکت و راهنما'],
      faq: [['حل هر پازل زیپ چقدر طول می‌کشد؟', 'بیشترشان یک تا سه دقیقه.'], ['پازل برای همه یکی است؟', 'بله، هر روز همه یک پازل را حل می‌کنند.']],
    },
  },
  {
    slug: 'queens', bg: '#2E2340', fg: '#B79CF2', group: 'puzzles',
    en: {
      name: 'Queens', line: 'One queen in every row, column and colour.',
      h1: 'Queens: a free daily logic puzzle', title: 'Queens – free daily logic puzzle online | Bazimoon',
      description: 'Place one queen in every row, column and colour region, with no two queens touching. A new Queens grid every day, free.',
      intro: 'Queens is a daily logic grid. Place exactly one queen in each row, each column and each colour region, and make sure no two queens touch, not even at the corners. Every grid has one solution and needs no guessing.',
      steps: [['Tap once to mark X', 'Use X to rule out cells where a queen cannot go.'], ['Tap twice to place a queen', 'Each row, each column and each colour region gets exactly one queen.'], ['Queens never touch', 'Two queens cannot sit next to each other, including diagonally.'], ['Conflicts turn red', 'Any rule you break is highlighted, so you can fix it right away.']],
      features: ['A new grid every day', 'Streaks and a weekly league', 'Conflicts shown straight away', 'Undo and hints'],
      faq: [['Do I need to know chess?', 'No. The queens only follow the rules above, not chess moves.'], ['Is there always one answer?', 'Yes, every grid has exactly one solution.']],
    },
    fa: {
      name: 'ملکه‌ها', line: 'یک ملکه در هر ردیف، ستون و رنگ.',
      h1: 'ملکه‌ها: پازل منطقی روزانه رایگان', title: 'ملکه‌ها – پازل منطقی روزانه آنلاین | بازیمون',
      description: 'در هر ردیف، ستون و ناحیه رنگی یک ملکه بگذارید، بدون اینکه دو ملکه به هم بچسبند. هر روز یک جدول تازه، رایگان.',
      intro: 'ملکه‌ها یک جدول منطقی روزانه است. در هر ردیف، هر ستون و هر ناحیه رنگی دقیقاً یک ملکه بگذارید و مراقب باشید هیچ دو ملکه‌ای به هم نچسبند، حتی از گوشه. هر جدول یک جواب دارد و بدون حدس زدن حل می‌شود.',
      steps: [['یک بار بزنید تا X بگذارید', 'با X خانه‌هایی را که ملکه نمی‌تواند آنجا باشد کنار بگذارید.'], ['دو بار بزنید تا ملکه بگذارید', 'هر ردیف، هر ستون و هر رنگ دقیقاً یک ملکه دارد.'], ['ملکه‌ها به هم نمی‌چسبند', 'دو ملکه نمی‌توانند کنار هم باشند، حتی به‌صورت مورب.'], ['اشتباه قرمز می‌شود', 'هر قانونی که شکسته شود مشخص می‌شود تا فوراً درستش کنید.']],
      features: ['هر روز یک جدول تازه', 'رکورد روزانه و لیگ هفتگی', 'نمایش فوری اشتباه‌ها', 'برگرداندن حرکت و راهنما'],
      faq: [['باید شطرنج بلد باشم؟', 'نه. ملکه‌ها فقط همین قانون‌ها را دارند، نه حرکت‌های شطرنج.'], ['همیشه یک جواب دارد؟', 'بله، هر جدول دقیقاً یک جواب دارد.']],
    },
  },
  {
    slug: 'sudoku', bg: '#12304A', fg: '#7CC4FA', group: 'puzzles',
    en: {
      name: 'Sudoku', line: 'Daily and classic 9×9 grids in four levels.',
      h1: 'Free online Sudoku: daily and classic grids', title: 'Free online Sudoku – daily and classic | Bazimoon',
      description: 'Play Sudoku free in your browser. A daily grid for everyone plus unlimited grids from Easy to Expert, with notes and hints.',
      intro: 'Play Sudoku free in your browser, no download. A new daily grid is the same for everyone, and Classic gives you unlimited grids in four levels, from Easy to Expert. Every grid is solvable by logic alone, with one answer.',
      steps: [['Pick a cell, then a number', 'Tap an empty cell, then a number on the pad below.'], ['Every number once', 'Each row, column and 3×3 box holds 1 to 9 exactly once.'], ['Pencil in notes', 'Jot the numbers that could fit, then decide later.'], ['Clashes turn red', 'A number repeated in its row, column or box turns red so you spot it early.']],
      features: ['Daily grid with streaks and a league', 'Four levels: Easy, Medium, Hard, Expert', 'Notes, hints and undo', 'Works offline'],
      faq: [['What is the daily Sudoku?', 'One Medium grid a day, the same for every player. Solve it to keep your streak.'], ['Is it good for beginners?', 'Yes. Easy starts with more numbers filled in, and hints are always there.']],
    },
    fa: {
      name: 'سودوکو', line: 'جدول ۹×۹ روزانه و کلاسیک در چهار سختی.',
      h1: 'سودوکو آنلاین رایگان؛ جدول روزانه و کلاسیک', title: 'سودوکو آنلاین رایگان – روزانه و کلاسیک | بازیمون',
      description: 'سودوکو را رایگان در مرورگر بازی کنید. جدول روزانه برای همه و جدول بی‌پایان از آسان تا استاد، با یادداشت و راهنما.',
      intro: 'سودوکو را رایگان و بدون دانلود در مرورگر بازی کنید. هر روز یک جدول تازه برای همه یکسان است و در حالت کلاسیک می‌توانید بی‌پایان در چهار سختی، از آسان تا استاد، بازی کنید. همه جدول‌ها فقط با منطق حل می‌شوند و یک جواب دارند.',
      steps: [['یک خانه، بعد یک عدد', 'خانه خالی را بزنید و عدد را از صفحه‌کلید پایین انتخاب کنید.'], ['هر عدد یک بار', 'در هر ردیف، هر ستون و هر خانه ۳×۳ عددهای ۱ تا ۹ فقط یک بار می‌آیند.'], ['یادداشت بگذارید', 'عددهای ممکن را کوچک در خانه بنویسید تا بعد تصمیم بگیرید.'], ['تکرار قرمز می‌شود', 'عدد تکراری در ردیف، ستون یا خانه قرمز می‌شود تا اشتباه را زود ببینید.']],
      features: ['جدول روزانه با رکورد و لیگ', 'چهار سختی: آسان، متوسط، سخت، استاد', 'یادداشت، راهنما و برگرداندن حرکت', 'بدون اینترنت هم کار می‌کند'],
      faq: [['سودوکو روزانه چیست؟', 'هر روز یک جدول با سختی متوسط برای همه بازیکنان یکسان است. حلش کنید و رکوردتان را ادامه دهید.'], ['سودوکو برای مبتدی‌ها هم هست؟', 'بله. سختی آسان با عددهای بیشتری شروع می‌شود و راهنما همیشه در دسترس است.']],
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
      name: 'Daily Word', line: 'Six tries to guess the five-letter word.',
      h1: 'Daily Word: guess the word in six tries', title: 'Daily Word – free daily word game in English and Persian | Bazimoon',
      description: 'Guess the five-letter word in six tries. A new word every day, in English and in Persian. Free in your browser.',
      intro: 'A new five-letter word every day, in English and in Persian. Type a guess and the colours tell you which letters are right. Find the word in six tries or fewer and share your result without spoilers.',
      steps: [['Guess the word', 'Type any valid five-letter word and submit it.'], ['Read the colours', 'Green is the right letter in the right spot. Yellow is in the word but elsewhere. Grey is not in the word.'], ['Solve in six', 'Use what you learn to find the word in six tries or fewer.']],
      features: ['English and Persian words', 'A new word every day', 'High-contrast colours', 'Spoiler-free sharing'],
      faq: [['Is there a Persian version?', 'Yes, switch to Persian for a five-letter Persian word each day.'], ['Can I play more than once a day?', 'The daily word is once a day; come back tomorrow for the next one.']],
    },
    fa: {
      name: 'کلمه روز', line: 'شش فرصت برای حدس کلمه پنج‌حرفی فارسی.',
      h1: 'کلمه روز: وردل فارسی آنلاین', title: 'کلمه روز – وردل فارسی آنلاین و رایگان | بازیمون',
      description: 'کلمه پنج‌حرفی را در شش فرصت حدس بزنید. هر روز یک کلمه تازه فارسی (و انگلیسی). بازی رایگان کلمات در مرورگر.',
      intro: 'هر روز یک کلمه پنج‌حرفی تازه به فارسی و انگلیسی. حدستان را بنویسید و رنگ‌ها می‌گویند کدام حرف درست است. کلمه را در شش فرصت یا کمتر پیدا کنید و نتیجه را بدون لو دادن جواب با دوستان به اشتراک بگذارید.',
      steps: [['کلمه را حدس بزنید', 'یک کلمه پنج‌حرفی درست بنویسید و ثبت کنید.'], ['رنگ‌ها را بخوانید', 'سبز یعنی حرف درست در جای درست. زرد یعنی حرف در کلمه هست ولی جای دیگری. خاکستری یعنی در کلمه نیست.'], ['در شش فرصت حل کنید', 'با سرنخ‌ها کلمه را در شش حدس یا کمتر پیدا کنید.']],
      features: ['کلمه‌های فارسی و انگلیسی', 'هر روز یک کلمه تازه', 'رنگ‌های پرکنتراست', 'اشتراک نتیجه بدون لو دادن جواب'],
      faq: [['این همان وردل است؟', 'بله، همان ایده با کلمه‌های فارسی و انگلیسی.'], ['روزی چند بار می‌شود بازی کرد؟', 'کلمه روز یک بار در روز است؛ فردا کلمه بعدی می‌آید.']],
    },
  },
  {
    slug: 'word-ladder', bg: '#3A2A16', fg: '#F0A83A', group: 'words',
    en: {
      name: 'Word Ladder', line: 'Change one letter at a time to reach the target.',
      h1: 'Word Ladder: change one letter at a time', title: 'Word Ladder – free daily word puzzle | Bazimoon',
      description: 'Turn the top word into the bottom word by changing one letter at a time, making a real word at every step. Free daily puzzle.',
      intro: 'Get from the top word to the bottom word by changing one letter at a time. Every step has to be a real word. Match par, or beat it, for a better score.',
      steps: [['Pick a letter', 'Tap one letter of your last word to change it.'], ['Make a real word', 'Type the new letter. The new word must be in the dictionary.'], ['Reach the target', 'Get to the bottom word. Matching par is good; beating it is better.']],
      features: ['A new ladder every day', 'Par to beat', 'English and Persian', 'Hints'],
      faq: [['What is par?', 'The fewest steps we found. Matching it is good; beating it is better.'], ['Does it work in Persian?', 'Yes, ladders come in both languages.']],
    },
    fa: {
      name: 'نردبان کلمات', line: 'هر بار یک حرف را عوض کنید و به کلمه مقصد برسید.',
      h1: 'نردبان کلمات: هر بار یک حرف', title: 'نردبان کلمات – پازل کلمه روزانه رایگان | بازیمون',
      description: 'کلمه بالا را با عوض کردن یک حرف در هر مرحله به کلمه پایین برسانید؛ هر پله باید کلمه درستی باشد. پازل روزانه رایگان.',
      intro: 'از کلمه بالا به کلمه پایین برسید، هر بار فقط با عوض کردن یک حرف. هر پله باید یک کلمه واقعی باشد. با تعداد پله‌های «پار» برسید یا کمتر، تا امتیاز بهتری بگیرید.',
      steps: [['یک حرف را انتخاب کنید', 'یکی از حرف‌های آخرین کلمه را بزنید تا عوضش کنید.'], ['کلمه درست بسازید', 'حرف تازه را بنویسید. کلمه جدید باید در فرهنگ لغت باشد.'], ['به مقصد برسید', 'به کلمه پایین برسید. رسیدن با پار خوب است، کمتر از آن بهتر.']],
      features: ['هر روز یک نردبان تازه', 'پار برای رقابت', 'فارسی و انگلیسی', 'راهنما'],
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
    description: 'Free games in your browser: Sudoku, Zip, Queens, Daily Word, Dooz, voice Mafia, Esm-Famil and more. In English and Persian, no download.',
    h1: 'Free online games: daily puzzles, Mafia and word games',
    intro: 'Bazimoon is a free collection of games that runs right in your browser: Sudoku and daily puzzles, a daily word game, tic-tac-toe, and party games like voice Mafia and Esm-Famil online. No download, no sign-up to start.',
    cta: 'Play now', ctaNote: 'Free · no download · phone and computer',
    groups: { puzzles: 'Daily and logic puzzles', words: 'Word games', party: 'Party games with friends', classics: 'Classics and arcade' },
    whyTitle: 'Why Bazimoon?',
    why: [['English and Persian', 'Every game and menu in both languages, including Persian word lists.'], ['No download', 'Runs in the browser; install it to your home screen if you like.'], ['A new puzzle every day', 'Zip, Queens, Sudoku and Daily Word are the same for everyone each day. Build a streak.'], ['With friends', 'Create a Mafia table, send the link and play with voice.']],
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
    description: 'بازی‌های رایگان در مرورگر: سودوکو، زیپ، ملکه‌ها، کلمه روز، دوز، مافیا با صدا، اسم فامیل و بیشتر. کاملاً فارسی، بدون دانلود.',
    h1: 'بازی آنلاین رایگان: پازل روزانه، مافیا و اسم فامیل',
    intro: 'بازیمون مجموعه‌ای از بازی‌های فارسی و رایگان است که مستقیم در مرورگر اجرا می‌شود: سودوکو و پازل‌های روزانه، کلمه روز فارسی، دوز، و بازی‌های گروهی مثل مافیا با صدا و اسم فامیل آنلاین. بدون دانلود و بدون ثبت‌نام شروع کنید.',
    cta: 'همین حالا بازی کنید', ctaNote: 'رایگان · بدون دانلود · روی گوشی و کامپیوتر',
    groups: { puzzles: 'پازل‌های روزانه و فکری', words: 'بازی با کلمات', party: 'بازی گروهی با دوستان', classics: 'کلاسیک و آرکید' },
    whyTitle: 'چرا بازیمون؟',
    why: [['کاملاً فارسی', 'همه بازی‌ها و منوها به فارسی و راست‌به‌چپ؛ کلمه روز و اسم فامیل با واژه‌های فارسی.'], ['بدون دانلود', 'در مرورگر اجرا می‌شود و اگر بخواهید مثل اپ روی صفحه اصلی نصب می‌شود.'], ['پازل تازه هر روز', 'زیپ، ملکه‌ها، سودوکو و کلمه روز هر روز برای همه یکسان است؛ رکورد بسازید.'], ['با دوستان', 'میز مافیا بسازید، لینک بفرستید و با صدا بازی کنید.']],
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
