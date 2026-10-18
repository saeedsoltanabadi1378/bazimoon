// Couple Quiz question sets. The API picks a set id per couple day (CoupleRules.SetForDay) and only
// stores option indexes, so the text lives here in both languages. Keep options in the same order
// across languages: index 2 in English must mean the same thing as index 2 in Persian.

export interface CoupleQuestion {
  /** Asked about yourself. */
  you: string;
  /** Asked when guessing for your partner; {name} is their name. */
  them: string;
  /** Short label for the reveal. */
  short: string;
  options: [string, string, string, string];
}

export interface CoupleSet {
  theme: string;
  questions: [CoupleQuestion, CoupleQuestion, CoupleQuestion];
}

const EN: CoupleSet[] = [
  {
    theme: "Weekend plans, food and little habits",
    questions: [
      { you: "What is your perfect Friday?", them: "What is {name}'s perfect Friday?", short: "Perfect Friday?", options: ["A lazy morning at home", "Out with friends", "A trip out of the city", "Cooking something new"] },
      { you: "What is your go-to comfort food?", them: "What is {name}'s go-to comfort food?", short: "Go-to comfort food?", options: ["Ghormeh sabzi", "Pizza", "Something sweet", "Whatever the other one cooks"] },
      { you: "How do you handle a stressful day?", them: "How does {name} handle a stressful day?", short: "Handling a stressful day?", options: ["Talk it through", "Some quiet time alone", "A long walk", "Keep busy"] },
    ],
  },
  {
    theme: "Childhood memories",
    questions: [
      { you: "What were you like as a kid?", them: "What was {name} like as a kid?", short: "As a kid?", options: ["Quiet and shy", "Always in trouble", "The class clown", "Glued to books"] },
      { you: "Your favourite childhood game?", them: "{name}'s favourite childhood game?", short: "Favourite childhood game?", options: ["Football in the street", "Hide and seek", "Video games", "Board games with family"] },
      { you: "What did you want to be when you grew up?", them: "What did {name} want to be when they grew up?", short: "Dream job as a kid?", options: ["Doctor", "Astronaut or pilot", "Artist or musician", "Teacher"] },
    ],
  },
  {
    theme: "Travel dreams",
    questions: [
      { you: "Your dream kind of trip?", them: "{name}'s dream kind of trip?", short: "Dream trip?", options: ["Beach and sun", "Mountains and hiking", "A big new city", "A road trip, no plan"] },
      { you: "Your travel style?", them: "{name}'s travel style?", short: "Travel style?", options: ["Every hour planned", "A rough plan", "Totally spontaneous", "Whatever you decide"] },
      { you: "What do you always pack too much of?", them: "What does {name} always pack too much of?", short: "Always overpacks?", options: ["Clothes", "Snacks", "Chargers and gadgets", "Books"] },
    ],
  },
  {
    theme: "Music and movies",
    questions: [
      { you: "Your movie-night pick?", them: "{name}'s movie-night pick?", short: "Movie-night pick?", options: ["Comedy", "Thriller or horror", "Romance", "Documentary"] },
      { you: "What do you sing along to in the car?", them: "What does {name} sing along to in the car?", short: "Car sing-along?", options: ["Persian pop", "Old classics", "Whatever is on the radio", "I never sing"] },
      { you: "How do you watch a series?", them: "How does {name} watch a series?", short: "Watching a series?", options: ["Binge it in a weekend", "One episode a night", "Start many, finish few", "Only together with you"] },
    ],
  },
  {
    theme: "Little habits",
    questions: [
      { you: "First thing you do in the morning?", them: "First thing {name} does in the morning?", short: "First thing in the morning?", options: ["Check my phone", "Tea or coffee", "Hit snooze again", "Shower"] },
      { you: "How tidy are you, honestly?", them: "How tidy is {name}, honestly?", short: "How tidy?", options: ["Spotless", "Tidy enough", "Organised chaos", "Please don't look"] },
      { you: "When are you most productive?", them: "When is {name} most productive?", short: "Most productive?", options: ["Early morning", "Late morning", "Afternoon", "Late at night"] },
    ],
  },
  {
    theme: "Food and cooking",
    questions: [
      { you: "Who should really do the cooking?", them: "Who does {name} think should do the cooking?", short: "Who should cook?", options: ["Me", "You", "Both together", "The delivery app"] },
      { you: "Your favourite dessert?", them: "{name}'s favourite dessert?", short: "Favourite dessert?", options: ["Bastani sonnati", "Chocolate cake", "Fresh fruit", "Shole zard"] },
      { you: "Breakfast of choice?", them: "{name}'s breakfast of choice?", short: "Breakfast?", options: ["Bread, cheese and walnuts", "Eggs", "Just tea", "Skip it"] },
    ],
  },
  {
    theme: "Love languages",
    questions: [
      { you: "What makes you feel most loved?", them: "What makes {name} feel most loved?", short: "Feels most loved by?", options: ["Kind words", "Time together", "Little gifts", "Help with chores"] },
      { you: "Your ideal date night?", them: "{name}'s ideal date night?", short: "Ideal date night?", options: ["Dinner out", "A movie at home", "A walk somewhere new", "Trying a new activity"] },
      { you: "How do you say sorry?", them: "How does {name} say sorry?", short: "Saying sorry?", options: ["Say it straight away", "Need a little time first", "Show it, not say it", "Make a joke to break the ice"] },
    ],
  },
  {
    theme: "Money and plans",
    questions: [
      { you: "You get an unexpected bonus. What happens?", them: "{name} gets an unexpected bonus. What happens?", short: "Unexpected bonus?", options: ["Save it", "Treat us both", "Travel", "Buy that thing I wanted"] },
      { you: "Where would you love to live one day?", them: "Where would {name} love to live one day?", short: "Live one day?", options: ["Right here", "By the sea", "A big city abroad", "A quiet village"] },
      { you: "Your shopping style?", them: "{name}'s shopping style?", short: "Shopping style?", options: ["Plan and compare", "Buy on impulse", "Avoid it if I can", "Hunt for bargains"] },
    ],
  },
  {
    theme: "Friends and family",
    questions: [
      { you: "At a party, you are…", them: "At a party, {name} is…", short: "At a party?", options: ["Dancing", "In the kitchen talking", "Looking after everyone", "Ready to go home"] },
      { you: "How often do you call your family?", them: "How often does {name} call their family?", short: "Calls family?", options: ["Every day", "A few times a week", "Once a week", "When they call me"] },
      { you: "Your role in your friend group?", them: "{name}'s role in their friend group?", short: "Role in friend group?", options: ["The planner", "The funny one", "The listener", "The one who's always late"] },
    ],
  },
  {
    theme: "Pet peeves",
    questions: [
      { you: "What annoys you most?", them: "What annoys {name} most?", short: "Annoys most?", options: ["Loud chewing", "Being late", "Messy rooms", "Slow walkers"] },
      { you: "Your reaction when you're hungry?", them: "{name}'s reaction when hungry?", short: "When hungry?", options: ["Grumpy", "Quiet", "Snack hunting", "Totally fine"] },
      { you: "Phone notifications: how many unread?", them: "How many unread notifications does {name} have?", short: "Unread notifications?", options: ["Zero, always", "A handful", "Dozens", "Hundreds, don't ask"] },
    ],
  },
  {
    theme: "Dreams and goals",
    questions: [
      { you: "A skill you'd love to learn?", them: "A skill {name} would love to learn?", short: "Skill to learn?", options: ["A new language", "An instrument", "Cooking properly", "A sport"] },
      { you: "Where do you see us in five years?", them: "Where does {name} see us in five years?", short: "In five years?", options: ["Same place, happier", "In a new city", "With a bigger family", "Travelling the world"] },
      { you: "Your biggest motivation?", them: "{name}'s biggest motivation?", short: "Biggest motivation?", options: ["Family", "Success at work", "Freedom", "Making others happy"] },
    ],
  },
  {
    theme: "Seasons and weather",
    questions: [
      { you: "Your favourite season?", them: "{name}'s favourite season?", short: "Favourite season?", options: ["Spring", "Summer", "Autumn", "Winter"] },
      { you: "Perfect rainy-day plan?", them: "{name}'s perfect rainy-day plan?", short: "Rainy-day plan?", options: ["Tea and a book", "A walk in the rain", "Movies under a blanket", "Nap"] },
      { you: "Nowruz highlight?", them: "{name}'s Nowruz highlight?", short: "Nowruz highlight?", options: ["Family visits", "Sizdah bedar picnic", "The haft-sin table", "Time off work"] },
    ],
  },
  {
    theme: "Home life",
    questions: [
      { you: "Favourite spot at home?", them: "{name}'s favourite spot at home?", short: "Favourite spot at home?", options: ["The couch", "The bed", "The kitchen", "The balcony"] },
      { you: "Chore you secretly don't mind?", them: "Chore {name} secretly doesn't mind?", short: "Chore they don't mind?", options: ["Dishes", "Laundry", "Grocery shopping", "Vacuuming"] },
      { you: "Thermostat setting?", them: "{name}'s thermostat setting?", short: "Thermostat?", options: ["Warm and cosy", "Cool", "Window open always", "Whatever you like"] },
    ],
  },
  {
    theme: "Firsts",
    questions: [
      { you: "What did you notice first about me?", them: "What did {name} notice first about you?", short: "Noticed first?", options: ["Your smile", "Your eyes", "Your sense of humour", "Your voice"] },
      { you: "Best part of our first date?", them: "{name}'s favourite part of your first date?", short: "First date highlight?", options: ["The conversation", "The place", "The nerves", "Saying goodbye"] },
      { you: "When did you know it was serious?", them: "When did {name} know it was serious?", short: "Knew it was serious?", options: ["Right away", "After a few weeks", "After a few months", "Still deciding"] },
    ],
  },
  {
    theme: "Games and fun",
    questions: [
      { you: "How competitive are you in games?", them: "How competitive is {name} in games?", short: "Competitive?", options: ["I play to win", "Just for fun", "Sore loser", "I let you win"] },
      { you: "In Mafia, you are usually…", them: "In Mafia, {name} is usually…", short: "In Mafia?", options: ["The first suspect", "The detective", "A quiet villager", "The best liar"] },
      { you: "Your favourite way to spend a free hour?", them: "{name}'s favourite way to spend a free hour?", short: "Free hour?", options: ["Puzzles and games", "Social media", "A walk", "A nap"] },
    ],
  },
];

