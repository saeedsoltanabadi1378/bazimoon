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
      { you: "Your travel style?", them: "{name}'s travel style?", short: "Travel style?", options: ["Every hour planned", "A rough plan", "Totally spontaneous", "Follow the other one's plan"] },
      { you: "What do you always pack too much of?", them: "What does {name} always pack too much of?", short: "Always overpacks?", options: ["Clothes", "Snacks", "Chargers and gadgets", "Books"] },
    ],
  },
  {
    theme: "Music and movies",
    questions: [
      { you: "Your movie-night pick?", them: "{name}'s movie-night pick?", short: "Movie-night pick?", options: ["Comedy", "Thriller or horror", "Romance", "Documentary"] },
      { you: "What do you sing along to in the car?", them: "What does {name} sing along to in the car?", short: "Car sing-along?", options: ["Persian pop", "Old classics", "Whatever is on the radio", "No singing, ever"] },
      { you: "How do you watch a series?", them: "How does {name} watch a series?", short: "Watching a series?", options: ["Binge it in a weekend", "One episode a night", "Start many, finish few", "Only together"] },
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
      { you: "How do you feel about cooking?", them: "How does {name} feel about cooking?", short: "Cooking?", options: ["Love it", "Only on weekends", "Rather do the dishes", "That's what delivery apps are for"] },
      { you: "Your favourite dessert?", them: "{name}'s favourite dessert?", short: "Favourite dessert?", options: ["Bastani sonnati", "Chocolate cake", "Fresh fruit", "Shole zard"] },
      { you: "Breakfast of choice?", them: "{name}'s breakfast of choice?", short: "Breakfast?", options: ["Bread, cheese and walnuts", "Eggs", "Just tea", "Skip it"] },
    ],
  },
  {
    theme: "Love languages",
    questions: [
      { you: "What makes you feel most loved?", them: "What makes {name} feel most loved?", short: "Feels most loved by?", options: ["Kind words", "Time together", "Little gifts", "Help with chores"] },
      { you: "Your ideal date night?", them: "{name}'s ideal date night?", short: "Ideal date night?", options: ["Dinner out", "A movie at home", "A walk somewhere new", "Trying a new activity"] },
      { you: "How do you say sorry?", them: "How does {name} say sorry?", short: "Saying sorry?", options: ["Straight away", "After a little time to cool off", "Show it, not say it", "Make a joke to break the ice"] },
    ],
  },
  {
    theme: "Money and plans",
    questions: [
      { you: "You get an unexpected bonus. What happens?", them: "{name} gets an unexpected bonus. What happens?", short: "Unexpected bonus?", options: ["Save it", "Treat us both", "Travel", "A long-wanted treat"] },
      { you: "Where would you love to live one day?", them: "Where would {name} love to live one day?", short: "Live one day?", options: ["Right here", "By the sea", "A big city abroad", "A quiet village"] },
      { you: "Your shopping style?", them: "{name}'s shopping style?", short: "Shopping style?", options: ["Plan and compare", "Buy on impulse", "Avoid it if I can", "Hunt for bargains"] },
    ],
  },
  {
    theme: "Friends and family",
    questions: [
      { you: "At a party, where do people find you?", them: "At a party, where do people find {name}?", short: "At a party?", options: ["On the dance floor", "In the kitchen, chatting", "Looking after everyone", "By the door, ready to leave"] },
      { you: "How often do you call your family?", them: "How often does {name} call their family?", short: "Calls family?", options: ["Every day", "A few times a week", "Once a week", "Only when they call"] },
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
      { you: "Thermostat setting?", them: "{name}'s thermostat setting?", short: "Thermostat?", options: ["Warm and cosy", "Cool", "Window always open", "Doesn't mind"] },
    ],
  },
  {
    theme: "Firsts",
    questions: [
      { you: "What did you notice first about me?", them: "What did {name} notice first about you?", short: "Noticed first?", options: ["The smile", "The eyes", "The sense of humour", "The voice"] },
      { you: "Best part of our first date?", them: "{name}'s favourite part of your first date?", short: "First date highlight?", options: ["The conversation", "The place", "The nerves", "Saying goodbye"] },
      { you: "When did you know it was serious?", them: "When did {name} know it was serious?", short: "Knew it was serious?", options: ["Right away", "After a few weeks", "After a few months", "Still deciding"] },
    ],
  },
  {
    theme: "Games and fun",
    questions: [
      { you: "How competitive are you in games?", them: "How competitive is {name} in games?", short: "Competitive?", options: ["In it to win it", "Just for fun", "Sore loser", "Happy to let the other win"] },
      { you: "In Mafia, who are you usually?", them: "In Mafia, who is {name} usually?", short: "In Mafia?", options: ["The first suspect", "The detective", "A quiet villager", "The best liar"] },
      { you: "Your favourite way to spend a free hour?", them: "{name}'s favourite way to spend a free hour?", short: "Free hour?", options: ["Puzzles and games", "Social media", "A walk", "A nap"] },
    ],
  },
];

