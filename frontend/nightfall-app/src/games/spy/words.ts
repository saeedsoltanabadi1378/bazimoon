// Secret words for Spy, each as [English, Persian]. Every player but the spy sees the word.
export type SpyPack = "places" | "food" | "jobs" | "mixed";

export const spyWords: Record<Exclude<SpyPack, "mixed">, [string, string][]> = {
  places: [
    ["Airport", "فرودگاه"], ["Hospital", "بیمارستان"], ["School", "مدرسه"], ["Bazaar", "بازار"], ["Beach", "ساحل"],
    ["Cinema", "سینما"], ["Restaurant", "رستوران"], ["Bank", "بانک"], ["Mosque", "مسجد"], ["Football stadium", "ورزشگاه فوتبال"],
    ["Police station", "کلانتری"], ["Train", "قطار"], ["Hotel", "هتل"], ["Zoo", "باغ‌وحش"], ["Library", "کتابخانه"],
    ["Hair salon", "آرایشگاه"], ["Wedding party", "عروسی"], ["Bakery", "نانوایی"], ["Gym", "باشگاه بدنسازی"], ["Ski resort", "پیست اسکی"],
    ["Submarine", "زیردریایی"], ["Space station", "ایستگاه فضایی"], ["Museum", "موزه"], ["Bathhouse", "حمام عمومی"], ["Taxi", "تاکسی"],
    ["University", "دانشگاه"], ["Pharmacy", "داروخانه"], ["Park", "پارک"], ["Desert camp", "کمپ کویر"], ["Pirate ship", "کشتی دزدان دریایی"],
  ],
  food: [
    ["Ghormeh sabzi", "قورمه‌سبزی"], ["Kebab", "کباب"], ["Pizza", "پیتزا"], ["Ash reshteh", "آش رشته"], ["Tahdig", "ته‌دیگ"],
    ["Fesenjan", "فسنجان"], ["Burger", "همبرگر"], ["Sushi", "سوشی"], ["Dizi", "دیزی"], ["Ice cream", "بستنی"],
    ["Falafel", "فلافل"], ["Omelette", "املت"], ["Halim", "حلیم"], ["Pasta", "ماکارونی"], ["Watermelon", "هندوانه"],
    ["Sholeh zard", "شله‌زرد"], ["Popcorn", "پاپ‌کورن"], ["Chocolate cake", "کیک شکلاتی"], ["Kuku sabzi", "کوکو سبزی"], ["Salad olivieh", "سالاد الویه"],
    ["Fried chicken", "مرغ سوخاری"], ["Baghali polo", "باقالی‌پلو"], ["Pomegranate", "انار"], ["Faloodeh", "فالوده"], ["Tea", "چای"],
  ],
  jobs: [
    ["Doctor", "پزشک"], ["Teacher", "معلم"], ["Pilot", "خلبان"], ["Chef", "آشپز"], ["Police officer", "پلیس"],
    ["Firefighter", "آتش‌نشان"], ["Dentist", "دندان‌پزشک"], ["Farmer", "کشاورز"], ["Actor", "بازیگر"], ["Footballer", "فوتبالیست"],
    ["Programmer", "برنامه‌نویس"], ["Barber", "آرایشگر"], ["Taxi driver", "راننده تاکسی"], ["Lawyer", "وکیل"], ["Journalist", "خبرنگار"],
    ["Tailor", "خیاط"], ["Photographer", "عکاس"], ["Astronaut", "فضانورد"], ["Mechanic", "مکانیک"], ["Singer", "خواننده"],
    ["Nurse", "پرستار"], ["Architect", "معمار"], ["Baker", "نانوا"], ["Judge", "قاضی"], ["Magician", "شعبده‌باز"],
  ],
};

export function packWords(pack: SpyPack): [string, string][] {
  if (pack === "mixed") return [...spyWords.places, ...spyWords.food, ...spyWords.jobs];
  return spyWords[pack];
}
