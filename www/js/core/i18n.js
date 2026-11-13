/**
 * Tiny two-language table (English / Arabic) for the canvas UI.
 *
 * Canvas has no DOM to translate, so every visible string goes through `t()` and
 * every left/right placement asks `isRTL()`. `applyText` (in draw.js) sets
 * ctx.direction so Arabic is shaped right-to-left by the browser's own bidi
 * engine, and letter-spacing is dropped because it breaks Arabic joining.
 */

const STRINGS = {
  en: {
    'common.back': 'Back',
    'common.on': 'ON',
    'common.off': 'OFF',

    'title.tagline': 'A stray cat survival story',
    'title.start': 'Start Game',
    'title.start.sub': 'Survive as long as you can',
    'title.help': 'How to Play',
    'title.help.sub': 'Controls & survival tips',
    'title.settings': 'Settings',
    'title.settings.sub': 'Sound, haptics, controls',
    'title.about': 'About',
    'title.about.sub': 'Credits & the story',
    'title.exit': 'Exit',
    'title.exit.sub': 'Leave the city',
    'title.best': 'BEST RUN',
    'title.footer': 'Headphones recommended · Landscape',
    'title.update': 'UPDATE AVAILABLE',
    'title.updateReady': 'Version {version} is ready',
    'title.download': 'Download update',
    'title.later': 'Later',

    'help.title': 'HOW TO PLAY',
    'help.sub': 'Everything you need to survive one more night.',
    'help.move': 'Move. Hold SHIFT or the >>> pad to sprint (burns energy).',
    'help.jump': 'Jump. Hold longer to jump higher. Second tap = double jump.',
    'help.interact': 'Hold to rummage dumpsters or sleep in boxes. Appears in reach.',
    'help.pause': 'Pause the run.',
    'help.surviving': 'SURVIVING THE CITY',
    'help.tip1': 'Rooftops are safe',
    'help.tip1.sub': 'Dogs and cars stay on the street. Climb high to rest.',
    'help.tip2': 'Quests pay in food',
    'help.tip2.sub': 'Shelter from storms, sneak past dogs, climb for golden fish.',
    'help.tip3': 'Golden fish = power',
    'help.tip3.sub': 'Collect {n} on high perches to learn the double jump.',
    'help.tip4': 'Read the warnings',
    'help.tip4.sub': 'A horn means a car is coming — get off the asphalt.',
    'help.tip5': 'Rain and night',
    'help.tip5.sub': 'Traffic speeds up and dogs get bolder after dark.',

    'settings.title': 'SETTINGS',
    'settings.sound': 'Sound',
    'settings.sound.sub': 'Ambience, meows and traffic',
    'settings.haptics': 'Haptics',
    'settings.haptics.sub': 'Vibrate on impacts',
    'settings.touch': 'Touch controls',
    'settings.touch.sub': 'On-screen pads',
    'settings.touch.auto': 'Auto',
    'settings.touch.always': 'Always',
    'settings.touch.off': 'Off',
    'settings.lighting': 'Lighting',
    'settings.lighting.low': 'Low — no night glow passes',
    'settings.lighting.high': 'High — full night lighting',
    'settings.language': 'Language',
    'settings.language.sub': 'Interface and text direction',
    'settings.updates': 'Check for updates',
    'settings.updates.checking': 'Checking…',
    'settings.updates.current': 'Current version {version}',
    'settings.reset': 'Reset best record',
    'settings.reset.sub': '{days} · {food} food',
    'settings.cleared': 'Best record cleared',
    'settings.updateWord': 'UPDATE',

    'about.title': 'ABOUT',
    'about.p1': 'You are a small ginger stray in a city that never slows down.',
    'about.p2': 'The alleys are yours, but so is the traffic. Scavenge what you can,',
    'about.p3': 'sleep where it is warm, and keep moving before the dogs find you.',
    'about.owner': 'OWNER & COPYRIGHT',
    'about.engine': 'Engine',
    'about.engine.sub': 'Custom Canvas 2D engine (no game framework)',
    'about.art': 'Art',
    'about.art.sub': '100% procedural vector art — no image assets',
    'about.audio': 'Audio',
    'about.audio.sub': 'Synthesized with WebAudio at runtime',
    'about.dedicated': 'Dedicated to every cat that ever owned a street. · {title} v{version}',

    'pause.title': 'PAUSED',
    'pause.stats': 'Day {day} · {time} · {distance} m',
    'pause.resume': 'Resume',
    'pause.restart': 'Restart Run',
    'pause.restart.sub': 'Start a fresh night',
    'pause.menu': 'Main Menu',
    'pause.hintTouch': 'Tap PAW or press J to paw',
    'pause.hintKey': 'Press ESC to resume',

    'over.title': 'THE CITY WINS',
    'over.death.starvation': ['The hunger won.', 'Three days is a long time for a stray.'],
    'over.death.dog': ['The dog was faster tonight.', 'Territory is everything in this city.'],
    'over.death.fall': ['The rooftops were not forgiving.', 'Nine lives, but not nine landings.'],
    'over.death.traffic': ['The street never stops.', 'The city does not brake for strays.'],
    'over.death.city': ['The city took another one.', 'It happens every night.'],
    'over.newBest': '★ NEW BEST RUN',
    'over.days': 'Days survived',
    'over.food': 'Food collected',
    'over.distance': 'Distance',
    'over.time': 'Time alive',
    'over.tryAgain': 'Try Again',
    'over.menu': 'Main Menu',

    'hud.day': 'DAY {n}',
    'hud.rain': 'Rain',
    'hud.clear': 'Clear',
    'hud.sleeping': 'Sleeping…',
    'hud.wake': 'Tap jump to wake',
    'hud.quest': 'QUEST',
    'hud.health': 'HEALTH',
    'hud.hunger': 'HUNGER',
    'hud.energy': 'ENERGY',
    'title.bestLine': '{days} · {food} food',
    'settings.low': 'LOW',
    'settings.high': 'HIGH',
    'phase.deepNight': 'Deep night',
    'phase.dawn': 'Dawn',
    'phase.morning': 'Morning',
    'phase.afternoon': 'Afternoon',
    'phase.dusk': 'Dusk',
    'phase.night': 'Night',

    'toast.findFood': 'Find food, stay off the road',
    'toast.woke': 'You wake up, a little warmer',
    'toast.dayBegins': 'Day {n} begins',
    'toast.night': 'Night falls — the rooftops are safer',
    'toast.starving': 'You are starving. Eat something!',
    'toast.found': 'Found {label} +{amount} hunger',
    'toast.milk': 'A whole milk carton!',
    'toast.cardboard': 'Just soggy cardboard…',
    'toast.moving': 'Something is moving in there!',
    'toast.dogHeard': 'A dog heard that',
    'toast.vent': 'Warm air from the vent…',
    'toast.box': 'Curled up in the box',
    'toast.goldFish': 'Golden fish {got}/{total}',
    'toast.ate': 'Ate {label} (+{amount})',
    'toast.toxic': 'Toxic runoff — get out of it!',
    'toast.mouse': 'Caught a mouse!',
    'toast.sandwich': 'A kind stranger left you a sandwich',
    'toast.questDone': 'Quest complete · {label}',
    'toast.lightingLow': 'Lighting: Low (smoother)',
    'toast.lightingHigh': 'Lighting: High (full night glow)',
    'toast.slowDevice': 'Slow device — lighting set to Low. Change it in Settings',
    'toast.language': 'Language: English'
  },

  ar: {
    'common.back': 'رجوع',
    'common.on': 'مفعّل',
    'common.off': 'متوقف',

    'title.tagline': 'حكاية قطة ضائعة في المدينة',
    'title.start': 'ابدأ اللعب',
    'title.start.sub': 'اصمد أطول وقت ممكن',
    'title.help': 'كيف تلعب',
    'title.help.sub': 'التحكم ونصائح البقاء',
    'title.settings': 'الإعدادات',
    'title.settings.sub': 'الصوت والاهتزاز والتحكم',
    'title.about': 'عن اللعبة',
    'title.about.sub': 'الحقوق والقصة',
    'title.exit': 'خروج',
    'title.exit.sub': 'اترك المدينة',
    'title.best': 'أفضل محاولة',
    'title.footer': 'يُفضّل سماعات · شاشة أفقية',
    'title.update': 'يتوفر تحديث',
    'title.updateReady': 'الإصدار {version} جاهز',
    'title.download': 'حمّل التحديث',
    'title.later': 'لاحقًا',

    'help.title': 'كيف تلعب',
    'help.sub': 'كل ما تحتاجه لتعيش ليلة أخرى.',
    'help.move': 'الحركة. استمر بالضغط على SHIFT أو زر ▶▶ للجري (يستهلك الطاقة).',
    'help.jump': 'القفز. اضغط أطول لقفزة أعلى. ضغطة ثانية = قفزة مزدوجة.',
    'help.interact': 'استمر بالضغط للتفتيش في الحاويات أو النوم في الصناديق.',
    'help.pause': 'إيقاف مؤقت للجولة.',
    'help.surviving': 'البقاء في المدينة',
    'help.tip1': 'الأسطح آمنة',
    'help.tip1.sub': 'الكلاب والسيارات تبقى في الشارع. اصعد لتستريح.',
    'help.tip2': 'المهام تُدفع بالطعام',
    'help.tip2.sub': 'احتمِ من العواصف، تسلّل أمام الكلاب، واصعد للسمك الذهبي.',
    'help.tip3': 'السمك الذهبي = قوة',
    'help.tip3.sub': 'اجمع {n} في الأماكن العالية لتتعلم القفزة المزدوجة.',
    'help.tip4': 'اقرأ التحذيرات',
    'help.tip4.sub': 'صوت المنبّه يعني سيارة قادمة — اخرج من الأسفلت.',
    'help.tip5': 'المطر والليل',
    'help.tip5.sub': 'تزداد سرعة السيارات وتصبح الكلاب أجرأ بعد الغروب.',

    'settings.title': 'الإعدادات',
    'settings.sound': 'الصوت',
    'settings.sound.sub': 'الأجواء والمواء وحركة المرور',
    'settings.haptics': 'الاهتزاز',
    'settings.haptics.sub': 'اهتزاز عند الاصطدام',
    'settings.touch': 'أزرار اللمس',
    'settings.touch.sub': 'الأزرار على الشاشة',
    'settings.touch.auto': 'تلقائي',
    'settings.touch.always': 'دائمًا',
    'settings.touch.off': 'إيقاف',
    'settings.lighting': 'جودة الإضاءة',
    'settings.lighting.low': 'منخفضة — بدون إضاءة الليل الكاملة',
    'settings.lighting.high': 'عالية — إضاءة ليل كاملة',
    'settings.language': 'اللغة',
    'settings.language.sub': 'لغة الواجهة واتجاه النص',
    'settings.updates': 'البحث عن تحديث',
    'settings.updates.checking': 'جارٍ التحقق…',
    'settings.updates.current': 'الإصدار الحالي {version}',
    'settings.reset': 'تصفير أفضل محاولة',
    'settings.reset.sub': '{days} · {food} طعام',
    'settings.cleared': 'تم تصفير أفضل محاولة',
    'settings.updateWord': 'تحديث',

    'about.title': 'عن اللعبة',
    'about.p1': 'أنت قطة ضائعة صغيرة في مدينة لا تتوقف أبدًا.',
    'about.p2': 'الأزقة لك، لكن الشارع أيضًا. اجمع ما تستطيع،',
    'about.p3': 'ونم حيث الدفء، وابقَ متحركًا قبل أن تجدك الكلاب.',
    'about.owner': 'المالك وحقوق النشر',
    'about.engine': 'المحرّك',
    'about.engine.sub': 'محرّك Canvas 2D مخصّص (بدون إطار لعبة)',
    'about.art': 'الرسم',
    'about.art.sub': 'رسم متجهي إجرائي 100% — بلا صور',
    'about.audio': 'الصوت',
    'about.audio.sub': 'يُولَّد بـWebAudio أثناء التشغيل',
    'about.dedicated': 'إلى كل قطة امتلكت شارعًا يومًا. · {title} v{version}',

    'pause.title': 'إيقاف مؤقت',
    'pause.stats': 'يوم {day} · {time} · {distance} م',
    'pause.resume': 'متابعة',
    'pause.restart': 'إعادة الجولة',
    'pause.restart.sub': 'ابدأ ليلة جديدة',
    'pause.menu': 'القائمة الرئيسية',
    'pause.hintTouch': 'اضغط المخلب أو زر J للتخميش',
    'pause.hintKey': 'اضغط ESC للمتابعة',

    'over.title': 'المدينة تنتصر',
    'over.death.starvation': ['الجوع انتصر.', 'ثلاثة أيام مدة طويلة لقطة ضائعة.'],
    'over.death.dog': ['الكلب كان أسرع هذه الليلة.', 'الأرض كل شيء في هذه المدينة.'],
    'over.death.fall': ['الأسطح لم تكن رحيمة.', 'تسعة أرواح، لا تسع هبوطات.'],
    'over.death.traffic': ['الشارع لا يتوقف.', 'المدينة لا تفرمل للقطط الضائعة.'],
    'over.death.city': ['المدينة أخذت واحدًا آخر.', 'يحدث كل ليلة.'],
    'over.newBest': '★ أفضل محاولة جديدة',
    'over.days': 'الأيام التي نجوت',
    'over.food': 'الطعام المجموع',
    'over.distance': 'المسافة',
    'over.time': 'زمن البقاء',
    'over.tryAgain': 'حاول مجددًا',
    'over.menu': 'القائمة الرئيسية',

    'hud.day': 'اليوم {n}',
    'hud.rain': 'مطر',
    'hud.clear': 'صافٍ',
    'hud.sleeping': 'نائم…',
    'hud.wake': 'اضغط القفز للاستيقاظ',
    'hud.quest': 'مهمة',
    'hud.health': 'الصحة',
    'hud.hunger': 'الجوع',
    'hud.energy': 'الطاقة',
    'title.bestLine': '{days} · {food} طعام',
    'settings.low': 'منخفضة',
    'settings.high': 'عالية',
    'phase.deepNight': 'منتصف الليل',
    'phase.dawn': 'الفجر',
    'phase.morning': 'الصباح',
    'phase.afternoon': 'بعد الظهر',
    'phase.dusk': 'الغروب',
    'phase.night': 'الليل',

    'toast.findFood': 'ابحث عن طعام وابقَ بعيدًا عن الطريق',
    'toast.woke': 'استيقظت، والجو أدفأ قليلًا',
    'toast.dayBegins': 'اليوم {n} يبدأ',
    'toast.night': 'حلّ الليل — الأسطح أكثر أمانًا',
    'toast.starving': 'أنت تتضور جوعًا. كُل شيئًا!',
    'toast.found': 'وجدت {label} +{amount} شبع',
    'toast.milk': 'علبة حليب كاملة!',
    'toast.cardboard': 'كرتون مبلل فقط…',
    'toast.moving': 'شيء يتحرك بالداخل!',
    'toast.dogHeard': 'كلب سمع ذلك',
    'toast.vent': 'هواء دافئ من الفتحة…',
    'toast.box': 'التففت في الصندوق',
    'toast.goldFish': 'سمك ذهبي {got}/{total}',
    'toast.ate': 'أكلت {label} (+{amount})',
    'toast.toxic': 'مياه ملوّثة — اخرج منها!',
    'toast.mouse': 'أمسكت فأرًا!',
    'toast.sandwich': 'غريب طيّب ترك لك شطيرة',
    'toast.questDone': 'أُنجزت المهمة · {label}',
    'toast.lightingLow': 'الإضاءة: منخفضة (أكثر سلاسة)',
    'toast.lightingHigh': 'الإضاءة: عالية (توهّج ليلي كامل)',
    'toast.slowDevice': 'الجهاز بطيء — تم تخفيض الإضاءة. غيّرها من الإعدادات',
    'toast.language': 'اللغة: العربية'
  }
};

