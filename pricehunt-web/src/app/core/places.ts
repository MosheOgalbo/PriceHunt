import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { Lang } from './i18n/language';

/** Real seaports and gateway cities. The English name is what the API stores. */
export interface Place {
  locode: string;
  country: string;
  city: Record<Lang, string>;
}

const COUNTRIES: Record<string, Record<Lang, string>> = {
  IL: { en: 'Israel', he: 'ישראל', ru: 'Израиль', ar: 'إسرائيل' },
  NL: { en: 'Netherlands', he: 'הולנד', ru: 'Нидерланды', ar: 'هولندا' },
  DE: { en: 'Germany', he: 'גרמניה', ru: 'Германия', ar: 'ألمانيا' },
  BE: { en: 'Belgium', he: 'בלגיה', ru: 'Бельгия', ar: 'بلجيكا' },
  GB: { en: 'United Kingdom', he: 'בריטניה', ru: 'Великобритания', ar: 'المملكة المتحدة' },
  FR: { en: 'France', he: 'צרפת', ru: 'Франция', ar: 'فرنسا' },
  ES: { en: 'Spain', he: 'ספרד', ru: 'Испания', ar: 'إسبانيا' },
  IT: { en: 'Italy', he: 'איטליה', ru: 'Италия', ar: 'إيطاليا' },
  GR: { en: 'Greece', he: 'יוון', ru: 'Греция', ar: 'اليونان' },
  TR: { en: 'Turkey', he: 'טורקיה', ru: 'Турция', ar: 'تركيا' },
  PL: { en: 'Poland', he: 'פולין', ru: 'Польша', ar: 'بولندا' },
  SE: { en: 'Sweden', he: 'שוודיה', ru: 'Швеция', ar: 'السويد' },
  DK: { en: 'Denmark', he: 'דנמרק', ru: 'Дания', ar: 'الدنمارك' },
  NO: { en: 'Norway', he: 'נורווגיה', ru: 'Норвегия', ar: 'النرويج' },
  FI: { en: 'Finland', he: 'פינלנד', ru: 'Финляндия', ar: 'فنلندا' },
  RU: { en: 'Russia', he: 'רוסיה', ru: 'Россия', ar: 'روسيا' },
  UA: { en: 'Ukraine', he: 'אוקראינה', ru: 'Украина', ar: 'أوكرانيا' },
  RO: { en: 'Romania', he: 'רומניה', ru: 'Румыния', ar: 'رومانيا' },
  SI: { en: 'Slovenia', he: 'סלובניה', ru: 'Словения', ar: 'سلوفينيا' },
  EG: { en: 'Egypt', he: 'מצרים', ru: 'Египет', ar: 'مصر' },
  LB: { en: 'Lebanon', he: 'לבנון', ru: 'Ливан', ar: 'لبنان' },
  CY: { en: 'Cyprus', he: 'קפריסין', ru: 'Кипр', ar: 'قبرص' },
  JO: { en: 'Jordan', he: 'ירדן', ru: 'Иордания', ar: 'الأردن' },
  SA: { en: 'Saudi Arabia', he: 'ערב הסעודית', ru: 'Саудовская Аравия', ar: 'السعودية' },
  AE: { en: 'United Arab Emirates', he: 'איחוד האמירויות', ru: 'ОАЭ', ar: 'الإمارات' },
  OM: { en: 'Oman', he: 'עומאן', ru: 'Оман', ar: 'عُمان' },
  QA: { en: 'Qatar', he: 'קטאר', ru: 'Катар', ar: 'قطر' },
  KW: { en: 'Kuwait', he: 'כווית', ru: 'Кувейт', ar: 'الكويت' },
  IN: { en: 'India', he: 'הודו', ru: 'Индия', ar: 'الهند' },
  LK: { en: 'Sri Lanka', he: 'סרי לנקה', ru: 'Шри-Ланка', ar: 'سريلانكا' },
  SG: { en: 'Singapore', he: 'סינגפור', ru: 'Сингапур', ar: 'سنغافورة' },
  MY: { en: 'Malaysia', he: 'מלזיה', ru: 'Малайзия', ar: 'ماليزيا' },
  ID: { en: 'Indonesia', he: 'אינדונזיה', ru: 'Индонезия', ar: 'إندونيسيا' },
  TH: { en: 'Thailand', he: 'תאילנד', ru: 'Таиланд', ar: 'تايلاند' },
  VN: { en: 'Vietnam', he: 'וייטנאם', ru: 'Вьетнам', ar: 'فيتنام' },
  PH: { en: 'Philippines', he: 'הפיליפינים', ru: 'Филиппины', ar: 'الفلبين' },
  CN: { en: 'China', he: 'סין', ru: 'Китай', ar: 'الصين' },
  HK: { en: 'Hong Kong', he: 'הונג קונג', ru: 'Гонконг', ar: 'هونغ كونغ' },
  JP: { en: 'Japan', he: 'יפן', ru: 'Япония', ar: 'اليابان' },
  KR: { en: 'South Korea', he: 'דרום קוריאה', ru: 'Южная Корея', ar: 'كوريا الجنوبية' },
  TW: { en: 'Taiwan', he: 'טייוואן', ru: 'Тайвань', ar: 'تايوان' },
  AU: { en: 'Australia', he: 'אוסטרליה', ru: 'Австралия', ar: 'أستراليا' },
  NZ: { en: 'New Zealand', he: 'ניו זילנד', ru: 'Новая Зеландия', ar: 'نيوزيلندا' },
  ZA: { en: 'South Africa', he: 'דרום אפריקה', ru: 'ЮАР', ar: 'جنوب أفريقيا' },
  NG: { en: 'Nigeria', he: 'ניגריה', ru: 'Нигерия', ar: 'نيجيريا' },
  MA: { en: 'Morocco', he: 'מרוקו', ru: 'Марокко', ar: 'المغرب' },
  BR: { en: 'Brazil', he: 'ברזיל', ru: 'Бразилия', ar: 'البرازيل' },
  AR: { en: 'Argentina', he: 'ארגנטינה', ru: 'Аргентина', ar: 'الأرجنتين' },
  CL: { en: 'Chile', he: 'צ׳ילה', ru: 'Чили', ar: 'تشيلي' },
  PE: { en: 'Peru', he: 'פרו', ru: 'Перу', ar: 'بيرو' },
  US: { en: 'United States', he: 'ארצות הברית', ru: 'США', ar: 'الولايات المتحدة' },
  CA: { en: 'Canada', he: 'קנדה', ru: 'Канада', ar: 'كندا' },
  MX: { en: 'Mexico', he: 'מקסיקו', ru: 'Мексика', ar: 'المكسيك' },
  PA: { en: 'Panama', he: 'פנמה', ru: 'Панама', ar: 'بنما' },
  CO: { en: 'Colombia', he: 'קולומביה', ru: 'Колумбия', ar: 'كولومبيا' },
};