// Persian uses the informal "تو", like the rest of the app. Options are short phrases that read
// right both when answering about yourself and when guessing for your partner.
const FA: CoupleSet[] = [
  {
    theme: "آخر هفته، غذا و عادت‌های کوچک",
    questions: [
      { you: "جمعه ایده‌آلت چه شکلی است؟", them: "جمعه ایده‌آل {name} چه شکلی است؟", short: "جمعه ایده‌آل", options: ["صبحی آرام در خانه", "بیرون با دوستان", "سفر به بیرون شهر", "پختن یک غذای تازه"] },
      { you: "غذای حال‌خوب‌کنت چیست؟", them: "غذای حال‌خوب‌کن {name} چیست؟", short: "غذای حال‌خوب‌کن", options: ["قورمه‌سبزی", "پیتزا", "یک چیز شیرین", "هرچه آن یکی بپزد"] },
      { you: "یک روز پراسترس را چطور می‌گذرانی؟", them: "{name} یک روز پراسترس را چطور می‌گذراند؟", short: "روز پراسترس", options: ["درد دل کردن", "کمی تنهایی و سکوت", "یک پیاده‌روی طولانی", "سرگرم شدن با کار"] },
    ],
  },
  {
    theme: "خاطرات کودکی",
    questions: [
      { you: "بچه که بودی چطور بچه‌ای بودی؟", them: "{name} بچه که بود چطور بچه‌ای بود؟", short: "در کودکی", options: ["آرام و خجالتی", "شیطان و دردسرساز", "دلقک کلاس", "غرق در کتاب‌ها"] },
      { you: "بازی محبوب بچگی‌ات چه بود؟", them: "بازی محبوب بچگی {name} چه بود؟", short: "بازی بچگی", options: ["فوتبال در کوچه", "قایم‌موشک", "بازی کامپیوتری", "بازی‌های فکری با خانواده"] },
      { you: "بچه که بودی می‌خواستی چه‌کاره شوی؟", them: "{name} بچه که بود می‌خواست چه‌کاره شود؟", short: "آرزوی شغلی بچگی", options: ["دکتر", "فضانورد یا خلبان", "هنرمند یا نوازنده", "معلم"] },
    ],
  },
  {
    theme: "رؤیای سفر",
    questions: [
      { you: "سفر رؤیایی‌ات چه شکلی است؟", them: "سفر رؤیایی {name} چه شکلی است؟", short: "سفر رؤیایی", options: ["ساحل و آفتاب", "کوه و کوهنوردی", "یک شهر بزرگ و تازه", "جاده‌گردی بی‌برنامه"] },
      { you: "در سفر چه سبکی داری؟", them: "{name} در سفر چه سبکی دارد؟", short: "سبک سفر", options: ["برنامه ساعت‌به‌ساعت", "یک برنامه کلی", "کاملاً بی‌برنامه", "هرچه آن یکی برنامه بریزد"] },
      { you: "همیشه از چه چیزی بیش از اندازه با خودت می‌بری؟", them: "{name} همیشه از چه چیزی بیش از اندازه با خودش می‌برد؟", short: "همیشه زیادی برمی‌دارد", options: ["لباس", "خوراکی", "شارژر و وسایل برقی", "کتاب"] },
    ],
  },
  {
    theme: "موسیقی و فیلم",
    questions: [
      { you: "برای شب فیلم چه ژانری انتخاب می‌کنی؟", them: "{name} برای شب فیلم چه ژانری انتخاب می‌کند؟", short: "ژانر شب فیلم", options: ["کمدی", "هیجانی یا ترسناک", "عاشقانه", "مستند"] },
      { you: "در ماشین با چه آهنگ‌هایی هم‌خوانی می‌کنی؟", them: "{name} در ماشین با چه آهنگ‌هایی هم‌خوانی می‌کند؟", short: "هم‌خوانی در ماشین", options: ["پاپ فارسی", "آهنگ‌های قدیمی", "هرچه رادیو پخش کند", "هیچ‌کدام؛ آواز ممنوع!"] },
      { you: "سریال را چطور می‌بینی؟", them: "{name} سریال را چطور می‌بیند؟", short: "سریال دیدن", options: ["یک‌نفس در یک آخر هفته", "هر شب یک قسمت", "شروع زیاد، تمام کردن کم", "فقط با هم"] },
    ],
  },
  {
    theme: "عادت‌های کوچک",
    questions: [
      { you: "اولین کارت صبح‌ها چیست؟", them: "اولین کار {name} صبح‌ها چیست؟", short: "اول صبح", options: ["سر زدن به گوشی", "چای یا قهوه", "یک چرت دیگر", "دوش گرفتن"] },
      { you: "راستش را بگو، چقدر مرتبی؟", them: "راستش را بگو، {name} چقدر مرتب است؟", short: "چقدر مرتب", options: ["مثل دسته گل", "به اندازه کافی", "شلوغیِ حساب‌شده", "لطفاً نگاه نکن!"] },
      { you: "کِی بیشترین بازدهی را داری؟", them: "{name} کِی بیشترین بازدهی را دارد؟", short: "پربازده‌ترین ساعت", options: ["صبح زود", "اواخر صبح", "بعدازظهر", "نیمه‌شب"] },
    ],
  },
  {
    theme: "غذا و آشپزی",
    questions: [
      { you: "نظرت درباره آشپزی چیست؟", them: "نظر {name} درباره آشپزی چیست؟", short: "آشپزی", options: ["عاشق آشپزی", "فقط آخر هفته‌ها", "ظرف شستن به‌جای آشپزی", "اپ سفارش غذا برای همین است"] },
      { you: "دسر محبوبت چیست؟", them: "دسر محبوب {name} چیست؟", short: "دسر محبوب", options: ["بستنی سنتی", "کیک شکلاتی", "میوه تازه", "شله‌زرد"] },
      { you: "صبحانه دلخواهت چیست؟", them: "صبحانه دلخواه {name} چیست؟", short: "صبحانه", options: ["نان و پنیر و گردو", "تخم‌مرغ", "فقط یک چای", "بی‌صبحانه"] },
    ],
  },
  {
    theme: "زبان عشق",
    questions: [
      { you: "چه چیزی بیشتر از همه به تو حس دوست‌داشته‌شدن می‌دهد؟", them: "چه چیزی بیشتر از همه به {name} حس دوست‌داشته‌شدن می‌دهد؟", short: "حس دوست‌داشته‌شدن", options: ["حرف‌های محبت‌آمیز", "وقت گذراندن با هم", "هدیه‌های کوچک", "کمک در کارها"] },
      { you: "قرار عاشقانه ایده‌آلت چیست؟", them: "قرار عاشقانه ایده‌آل {name} چیست؟", short: "قرار ایده‌آل", options: ["شام بیرون", "فیلم دیدن در خانه", "قدم زدن در یک جای تازه", "امتحان یک تجربه جدید"] },
      { you: "چطور عذرخواهی می‌کنی؟", them: "{name} چطور عذرخواهی می‌کند؟", short: "عذرخواهی", options: ["همان لحظه", "بعد از کمی آرام شدن", "با رفتار، نه با حرف", "با یک شوخی برای شکستن یخ"] },
    ],
  },
  {
    theme: "پول و برنامه‌ها",
    questions: [
      { you: "یک پاداش غیرمنتظره می‌گیری. با آن چه می‌کنی؟", them: "{name} یک پاداش غیرمنتظره می‌گیرد. با آن چه می‌کند؟", short: "پاداش غیرمنتظره", options: ["پس‌انداز", "مهمان کردن هر دو نفر", "سفر", "خرید یک آرزوی قدیمی"] },
      { you: "دوست داری روزی کجا زندگی کنی؟", them: "{name} دوست دارد روزی کجا زندگی کند؟", short: "خانه رؤیایی", options: ["همین‌جا", "کنار دریا", "یک شهر بزرگ در خارج", "یک روستای آرام"] },
      { you: "سبک خریدت چطور است؟", them: "سبک خرید {name} چطور است؟", short: "سبک خرید", options: ["با برنامه و مقایسه", "هیجانی و یهویی", "تا جای ممکن فرار از خرید", "شکار تخفیف"] },
    ],
  },
  {
    theme: "دوستان و خانواده",
    questions: [
      { you: "در مهمانی معمولاً کجا پیدایت می‌کنند؟", them: "در مهمانی معمولاً {name} را کجا پیدا می‌کنند؟", short: "در مهمانی", options: ["وسط پیست رقص", "در آشپزخانه، گرم گفت‌وگو", "در حال پذیرایی از همه", "دم در، آماده رفتن"] },
      { you: "چقدر به خانواده‌ات زنگ می‌زنی؟", them: "{name} چقدر به خانواده‌اش زنگ می‌زند؟", short: "تماس با خانواده", options: ["هر روز", "چند بار در هفته", "هفته‌ای یک بار", "فقط وقتی آن‌ها زنگ بزنند"] },
      { you: "در جمع دوستانت چه نقشی داری؟", them: "{name} در جمع دوستانش چه نقشی دارد؟", short: "نقش در جمع دوستان", options: ["برنامه‌ریز", "شوخ‌طبع جمع", "سنگ صبور", "همیشه دیر می‌رسد"] },
    ],
  },
  {
    theme: "چیزهایی که کلافه‌مان می‌کند",
    questions: [
      { you: "چه چیزی بیشتر از همه کلافه‌ات می‌کند؟", them: "چه چیزی بیشتر از همه {name} را کلافه می‌کند؟", short: "کلافه‌کننده‌ترین چیز", options: ["صدای ملچ‌ملوچ", "دیر کردن", "اتاق به‌هم‌ریخته", "آهسته راه رفتن بقیه"] },
      { you: "وقتی گرسنه‌ای چه شکلی می‌شوی؟", them: "{name} وقتی گرسنه است چه شکلی می‌شود؟", short: "وقت گرسنگی", options: ["بداخلاق", "ساکت", "در به‌در دنبال خوراکی", "کاملاً عادی"] },
      { you: "معمولاً چند اعلان خوانده‌نشده داری؟", them: "{name} معمولاً چند اعلان خوانده‌نشده دارد؟", short: "اعلان‌های خوانده‌نشده", options: ["همیشه صفر", "چندتایی", "چند ده تا", "صدها؛ نپرس!"] },
    ],
  },
  {
    theme: "رؤیاها و هدف‌ها",
    questions: [
      { you: "دوست داری چه مهارتی یاد بگیری؟", them: "{name} دوست دارد چه مهارتی یاد بگیرد؟", short: "مهارت تازه", options: ["یک زبان جدید", "نواختن یک ساز", "آشپزی حرفه‌ای", "یک ورزش"] },
      { you: "پنج سال دیگر ما را کجا می‌بینی؟", them: "{name} پنج سال دیگر شما دو نفر را کجا می‌بیند؟", short: "پنج سال دیگر", options: ["همین‌جا، شادتر", "در یک شهر تازه", "با خانواده‌ای بزرگ‌تر", "در حال سفر دور دنیا"] },
      { you: "بزرگ‌ترین انگیزه‌ات چیست؟", them: "بزرگ‌ترین انگیزه {name} چیست؟", short: "بزرگ‌ترین انگیزه", options: ["خانواده", "موفقیت کاری", "آزادی", "شاد کردن دیگران"] },
    ],
  },
  {
    theme: "فصل‌ها و هوا",
    questions: [
      { you: "فصل محبوبت کدام است؟", them: "فصل محبوب {name} کدام است؟", short: "فصل محبوب", options: ["بهار", "تابستان", "پاییز", "زمستان"] },
      { you: "برنامه ایده‌آلت برای یک روز بارانی چیست؟", them: "برنامه ایده‌آل {name} برای یک روز بارانی چیست؟", short: "روز بارانی", options: ["چای و کتاب", "قدم زدن زیر باران", "فیلم زیر پتو", "یک چرت حسابی"] },
      { you: "بهترین بخش نوروز برایت چیست؟", them: "بهترین بخش نوروز برای {name} چیست؟", short: "بهترین بخش نوروز", options: ["دید و بازدید", "سیزده‌به‌در", "چیدن سفره هفت‌سین", "تعطیلات"] },
    ],
  },
  {
    theme: "زندگی در خانه",
    questions: [
      { you: "جای محبوبت در خانه کجاست؟", them: "جای محبوب {name} در خانه کجاست؟", short: "جای محبوب خانه", options: ["مبل", "تخت", "آشپزخانه", "بالکن"] },
      { you: "کدام کار خانه را در خفا دوست داری؟", them: "{name} کدام کار خانه را در خفا دوست دارد؟", short: "کار خانه محبوب", options: ["ظرف شستن", "لباس شستن", "خرید خانه", "جارو کشیدن"] },
      { you: "دمای خانه را چطور دوست داری؟", them: "{name} دمای خانه را چطور دوست دارد؟", short: "دمای خانه", options: ["گرم و دنج", "خنک", "پنجره همیشه باز", "فرقی نمی‌کند"] },
    ],
  },
  {
    theme: "اولین‌ها",
    questions: [
      { you: "اولین چیزی که در من به چشمت آمد چه بود؟", them: "اولین چیزی که در تو به چشم {name} آمد چه بود؟", short: "اولین چیزی که به چشم آمد", options: ["لبخند", "چشم‌ها", "شوخ‌طبعی", "صدا"] },
      { you: "بهترین بخش اولین قرارمان چه بود؟", them: "بهترین بخش اولین قرارتان از نظر {name} چه بود؟", short: "اولین قرار", options: ["حرف‌هایمان", "جایش", "دلشوره‌اش", "لحظه خداحافظی"] },
      { you: "کِی فهمیدی این رابطه جدی است؟", them: "{name} کِی فهمید این رابطه جدی است؟", short: "کِی جدی شد", options: ["همان اول", "بعد از چند هفته", "بعد از چند ماه", "هنوز در حال فکر کردن!"] },
    ],
  },
  {
    theme: "بازی و سرگرمی",
    questions: [
      { you: "در بازی چقدر اهل رقابتی؟", them: "{name} در بازی چقدر اهل رقابت است؟", short: "روحیه رقابت", options: ["فقط برای بردن", "فقط برای سرگرمی", "بازنده بدقلق", "باختن عمدی به‌خاطر آن یکی"] },
      { you: "در مافیا معمولاً چه نقشی داری؟", them: "{name} در مافیا معمولاً چه نقشی دارد؟", short: "در مافیا", options: ["اولین مظنون", "کارآگاه", "شهروند ساکت", "بهترین دروغگو"] },
      { you: "یک ساعت وقت آزاد را چطور می‌گذرانی؟", them: "{name} یک ساعت وقت آزاد را چطور می‌گذراند؟", short: "یک ساعت آزاد", options: ["پازل و بازی", "شبکه‌های اجتماعی", "پیاده‌روی", "چرت زدن"] },
    ],
  },
];

export function questionSet(setId: number, language: "en" | "fa"): CoupleSet {
  const sets = language === "fa" ? FA : EN;
  return sets[((setId % sets.length) + sets.length) % sets.length];
}

export const fillName = (text: string, name: string) => text.replace("{name}", name);