export const LANGUAGES = ['auto', 'en', 'ar'];

let current = 'en';

/** 'auto' follows the device; anything unknown falls back to English. */
export function normalizeLang(pref) {
  if (pref === 'ar' || pref === 'en') return pref;
  const raw = (typeof navigator !== 'undefined' && (navigator.language || navigator.userLanguage)) || 'en';
  return String(raw).toLowerCase().startsWith('ar') ? 'ar' : 'en';
}

export function setLang(pref) {
  current = normalizeLang(pref);
  return current;
}

export function lang() {
  return current;
}

export function isRTL() {
  return current === 'ar';
}

export function dir() {
  return isRTL() ? 'rtl' : 'ltr';
}

/** Looks a key up, falling back to English, then to the key itself. */
export function t(key, vars) {
  const table = STRINGS[current] || STRINGS.en;
  let value = table[key];
  if (value === undefined) value = STRINGS.en[key];
  if (value === undefined) return key;
  if (Array.isArray(value)) return value;
  if (vars) {
    for (const name of Object.keys(vars)) {
      value = value.split(`{${name}}`).join(String(vars[name]));
    }
  }
  return value;
}

/** Arabic day counting: 1 يوم, 2 يومان, 3–10 أيام, 11+ يومًا. */
export function days(count) {
  const n = Math.abs(Math.floor(count));
  if (!isRTL()) return `${n} day${n === 1 ? '' : 's'}`;
  if (n === 1) return 'يوم واحد';
  if (n === 2) return 'يومان';
  if (n >= 3 && n <= 10) return `${n} أيام`;
  return `${n} يومًا`;
}

/** Left/right alignment flips with the language; 'center' never changes. */
export function alignFor(align) {
  if (!isRTL()) return align;
  if (align === 'left') return 'right';
  if (align === 'right') return 'left';
  return align;
}

/** Chevron points into the reading direction. */
export function chevron() {
  return isRTL() ? '‹' : '›';
}