function place(locode: string, country: string, en: string, he: string, ru: string, ar: string): Place {
  return { locode, country, city: { en, he, ru, ar } };
}

export const PLACES: Place[] = [
  place('ILHFA', 'IL', 'Haifa', 'חיפה', 'Хайфа', 'حيفا'),
  place('ILASH', 'IL', 'Ashdod', 'אשדוד', 'Ашдод', 'أشدود'),
  place('ILTLV', 'IL', 'Tel Aviv', 'תל אביב', 'Тель-Авив', 'تل أبيب'),
  place('ILETH', 'IL', 'Eilat', 'אילת', 'Эйлат', 'إيلات'),
  place('NLRTM', 'NL', 'Rotterdam', 'רוטרדם', 'Роттердам', 'روتردام'),
  place('NLAMS', 'NL', 'Amsterdam', 'אמסטרדם', 'Амстердам', 'أمستردام'),
  place('DEHAM', 'DE', 'Hamburg', 'המבורג', 'Гамбург', 'هامبورغ'),
  place('DEBRV', 'DE', 'Bremerhaven', 'ברמרהאפן', 'Бремерхафен', 'بريمرهافن'),
  place('BEANR', 'BE', 'Antwerp', 'אנטוורפן', 'Антверпен', 'أنتويرب'),
  place('GBFXT', 'GB', 'Felixstowe', 'פליקסטו', 'Феликстоу', 'فيليكستو'),
  place('GBSOU', 'GB', 'Southampton', 'סאות׳המפטון', 'Саутгемптон', 'ساوثهامبتون'),
  place('GBLON', 'GB', 'London', 'לונדון', 'Лондон', 'لندن'),
  place('FRLEH', 'FR', 'Le Havre', 'לה האבר', 'Гавр', 'لو هافر'),
  place('FRMRS', 'FR', 'Marseille', 'מרסיי', 'Марсель', 'مرسيليا'),
  place('ESBCN', 'ES', 'Barcelona', 'ברצלונה', 'Барселона', 'برشلونة'),
  place('ESVLC', 'ES', 'Valencia', 'ולנסיה', 'Валенсия', 'فالنسيا'),
  place('ESALG', 'ES', 'Algeciras', 'אלחסיראס', 'Альхесирас', 'الجزيرة الخضراء'),
  place('ITGOA', 'IT', 'Genoa', 'ג׳נובה', 'Генуя', 'جنوة'),
  place('ITTRS', 'IT', 'Trieste', 'טריאסטה', 'Триест', 'ترييستي'),
  place('GRPIR', 'GR', 'Piraeus', 'פיראוס', 'Пирей', 'بيرايوس'),
  place('TRIST', 'TR', 'Istanbul', 'איסטנבול', 'Стамбул', 'إسطنبول'),
  place('TRMER', 'TR', 'Mersin', 'מרסין', 'Мерсин', 'مرسين'),
  place('PLGDN', 'PL', 'Gdansk', 'גדנסק', 'Гданьск', 'غدانسك'),
  place('SEGOT', 'SE', 'Gothenburg', 'גטבורג', 'Гётеборг', 'غوتنبرغ'),
  place('DKAAR', 'DK', 'Aarhus', 'אורהוס', 'Орхус', 'آرهوس'),
  place('NOOSL', 'NO', 'Oslo', 'אוסלו', 'Осло', 'أوسلو'),
  place('FIHEL', 'FI', 'Helsinki', 'הלסינקי', 'Хельсинки', 'هلسنكي'),
  place('RULED', 'RU', 'Saint Petersburg', 'סנקט פטרבורג', 'Санкт-Петербург', 'سانت بطرسبرغ'),
  place('RUNVS', 'RU', 'Novorossiysk', 'נובורוסיסק', 'Новороссийск', 'نوفوروسيسك'),
  place('UAODS', 'UA', 'Odesa', 'אודסה', 'Одесса', 'أوديسا'),
  place('ROCND', 'RO', 'Constanta', 'קונסטנצה', 'Констанца', 'كونستانتسا'),
  place('SIKOP', 'SI', 'Koper', 'קופר', 'Копер', 'كوبر'),
  place('EGALY', 'EG', 'Alexandria', 'אלכסנדריה', 'Александрия', 'الإسكندرية'),
  place('EGPSD', 'EG', 'Port Said', 'פורט סעיד', 'Порт-Саид', 'بورسعيد'),
  place('LBBEY', 'LB', 'Beirut', 'ביירות', 'Бейрут', 'بيروت'),
  place('CYLMS', 'CY', 'Limassol', 'לימסול', 'Лимасол', 'ليماسول'),
  place('JOAQJ', 'JO', 'Aqaba', 'עקבה', 'Акаба', 'العقبة'),
  place('SAJED', 'SA', 'Jeddah', 'ג׳דה', 'Джидда', 'جدة'),
  place('SADMM', 'SA', 'Dammam', 'דמאם', 'Даммам', 'الدمام'),
  place('AEJEA', 'AE', 'Jebel Ali', 'ג׳בל עלי', 'Джебель-Али', 'جبل علي'),
  place('AEAUH', 'AE', 'Abu Dhabi', 'אבו דאבי', 'Абу-Даби', 'أبوظبي'),
  place('OMSLL', 'OM', 'Salalah', 'סלאלה', 'Салала', 'صلالة'),
  place('QAHMD', 'QA', 'Hamad', 'חמד', 'Хамад', 'حمد'),
  place('KWKWI', 'KW', 'Kuwait', 'כווית', 'Кувейт', 'الكويت'),
  place('INNSA', 'IN', 'Nhava Sheva', 'נהאבה שבא', 'Нхава-Шева', 'نهافا شيفا'),
  place('INMAA', 'IN', 'Chennai', 'צ׳נאי', 'Ченнаи', 'تشيناي'),
  place('LKCMB', 'LK', 'Colombo', 'קולומבו', 'Коломбо', 'كولومبو'),
  place('SGSIN', 'SG', 'Singapore', 'סינגפור', 'Сингапур', 'سنغافورة'),
  place('MYPKG', 'MY', 'Port Klang', 'פורט קלאנג', 'Порт-Кланг', 'بورت كلانغ'),
  place('IDJKT', 'ID', 'Jakarta', 'ג׳קרטה', 'Джакарта', 'جاكرتا'),
  place('THLCH', 'TH', 'Laem Chabang', 'לאם צ׳אבנג', 'Лаем-Чабанг', 'ليم تشابانغ'),
  place('VNSGN', 'VN', 'Ho Chi Minh City', 'הו צ׳י מין', 'Хошимин', 'هو تشي منه'),
  place('PHMNL', 'PH', 'Manila', 'מנילה', 'Манила', 'مانيلا'),
  place('CNSHA', 'CN', 'Shanghai', 'שאנגחאי', 'Шанхай', 'شنغهاي'),
  place('CNNGB', 'CN', 'Ningbo', 'נינגבו', 'Нинбо', 'نينغبو'),
  place('CNTAO', 'CN', 'Qingdao', 'צ׳ינגדאו', 'Циндао', 'تشينغداو'),
  place('CNYTN', 'CN', 'Yantian', 'יאנטיאן', 'Яньтянь', 'يانتين'),
  place('HKHKG', 'HK', 'Hong Kong', 'הונג קונג', 'Гонконг', 'هونغ كونغ'),
  place('JPYOK', 'JP', 'Yokohama', 'יוקוהמה', 'Иокогама', 'يوكوهاما'),
  place('KRPUS', 'KR', 'Busan', 'פוסאן', 'Пусан', 'بوسان'),
  place('TWKHH', 'TW', 'Kaohsiung', 'קאושיונג', 'Гаосюн', 'كاوهسيونغ'),
  place('AUSYD', 'AU', 'Sydney', 'סידני', 'Сидней', 'سيدني'),
  place('AUMEL', 'AU', 'Melbourne', 'מלבורן', 'Мельбурн', 'ملبورن'),
  place('NZAKL', 'NZ', 'Auckland', 'אוקלנד', 'Окленд', 'أوكلاند'),
  place('ZACPT', 'ZA', 'Cape Town', 'קייפטאון', 'Кейптаун', 'كيب تاون'),
  place('ZADUR', 'ZA', 'Durban', 'דרבן', 'Дурбан', 'ديربان'),
  place('NGLOS', 'NG', 'Lagos', 'לאגוס', 'Лагос', 'لاغوس'),
  place('MACAS', 'MA', 'Casablanca', 'קזבלנקה', 'Касабланка', 'الدار البيضاء'),
  place('MATNG', 'MA', 'Tangier', 'טנג׳יר', 'Танжер', 'طنجة'),
  place('BRSSZ', 'BR', 'Santos', 'סנטוס', 'Сантус', 'سانتوس'),
  place('BRRIO', 'BR', 'Rio de Janeiro', 'ריו דה ז׳ניירו', 'Рио-де-Жанейро', 'ريو دي جانيرو'),
  place('ARBUE', 'AR', 'Buenos Aires', 'בואנוס איירס', 'Буэнос-Айрес', 'بوينس آيرس'),
  place('CLVAP', 'CL', 'Valparaiso', 'ולפראיסו', 'Вальпараисо', 'فالبارايسو'),
  place('PECLL', 'PE', 'Callao', 'קאיאו', 'Кальяо', 'كاياو'),
  place('USNYC', 'US', 'New York', 'ניו יורק', 'Нью-Йорк', 'نيويورك'),
  place('USLAX', 'US', 'Los Angeles', 'לוס אנג׳לס', 'Лос-Анджелес', 'لوس أنجلوس'),
  place('USHOU', 'US', 'Houston', 'יוסטון', 'Хьюстон', 'هيوستن'),
  place('USSEA', 'US', 'Seattle', 'סיאטל', 'Сиэтл', 'سياتل'),
  place('USORF', 'US', 'Norfolk', 'נורפוק', 'Норфолк', 'نورفولك'),
  place('CAVAN', 'CA', 'Vancouver', 'ונקובר', 'Ванкувер', 'فانكوفر'),
  place('CAMTR', 'CA', 'Montreal', 'מונטריאול', 'Монреаль', 'مونتريال'),
  place('MXZLO', 'MX', 'Manzanillo', 'מנסניו', 'Мансанильо', 'مانزانيلو'),
  place('PABLB', 'PA', 'Balboa', 'בלבואה', 'Бальбоа', 'بالبوا'),
  place('COCTG', 'CO', 'Cartagena', 'קרטחנה', 'Картахена', 'قرطاجنة'),
];