const FA: CoupleSet[] = [
  {
    theme: "برنامه آخر هفته، غذا و عادت‌های کوچک",
    questions: [
      { you: "جمعه ایده‌آل شما چیست؟", them: "جمعه ایده‌آل {name} چیست؟", short: "جمعه ایده‌آل؟", options: ["صبح آرام در خانه", "بیرون با دوستان", "سفر به بیرون شهر", "پختن یک غذای تازه"] },
      { you: "غذای دلخواه روزهای سخت شما؟", them: "غذای دلخواه روزهای سخت {name}؟", short: "غذای دلخواه؟", options: ["قورمه‌سبزی", "پیتزا", "یک چیز شیرین", "هرچه آن یکی بپزد"] },
      { you: "یک روز پراسترس را چطور می‌گذرانید؟", them: "{name} یک روز پراسترس را چطور می‌گذراند؟", short: "روز پراسترس؟", options: ["درباره‌اش حرف می‌زنم", "کمی تنهایی و سکوت", "یک پیاده‌روی طولانی", "خودم را سرگرم می‌کنم"] },
    ],
  },
  {
    theme: "خاطرات کودکی",
    questions: [
      { you: "در کودکی چطور بچه‌ای بودید؟", them: "{name} در کودکی چطور بچه‌ای بود؟", short: "در کودکی؟", options: ["آرام و خجالتی", "همیشه دردسرساز", "دلقک کلاس", "غرق کتاب"] },
      { you: "بازی محبوب کودکی شما؟", them: "بازی محبوب کودکی {name}؟", short: "بازی کودکی؟", options: ["فوتبال در کوچه", "قایم‌باشک", "بازی ویدیویی", "بازی رومیزی با خانواده"] },
      { you: "بچه که بودید می‌خواستید چه‌کاره شوید؟", them: "{name} بچه که بود می‌خواست چه‌کاره شود؟", short: "شغل رؤیایی کودکی؟", options: ["دکتر", "فضانورد یا خلبان", "هنرمند یا نوازنده", "معلم"] },
    ],
  },
  {
    theme: "رؤیای سفر",
    questions: [
      { you: "سفر رؤیایی شما چه شکلی است؟", them: "سفر رؤیایی {name} چه شکلی است؟", short: "سفر رؤیایی؟", options: ["ساحل و آفتاب", "کوه و طبیعت‌گردی", "یک شهر بزرگ تازه", "جاده‌گردی بی‌برنامه"] },
      { you: "سبک سفر شما؟", them: "سبک سفر {name}؟", short: "سبک سفر؟", options: ["همه ساعت‌ها برنامه‌ریزی‌شده", "یک برنامه کلی", "کاملاً خودجوش", "هرچه تو بگویی"] },
      { you: "همیشه از چه چیزی زیادی برمی‌دارید؟", them: "{name} همیشه از چه چیزی زیادی برمی‌دارد؟", short: "زیادی برمی‌دارد؟", options: ["لباس", "خوراکی", "شارژر و وسایل برقی", "کتاب"] },
    ],
  },
  {
    theme: "موسیقی و فیلم",
    questions: [
      { you: "انتخاب شما برای شب فیلم؟", them: "انتخاب {name} برای شب فیلم؟", short: "شب فیلم؟", options: ["کمدی", "هیجانی یا ترسناک", "عاشقانه", "مستند"] },
      { you: "در ماشین با چه آهنگی همخوانی می‌کنید؟", them: "{name} در ماشین با چه آهنگی همخوانی می‌کند؟", short: "همخوانی در ماشین؟", options: ["پاپ فارسی", "آهنگ‌های قدیمی", "هرچه رادیو پخش کند", "هیچ‌وقت نمی‌خوانم"] },
      { you: "سریال را چطور می‌بینید؟", them: "{name} سریال را چطور می‌بیند؟", short: "سریال دیدن؟", options: ["یک‌نفس در آخر هفته", "هر شب یک قسمت", "زیاد شروع می‌کنم، کم تمام", "فقط با تو"] },
    ],
  },
  {
    theme: "عادت‌های کوچک",
    questions: [
      { you: "اولین کار صبحتان؟", them: "اولین کار صبح {name}؟", short: "اول صبح؟", options: ["سر زدن به گوشی", "چای یا قهوه", "یک بار دیگر چرت", "دوش"] },
      { you: "راستش را بگویید، چقدر مرتب هستید؟", them: "راستش، {name} چقدر مرتب است؟", short: "چقدر مرتب؟", options: ["برق می‌زند", "به اندازه کافی", "شلوغی منظم", "لطفاً نگاه نکن"] },
      { you: "چه زمانی بیشترین کار را می‌کنید؟", them: "{name} چه زمانی بیشترین کار را می‌کند؟", short: "پربازده‌ترین زمان؟", options: ["صبح زود", "اواخر صبح", "بعدازظهر", "نیمه‌شب"] },
    ],
  },
  {
    theme: "غذا و آشپزی",
    questions: [
      { you: "واقعاً چه کسی باید آشپزی کند؟", them: "به نظر {name} چه کسی باید آشپزی کند؟", short: "چه کسی بپزد؟", options: ["من", "تو", "هر دو با هم", "اپ سفارش غذا"] },
      { you: "دسر محبوب شما؟", them: "دسر محبوب {name}؟", short: "دسر محبوب؟", options: ["بستنی سنتی", "کیک شکلاتی", "میوه تازه", "شله‌زرد"] },
      { you: "صبحانه دلخواه شما؟", them: "صبحانه دلخواه {name}؟", short: "صبحانه؟", options: ["نان و پنیر و گردو", "تخم‌مرغ", "فقط چای", "نمی‌خورم"] },
    ],
  },
  {
    theme: "زبان عشق",
    questions: [
      { you: "چه چیزی بیشتر حس دوست‌داشته‌شدن به شما می‌دهد؟", them: "چه چیزی بیشتر به {name} حس دوست‌داشته‌شدن می‌دهد؟", short: "حس دوست‌داشته‌شدن؟", options: ["حرف‌های مهربان", "وقت گذراندن با هم", "هدیه‌های کوچک", "کمک در کارها"] },
      { you: "قرار عاشقانه ایده‌آل شما؟", them: "قرار عاشقانه ایده‌آل {name}؟", short: "قرار ایده‌آل؟", options: ["شام بیرون", "فیلم در خانه", "قدم زدن در جای تازه", "امتحان یک کار جدید"] },
      { you: "چطور عذرخواهی می‌کنید؟", them: "{name} چطور عذرخواهی می‌کند؟", short: "عذرخواهی؟", options: ["فوراً می‌گویم", "اول کمی زمان لازم دارم", "با رفتار نشان می‌دهم", "با یک شوخی یخ را می‌شکنم"] },
    ],
  },
  {
    theme: "پول و برنامه‌ها",
    questions: [
      { you: "یک پاداش غیرمنتظره می‌گیرید. چه می‌شود؟", them: "{name} یک پاداش غیرمنتظره می‌گیرد. چه می‌شود؟", short: "پاداش غیرمنتظره؟", options: ["پس‌انداز", "مهمان کردن هر دومان", "سفر", "خرید همان چیزی که می‌خواستم"] },
      { you: "دوست دارید روزی کجا زندگی کنید؟", them: "{name} دوست دارد روزی کجا زندگی کند؟", short: "روزی کجا زندگی کند؟", options: ["همین‌جا", "کنار دریا", "یک شهر بزرگ خارجی", "یک روستای آرام"] },
      { you: "سبک خرید شما؟", them: "سبک خرید {name}؟", short: "سبک خرید؟", options: ["برنامه و مقایسه", "خرید هیجانی", "تا جایی که بشود نمی‌روم", "دنبال تخفیف"] },
    ],
  },
  {
    theme: "دوستان و خانواده",
    questions: [
      { you: "در مهمانی شما…", them: "در مهمانی {name}…", short: "در مهمانی؟", options: ["می‌رقصد", "در آشپزخانه گرم صحبت است", "حواسش به همه هست", "آماده رفتن به خانه است"] },
      { you: "چقدر به خانواده‌تان زنگ می‌زنید؟", them: "{name} چقدر به خانواده‌اش زنگ می‌زند؟", short: "تماس با خانواده؟", options: ["هر روز", "چند بار در هفته", "هفته‌ای یک بار", "وقتی آن‌ها زنگ بزنند"] },
      { you: "نقش شما در جمع دوستان؟", them: "نقش {name} در جمع دوستان؟", short: "نقش در جمع دوستان؟", options: ["برنامه‌ریز", "شوخ جمع", "شنونده", "همیشه دیر می‌رسد"] },
    ],
  },
  {
    theme: "چیزهایی که کلافه‌مان می‌کند",
    questions: [
      { you: "چه چیزی بیشتر از همه کلافه‌تان می‌کند؟", them: "چه چیزی {name} را بیشتر از همه کلافه می‌کند؟", short: "بیشتر کلافه می‌شود از؟", options: ["صدای جویدن", "دیر کردن", "اتاق شلوغ", "آدم‌هایی که آهسته راه می‌روند"] },
      { you: "وقتی گرسنه‌اید چطورید؟", them: "{name} وقتی گرسنه است چطور است؟", short: "وقت گرسنگی؟", options: ["بداخلاق", "ساکت", "دنبال خوراکی", "کاملاً عادی"] },
      { you: "چند اعلان خوانده‌نشده دارید؟", them: "{name} چند اعلان خوانده‌نشده دارد؟", short: "اعلان‌های خوانده‌نشده؟", options: ["همیشه صفر", "چندتا", "ده‌ها", "صدها، نپرس"] },
    ],
  },
  {
    theme: "رؤیاها و هدف‌ها",
    questions: [
      { you: "مهارتی که دوست دارید یاد بگیرید؟", them: "مهارتی که {name} دوست دارد یاد بگیرد؟", short: "مهارت تازه؟", options: ["یک زبان جدید", "یک ساز", "آشپزی درست‌وحسابی", "یک ورزش"] },
      { you: "پنج سال دیگر ما را کجا می‌بینید؟", them: "{name} پنج سال دیگر شما را کجا می‌بیند؟", short: "پنج سال دیگر؟", options: ["همین‌جا، شادتر", "در یک شهر تازه", "با خانواده‌ای بزرگ‌تر", "در سفر دور دنیا"] },
      { you: "بزرگ‌ترین انگیزه شما؟", them: "بزرگ‌ترین انگیزه {name}؟", short: "بزرگ‌ترین انگیزه؟", options: ["خانواده", "موفقیت کاری", "آزادی", "شاد کردن دیگران"] },
    ],
  },
  {
    theme: "فصل‌ها و هوا",
    questions: [
      { you: "فصل محبوب شما؟", them: "فصل محبوب {name}؟", short: "فصل محبوب؟", options: ["بهار", "تابستان", "پاییز", "زمستان"] },
      { you: "برنامه ایده‌آل روز بارانی؟", them: "برنامه ایده‌آل {name} برای روز بارانی؟", short: "روز بارانی؟", options: ["چای و کتاب", "قدم زدن زیر باران", "فیلم زیر پتو", "چرت"] },
      { you: "بهترین بخش نوروز برای شما؟", them: "بهترین بخش نوروز برای {name}؟", short: "بهترین بخش نوروز؟", options: ["دید و بازدید", "پیک‌نیک سیزده‌به‌در", "سفره هفت‌سین", "تعطیلی کار"] },
    ],
  },
  {
    theme: "زندگی در خانه",
    questions: [
      { you: "جای محبوب شما در خانه؟", them: "جای محبوب {name} در خانه؟", short: "جای محبوب خانه؟", options: ["مبل", "تخت", "آشپزخانه", "بالکن"] },
      { you: "کار خانه‌ای که پنهانی بدتان نمی‌آید؟", them: "کار خانه‌ای که {name} پنهانی بدش نمی‌آید؟", short: "کار خانه دلخواه؟", options: ["ظرف شستن", "لباس شستن", "خرید خانه", "جارو کشیدن"] },
      { you: "دمای دلخواه خانه؟", them: "دمای دلخواه {name} در خانه؟", short: "دمای خانه؟", options: ["گرم و دنج", "خنک", "همیشه پنجره باز", "هرچه تو بخواهی"] },
    ],
  },
  {
    theme: "اولین‌ها",
    questions: [
      { you: "اولین چیزی که در من دیدید؟", them: "اولین چیزی که {name} در شما دید؟", short: "اولین چیزی که دید؟", options: ["لبخندت", "چشم‌هایت", "شوخ‌طبعی‌ات", "صدایت"] },
      { you: "بهترین بخش اولین قرارمان؟", them: "بهترین بخش اولین قرار از نظر {name}؟", short: "اولین قرار؟", options: ["گفت‌وگو", "مکان", "استرسش", "خداحافظی"] },
      { you: "کی فهمیدید جدی است؟", them: "{name} کی فهمید جدی است؟", short: "کی فهمید جدی است؟", options: ["همان اول", "بعد از چند هفته", "بعد از چند ماه", "هنوز دارم فکر می‌کنم"] },
    ],
  },
  {
    theme: "بازی و سرگرمی",
    questions: [
      { you: "در بازی چقدر رقابتی هستید؟", them: "{name} در بازی چقدر رقابتی است؟", short: "رقابتی؟", options: ["بازی می‌کنم که ببرم", "فقط برای سرگرمی", "بد بازنده", "می‌گذارم تو ببری"] },
      { you: "در مافیا معمولاً…", them: "{name} در مافیا معمولاً…", short: "در مافیا؟", options: ["اولین مظنون است", "کارآگاه است", "شهروند ساکت است", "بهترین دروغگوست"] },
      { you: "یک ساعت وقت آزاد را چطور می‌گذرانید؟", them: "{name} یک ساعت وقت آزاد را چطور می‌گذراند؟", short: "یک ساعت آزاد؟", options: ["پازل و بازی", "شبکه‌های اجتماعی", "پیاده‌روی", "چرت"] },
    ],
  },
];

export function questionSet(setId: number, language: "en" | "fa"): CoupleSet {
  const sets = language === "fa" ? FA : EN;
  return sets[((setId % sets.length) + sets.length) % sets.length];
}

export const fillName = (text: string, name: string) => text.replace("{name}", name);