export function countryName(code: string, lang: Lang): string {
  return COUNTRIES[code]?.[lang] ?? code;
}

export function findPlace(value: string | null | undefined): Place | undefined {
  const query = value?.trim().toLowerCase();
  if (!query) return undefined;
  return PLACES.find(place =>
    place.locode.toLowerCase() === query ||
    Object.values(place.city).some(name => name.toLowerCase() === query),
  );
}

/** Value stored on the search and in history: the English place name. */
export function canonicalPlace(value: string): string {
  return findPlace(value)?.city.en ?? value.trim();
}

/** Empty is left to Validators.required. Any other text must be a known place. */
export function knownPlaceValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = String(control.value ?? '').trim();
    if (!value) return null;
    return findPlace(value) ? null : { unknownPlace: true };
  };
}

/** Origin and destination cannot be the same place. */
export function differentPlaceValidator(fromKey = 'fromLocation'): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const from = String(control.parent?.get(fromKey)?.value ?? '').trim();
    const to = String(control.value ?? '').trim();
    if (!from || !to || !findPlace(from) || !findPlace(to)) return null;
    return canonicalPlace(from) === canonicalPlace(to) ? { samePlace: true } : null;
  };
}

export function placeLabel(stored: string, lang: Lang): string {
  return findPlace(stored)?.city[lang] ?? stored;
}

export function filterPlaces(query: string, lang: Lang): Place[] {
  const needle = query.trim().toLowerCase();
  const matches = needle
    ? PLACES.filter(place =>
        place.locode.toLowerCase().includes(needle) ||
        Object.values(place.city).some(name => name.toLowerCase().includes(needle)) ||
        Object.values(COUNTRIES[place.country] ?? {}).some(name => name.toLowerCase().includes(needle)),
      )
    : PLACES;
  return [...matches].sort((a, b) => a.city[lang].localeCompare(b.city[lang], lang));
}
