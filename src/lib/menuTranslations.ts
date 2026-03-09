// Dictionary of common restaurant menu item translations for 14 languages
// Used as fallback when menu items don't have translations in the database

type TranslationEntry = Record<string, string>; // lang code -> translated name

// Normalized French key (lowercase, no accents) -> translations for all 14 languages
// French (fr) is the source language and is included for completeness
const MENU_DICT: Record<string, TranslationEntry> = {
  // ── Plats principaux ──────────────────────────────────────────────────
  "kebab": {
    fr: "Kebab", en: "Kebab", es: "Kebab", de: "Kebab", it: "Kebab", pt: "Kebab",
    nl: "Kebab", ar: "كباب", zh: "烤肉卷", ja: "ケバブ", ko: "케밥", ru: "Кебаб", tr: "Kebap", vi: "Kebab"
  },
  "kebab viande": {
    fr: "Kebab Viande", en: "Meat Kebab", es: "Kebab de Carne", de: "Kebab Fleisch", it: "Kebab Carne", pt: "Kebab de Carne",
    nl: "Kebab Vlees", ar: "كباب لحم", zh: "肉烤肉卷", ja: "ミートケバブ", ko: "고기 케밥", ru: "Кебаб с мясом", tr: "Et Kebap", vi: "Kebab Thit"
  },
  "kebab poulet": {
    fr: "Kebab Poulet", en: "Chicken Kebab", es: "Kebab de Pollo", de: "Kebab Hähnchen", it: "Kebab Pollo", pt: "Kebab de Frango",
    nl: "Kebab Kip", ar: "كباب دجاج", zh: "鸡肉烤肉卷", ja: "チキンケバブ", ko: "치킨 케밥", ru: "Кебаб с курицей", tr: "Tavuk Kebap", vi: "Kebab Ga"
  },
  "kebab mixte": {
    fr: "Kebab Mixte", en: "Mixed Kebab", es: "Kebab Mixto", de: "Kebab Gemischt", it: "Kebab Misto", pt: "Kebab Misto",
    nl: "Kebab Mix", ar: "كباب مشكل", zh: "混合烤肉卷", ja: "ミックスケバブ", ko: "믹스 케밥", ru: "Кебаб микс", tr: "Karisik Kebap", vi: "Kebab Thap Cam"
  },
  "kebab falafel": {
    fr: "Kebab Falafel", en: "Falafel Kebab", es: "Kebab de Falafel", de: "Kebab Falafel", it: "Kebab Falafel", pt: "Kebab de Falafel",
    nl: "Kebab Falafel", ar: "كباب فلافل", zh: "法拉费尔烤肉卷", ja: "ファラフェルケバブ", ko: "팔라펠 케밥", ru: "Кебаб с фалафелем", tr: "Falafel Kebap", vi: "Kebab Falafel"
  },
  "durum": {
    fr: "Durum", en: "Durum Wrap", es: "Durum", de: "Dürüm", it: "Durum", pt: "Durum",
    nl: "Durum", ar: "دوروم", zh: "卷饼", ja: "ドゥルム", ko: "뒤룸", ru: "Дурум", tr: "Dürüm", vi: "Durum"
  },
  "durum viande": {
    fr: "Durum Viande", en: "Meat Durum", es: "Durum de Carne", de: "Dürüm Fleisch", it: "Durum Carne", pt: "Durum de Carne",
    nl: "Durum Vlees", ar: "دوروم لحم", zh: "肉卷饼", ja: "ミートドゥルム", ko: "고기 뒤룸", ru: "Дурум с мясом", tr: "Et Dürüm", vi: "Durum Thit"
  },
  "durum poulet": {
    fr: "Durum Poulet", en: "Chicken Durum", es: "Durum de Pollo", de: "Dürüm Hähnchen", it: "Durum Pollo", pt: "Durum de Frango",
    nl: "Durum Kip", ar: "دوروم دجاج", zh: "鸡肉卷饼", ja: "チキンドゥルム", ko: "치킨 뒤룸", ru: "Дурум с курицей", tr: "Tavuk Dürüm", vi: "Durum Ga"
  },
  "durum mixte": {
    fr: "Durum Mixte", en: "Mixed Durum", es: "Durum Mixto", de: "Dürüm Gemischt", it: "Durum Misto", pt: "Durum Misto",
    nl: "Durum Mix", ar: "دوروم مشكل", zh: "混合卷饼", ja: "ミックスドゥルム", ko: "믹스 뒤룸", ru: "Дурум микс", tr: "Karisik Dürüm", vi: "Durum Thap Cam"
  },
  "assiette kebab": {
    fr: "Assiette Kebab", en: "Kebab Plate", es: "Plato Kebab", de: "Kebab Teller", it: "Piatto Kebab", pt: "Prato Kebab",
    nl: "Kebab Bord", ar: "طبق كباب", zh: "烤肉盘", ja: "ケバブプレート", ko: "케밥 플레이트", ru: "Тарелка кебаб", tr: "Kebap Tabagi", vi: "Dia Kebab"
  },
  "assiette mixte": {
    fr: "Assiette Mixte", en: "Mixed Plate", es: "Plato Mixto", de: "Gemischter Teller", it: "Piatto Misto", pt: "Prato Misto",
    nl: "Gemengd Bord", ar: "طبق مشكل", zh: "混合盘", ja: "ミックスプレート", ko: "믹스 플레이트", ru: "Тарелка микс", tr: "Karisik Tabak", vi: "Dia Thap Cam"
  },
  "assiette falafel": {
    fr: "Assiette Falafel", en: "Falafel Plate", es: "Plato de Falafel", de: "Falafel Teller", it: "Piatto Falafel", pt: "Prato de Falafel",
    nl: "Falafel Bord", ar: "طبق فلافل", zh: "法拉费尔盘", ja: "ファラフェルプレート", ko: "팔라펠 플레이트", ru: "Тарелка с фалафелем", tr: "Falafel Tabagi", vi: "Dia Falafel"
  },
  "tacos": {
    fr: "Tacos", en: "Tacos", es: "Tacos", de: "Tacos", it: "Tacos", pt: "Tacos",
    nl: "Tacos", ar: "تاكوس", zh: "塔可", ja: "タコス", ko: "타코", ru: "Такос", tr: "Tacos", vi: "Tacos"
  },
  "tacos poulet": {
    fr: "Tacos Poulet", en: "Chicken Tacos", es: "Tacos de Pollo", de: "Hähnchen Tacos", it: "Tacos Pollo", pt: "Tacos de Frango",
    nl: "Kip Tacos", ar: "تاكوس دجاج", zh: "鸡肉塔可", ja: "チキンタコス", ko: "치킨 타코", ru: "Такос с курицей", tr: "Tavuk Tacos", vi: "Tacos Ga"
  },
  "tacos viande": {
    fr: "Tacos Viande", en: "Meat Tacos", es: "Tacos de Carne", de: "Fleisch Tacos", it: "Tacos Carne", pt: "Tacos de Carne",
    nl: "Vlees Tacos", ar: "تاكوس لحم", zh: "肉塔可", ja: "ミートタコス", ko: "고기 타코", ru: "Такос с мясом", tr: "Et Tacos", vi: "Tacos Thit"
  },
  "tacos mixte": {
    fr: "Tacos Mixte", en: "Mixed Tacos", es: "Tacos Mixto", de: "Gemischte Tacos", it: "Tacos Misto", pt: "Tacos Misto",
    nl: "Mix Tacos", ar: "تاكوس مشكل", zh: "混合塔可", ja: "ミックスタコス", ko: "믹스 타코", ru: "Такос микс", tr: "Karisik Tacos", vi: "Tacos Thap Cam"
  },
  "pizza": {
    fr: "Pizza", en: "Pizza", es: "Pizza", de: "Pizza", it: "Pizza", pt: "Pizza",
    nl: "Pizza", ar: "بيتزا", zh: "披萨", ja: "ピザ", ko: "피자", ru: "Пицца", tr: "Pizza", vi: "Pizza"
  },
  "pizza margherita": {
    fr: "Pizza Margherita", en: "Margherita Pizza", es: "Pizza Margherita", de: "Pizza Margherita", it: "Pizza Margherita", pt: "Pizza Margherita",
    nl: "Pizza Margherita", ar: "بيتزا مارغريتا", zh: "玛格丽特披萨", ja: "マルゲリータピザ", ko: "마르게리타 피자", ru: "Пицца Маргарита", tr: "Margarita Pizza", vi: "Pizza Margherita"
  },
  "pizza reine": {
    fr: "Pizza Reine", en: "Queen Pizza", es: "Pizza Reina", de: "Pizza Regina", it: "Pizza Regina", pt: "Pizza Rainha",
    nl: "Pizza Regina", ar: "بيتزا ريجينا", zh: "皇后披萨", ja: "レジーナピザ", ko: "레지나 피자", ru: "Пицца Реджина", tr: "Kraliçe Pizza", vi: "Pizza Nu Hoang"
  },
  "pizza 4 fromages": {
    fr: "Pizza 4 Fromages", en: "Four Cheese Pizza", es: "Pizza 4 Quesos", de: "Pizza Vier Käse", it: "Pizza Quattro Formaggi", pt: "Pizza 4 Queijos",
    nl: "Pizza Vier Kazen", ar: "بيتزا أربعة أجبان", zh: "四种奶酪披萨", ja: "クアトロフォルマッジ", ko: "포 치즈 피자", ru: "Пицца 4 сыра", tr: "Dört Peynirli Pizza", vi: "Pizza 4 Pho Mai"
  },
  "pizza calzone": {
    fr: "Pizza Calzone", en: "Calzone", es: "Calzone", de: "Calzone", it: "Calzone", pt: "Calzone",
    nl: "Calzone", ar: "كالزوني", zh: "意式烤包", ja: "カルツォーネ", ko: "칼초네", ru: "Кальцоне", tr: "Calzone", vi: "Calzone"
  },
  "burger": {
    fr: "Burger", en: "Burger", es: "Hamburguesa", de: "Burger", it: "Hamburger", pt: "Hamburguer",
    nl: "Burger", ar: "برغر", zh: "汉堡", ja: "バーガー", ko: "버거", ru: "Бургер", tr: "Burger", vi: "Burger"
  },
  "burger classic": {
    fr: "Burger Classic", en: "Classic Burger", es: "Hamburguesa Clasica", de: "Classic Burger", it: "Hamburger Classico", pt: "Hamburguer Classico",
    nl: "Classic Burger", ar: "برغر كلاسيك", zh: "经典汉堡", ja: "クラシックバーガー", ko: "클래식 버거", ru: "Классический бургер", tr: "Klasik Burger", vi: "Burger Co Dien"
  },
  "burger cheese": {
    fr: "Burger Cheese", en: "Cheeseburger", es: "Hamburguesa con Queso", de: "Cheeseburger", it: "Cheeseburger", pt: "Cheeseburguer",
    nl: "Cheeseburger", ar: "تشيز برغر", zh: "芝士汉堡", ja: "チーズバーガー", ko: "치즈버거", ru: "Чизбургер", tr: "Peynirli Burger", vi: "Burger Pho Mai"
  },
  "burger double": {
    fr: "Burger Double", en: "Double Burger", es: "Hamburguesa Doble", de: "Doppelburger", it: "Doppio Hamburger", pt: "Hamburguer Duplo",
    nl: "Dubbele Burger", ar: "برغر دبل", zh: "双层汉堡", ja: "ダブルバーガー", ko: "더블 버거", ru: "Двойной бургер", tr: "Double Burger", vi: "Burger Doi"
  },
  "burger poulet": {
    fr: "Burger Poulet", en: "Chicken Burger", es: "Hamburguesa de Pollo", de: "Hähnchen Burger", it: "Hamburger di Pollo", pt: "Hamburguer de Frango",
    nl: "Kipburger", ar: "برغر دجاج", zh: "鸡肉汉堡", ja: "チキンバーガー", ko: "치킨 버거", ru: "Бургер с курицей", tr: "Tavuk Burger", vi: "Burger Ga"
  },
  "panini": {
    fr: "Panini", en: "Panini", es: "Panini", de: "Panini", it: "Panino", pt: "Panini",
    nl: "Panini", ar: "بانيني", zh: "帕尼尼", ja: "パニーニ", ko: "파니니", ru: "Панини", tr: "Panini", vi: "Panini"
  },
  "panini poulet": {
    fr: "Panini Poulet", en: "Chicken Panini", es: "Panini de Pollo", de: "Hähnchen Panini", it: "Panino al Pollo", pt: "Panini de Frango",
    nl: "Kip Panini", ar: "بانيني دجاج", zh: "鸡肉帕尼尼", ja: "チキンパニーニ", ko: "치킨 파니니", ru: "Панини с курицей", tr: "Tavuk Panini", vi: "Panini Ga"
  },
  "panini thon": {
    fr: "Panini Thon", en: "Tuna Panini", es: "Panini de Atun", de: "Thunfisch Panini", it: "Panino al Tonno", pt: "Panini de Atum",
    nl: "Tonijn Panini", ar: "بانيني تونة", zh: "金枪鱼帕尼尼", ja: "ツナパニーニ", ko: "참치 파니니", ru: "Панини с тунцом", tr: "Ton Balikli Panini", vi: "Panini Ca Ngu"
  },
  "sandwich": {
    fr: "Sandwich", en: "Sandwich", es: "Sandwich", de: "Sandwich", it: "Sandwich", pt: "Sandwich",
    nl: "Sandwich", ar: "ساندويتش", zh: "三明治", ja: "サンドイッチ", ko: "샌드위치", ru: "Сэндвич", tr: "Sandviç", vi: "Banh mi kep"
  },
  "croque-monsieur": {
    fr: "Croque-Monsieur", en: "Croque-Monsieur", es: "Croque-Monsieur", de: "Croque-Monsieur", it: "Croque-Monsieur", pt: "Croque-Monsieur",
    nl: "Croque-Monsieur", ar: "كروك مسيو", zh: "法式火腿芝士三明治", ja: "クロックムッシュ", ko: "크로크무슈", ru: "Крок-месье", tr: "Croque-Monsieur", vi: "Croque-Monsieur"
  },
  "croque-madame": {
    fr: "Croque-Madame", en: "Croque-Madame", es: "Croque-Madame", de: "Croque-Madame", it: "Croque-Madame", pt: "Croque-Madame",
    nl: "Croque-Madame", ar: "كروك مدام", zh: "法式太太三明治", ja: "クロックマダム", ko: "크로크마담", ru: "Крок-мадам", tr: "Croque-Madame", vi: "Croque-Madame"
  },
  "galette": {
    fr: "Galette", en: "Galette", es: "Galette", de: "Galette", it: "Galette", pt: "Galette",
    nl: "Galette", ar: "غاليت", zh: "薄饼", ja: "ガレット", ko: "갈레트", ru: "Галет", tr: "Galette", vi: "Banh crepe man"
  },
  "wrap": {
    fr: "Wrap", en: "Wrap", es: "Wrap", de: "Wrap", it: "Wrap", pt: "Wrap",
    nl: "Wrap", ar: "راب", zh: "卷饼", ja: "ラップ", ko: "랩", ru: "Ролл", tr: "Wrap", vi: "Cuon"
  },
  "naan": {
    fr: "Naan", en: "Naan", es: "Naan", de: "Naan", it: "Naan", pt: "Naan",
    nl: "Naan", ar: "نان", zh: "馕饼", ja: "ナン", ko: "난", ru: "Наан", tr: "Naan", vi: "Banh Naan"
  },
  "falafel": {
    fr: "Falafel", en: "Falafel", es: "Falafel", de: "Falafel", it: "Falafel", pt: "Falafel",
    nl: "Falafel", ar: "فلافل", zh: "法拉费尔", ja: "ファラフェル", ko: "팔라펠", ru: "Фалафель", tr: "Falafel", vi: "Falafel"
  },
  "nuggets": {
    fr: "Nuggets", en: "Nuggets", es: "Nuggets", de: "Nuggets", it: "Nuggets", pt: "Nuggets",
    nl: "Nuggets", ar: "ناغتس", zh: "鸡块", ja: "ナゲット", ko: "너겟", ru: "Наггетсы", tr: "Nugget", vi: "Nuggets"
  },
  "tenders": {
    fr: "Tenders", en: "Tenders", es: "Tiras de Pollo", de: "Tenders", it: "Tenders", pt: "Tenders",
    nl: "Tenders", ar: "تندرز", zh: "鸡柳", ja: "テンダー", ko: "텐더", ru: "Тендеры", tr: "Tender", vi: "Tenders"
  },
  "cordon bleu": {
    fr: "Cordon Bleu", en: "Cordon Bleu", es: "Cordon Bleu", de: "Cordon Bleu", it: "Cordon Bleu", pt: "Cordon Bleu",
    nl: "Cordon Bleu", ar: "كوردون بلو", zh: "蓝带鸡排", ja: "コルドンブルー", ko: "코르동 블루", ru: "Кордон блю", tr: "Kordon Blö", vi: "Cordon Bleu"
  },

  // ── Garnitures / Ingredients ───────────────────────────────────────────
  "salade": {
    fr: "Salade", en: "Salad", es: "Ensalada", de: "Salat", it: "Insalata", pt: "Salada",
    nl: "Salade", ar: "سلطة", zh: "沙拉", ja: "サラダ", ko: "샐러드", ru: "Салат", tr: "Salata", vi: "Salad"
  },
  "tomates": {
    fr: "Tomates", en: "Tomatoes", es: "Tomates", de: "Tomaten", it: "Pomodori", pt: "Tomates",
    nl: "Tomaten", ar: "طماطم", zh: "番茄", ja: "トマト", ko: "토마토", ru: "Помидоры", tr: "Domates", vi: "Ca chua"
  },
  "oignons": {
    fr: "Oignons", en: "Onions", es: "Cebollas", de: "Zwiebeln", it: "Cipolle", pt: "Cebolas",
    nl: "Uien", ar: "بصل", zh: "洋葱", ja: "玉ねぎ", ko: "양파", ru: "Лук", tr: "Sogan", vi: "Hanh tay"
  },
  "oignons rouges": {
    fr: "Oignons rouges", en: "Red Onions", es: "Cebollas Rojas", de: "Rote Zwiebeln", it: "Cipolle Rosse", pt: "Cebolas Roxas",
    nl: "Rode Uien", ar: "بصل أحمر", zh: "红洋葱", ja: "赤玉ねぎ", ko: "적양파", ru: "Красный лук", tr: "Kirmizi Sogan", vi: "Hanh tim"
  },
  "concombre": {
    fr: "Concombre", en: "Cucumber", es: "Pepino", de: "Gurke", it: "Cetriolo", pt: "Pepino",
    nl: "Komkommer", ar: "خيار", zh: "黄瓜", ja: "きゅうり", ko: "오이", ru: "Огурец", tr: "Salatalik", vi: "Dua chuot"
  },
  "cornichons": {
    fr: "Cornichons", en: "Pickles", es: "Pepinillos", de: "Essiggurken", it: "Cetriolini", pt: "Pepinos em conserva",
    nl: "Augurken", ar: "مخلل", zh: "酸黄瓜", ja: "ピクルス", ko: "피클", ru: "Корнишоны", tr: "Tursu", vi: "Dua muoi"
  },
  "poivrons": {
    fr: "Poivrons", en: "Bell Peppers", es: "Pimientos", de: "Paprika", it: "Peperoni", pt: "Pimentos",
    nl: "Paprika", ar: "فلفل", zh: "甜椒", ja: "ピーマン", ko: "피망", ru: "Перец", tr: "Biber", vi: "Ot chuong"
  },
  "piments": {
    fr: "Piments", en: "Chili Peppers", es: "Chiles", de: "Chili", it: "Peperoncini", pt: "Pimentas",
    nl: "Pepers", ar: "فلفل حار", zh: "辣椒", ja: "唐辛子", ko: "고추", ru: "Острый перец", tr: "Aci Biber", vi: "Ot"
  },
  "fromage": {
    fr: "Fromage", en: "Cheese", es: "Queso", de: "Käse", it: "Formaggio", pt: "Queijo",
    nl: "Kaas", ar: "جبن", zh: "奶酪", ja: "チーズ", ko: "치즈", ru: "Сыр", tr: "Peynir", vi: "Pho mai"
  },
  "mozzarella": {
    fr: "Mozzarella", en: "Mozzarella", es: "Mozzarella", de: "Mozzarella", it: "Mozzarella", pt: "Mozzarella",
    nl: "Mozzarella", ar: "موزاريلا", zh: "马苏里拉", ja: "モッツァレラ", ko: "모짜렐라", ru: "Моцарелла", tr: "Mozzarella", vi: "Mozzarella"
  },
  "emmental": {
    fr: "Emmental", en: "Emmental", es: "Emmental", de: "Emmentaler", it: "Emmental", pt: "Emmental",
    nl: "Emmental", ar: "إيمنتال", zh: "埃曼塔尔", ja: "エメンタール", ko: "에멘탈", ru: "Эмменталь", tr: "Emmental", vi: "Emmental"
  },
  "cheddar": {
    fr: "Cheddar", en: "Cheddar", es: "Cheddar", de: "Cheddar", it: "Cheddar", pt: "Cheddar",
    nl: "Cheddar", ar: "شيدر", zh: "切达", ja: "チェダー", ko: "체다", ru: "Чеддер", tr: "Cheddar", vi: "Cheddar"
  },
  "feta": {
    fr: "Feta", en: "Feta", es: "Feta", de: "Feta", it: "Feta", pt: "Feta",
    nl: "Feta", ar: "فيتا", zh: "菲达", ja: "フェタ", ko: "페타", ru: "Фета", tr: "Beyaz Peynir", vi: "Feta"
  },
  "olives": {
    fr: "Olives", en: "Olives", es: "Aceitunas", de: "Oliven", it: "Olive", pt: "Azeitonas",
    nl: "Olijven", ar: "زيتون", zh: "橄榄", ja: "オリーブ", ko: "올리브", ru: "Оливки", tr: "Zeytin", vi: "O liu"
  },
  "champignons": {
    fr: "Champignons", en: "Mushrooms", es: "Champiñones", de: "Pilze", it: "Funghi", pt: "Cogumelos",
    nl: "Champignons", ar: "فطر", zh: "蘑菇", ja: "マッシュルーム", ko: "버섯", ru: "Грибы", tr: "Mantar", vi: "Nam"
  },
  "mais": {
    fr: "Mais", en: "Corn", es: "Maiz", de: "Mais", it: "Mais", pt: "Milho",
    nl: "Mais", ar: "ذرة", zh: "玉米", ja: "コーン", ko: "옥수수", ru: "Кукуруза", tr: "Misir", vi: "Bap"
  },
  "jalapenos": {
    fr: "Jalapenos", en: "Jalapenos", es: "Jalapeños", de: "Jalapenos", it: "Jalapenos", pt: "Jalapenos",
    nl: "Jalapenos", ar: "هالابينو", zh: "墨西哥辣椒", ja: "ハラペーニョ", ko: "할라피뇨", ru: "Халапеньо", tr: "Jalapeno", vi: "Ot Jalapeno"
  },
  "chou rouge": {
    fr: "Chou rouge", en: "Red Cabbage", es: "Col Lombarda", de: "Rotkohl", it: "Cavolo Rosso", pt: "Couve Roxa",
    nl: "Rode Kool", ar: "ملفوف أحمر", zh: "紫甘蓝", ja: "紫キャベツ", ko: "적양배추", ru: "Красная капуста", tr: "Kirmizi Lahana", vi: "Bap cai tim"
  },
  "chou blanc": {
    fr: "Chou blanc", en: "White Cabbage", es: "Col Blanca", de: "Weißkohl", it: "Cavolo Bianco", pt: "Couve Branca",
    nl: "Witte Kool", ar: "ملفوف أبيض", zh: "白甘蓝", ja: "白キャベツ", ko: "양배추", ru: "Белая капуста", tr: "Beyaz Lahana", vi: "Bap cai trang"
  },
  "carottes rapees": {
    fr: "Carottes rapees", en: "Grated Carrots", es: "Zanahorias Ralladas", de: "Geraspelte Karotten", it: "Carote Grattugiate", pt: "Cenouras Raladas",
    nl: "Geraspte Wortels", ar: "جزر مبشور", zh: "胡萝卜丝", ja: "にんじんサラダ", ko: "당근채", ru: "Тертая морковь", tr: "Rendelenmis Havuç", vi: "Ca rot bao"
  },
  "oeuf": {
    fr: "Oeuf", en: "Egg", es: "Huevo", de: "Ei", it: "Uovo", pt: "Ovo",
    nl: "Ei", ar: "بيض", zh: "鸡蛋", ja: "卵", ko: "계란", ru: "Яйцо", tr: "Yumurta", vi: "Trung"
  },
  "bacon": {
    fr: "Bacon", en: "Bacon", es: "Bacon", de: "Speck", it: "Bacon", pt: "Bacon",
    nl: "Spek", ar: "لحم مقدد", zh: "培根", ja: "ベーコン", ko: "베이컨", ru: "Бекон", tr: "Bacon", vi: "Thit xong khoi"
  },
  "steak hache": {
    fr: "Steak hache", en: "Beef Patty", es: "Hamburguesa de Carne", de: "Hacksteak", it: "Hamburger di Manzo", pt: "Bife Picado",
    nl: "Gehaktbal", ar: "ستيك مفروم", zh: "牛肉饼", ja: "ハンバーグ", ko: "다진 스테이크", ru: "Рубленый стейк", tr: "Köfte", vi: "Bit tet bam"
  },
  "poulet grille": {
    fr: "Poulet grille", en: "Grilled Chicken", es: "Pollo a la Parrilla", de: "Gegrilltes Hähnchen", it: "Pollo alla Griglia", pt: "Frango Grelhado",
    nl: "Gegrilde Kip", ar: "دجاج مشوي", zh: "烤鸡", ja: "グリルチキン", ko: "구운 치킨", ru: "Курица гриль", tr: "Izgara Tavuk", vi: "Ga nuong"
  },
  "merguez": {
    fr: "Merguez", en: "Merguez Sausage", es: "Merguez", de: "Merguez", it: "Merguez", pt: "Merguez",
    nl: "Merguez", ar: "مرقاز", zh: "梅尔盖兹香肠", ja: "メルゲーズ", ko: "메르게즈", ru: "Мергез", tr: "Merguez", vi: "Xuc xich Merguez"
  },
  "frites": {
    fr: "Frites", en: "French Fries", es: "Patatas Fritas", de: "Pommes Frites", it: "Patatine Fritte", pt: "Batatas Fritas",
    nl: "Friet", ar: "بطاطا مقلية", zh: "薯条", ja: "フライドポテト", ko: "감자튀김", ru: "Картофель фри", tr: "Patates Kizartmasi", vi: "Khoai tay chien"
  },
  "riz": {
    fr: "Riz", en: "Rice", es: "Arroz", de: "Reis", it: "Riso", pt: "Arroz",
    nl: "Rijst", ar: "أرز", zh: "米饭", ja: "ライス", ko: "밥", ru: "Рис", tr: "Pilav", vi: "Com"
  },
  "semoule": {
    fr: "Semoule", en: "Semolina", es: "Semola", de: "Grieß", it: "Semola", pt: "Semola",
    nl: "Griesmeel", ar: "سميد", zh: "粗面粉", ja: "セモリナ", ko: "세몰리나", ru: "Манка", tr: "Irmik", vi: "Bot semolina"
  },
  "boulgour": {
    fr: "Boulgour", en: "Bulgur", es: "Bulgur", de: "Bulgur", it: "Bulgur", pt: "Bulgur",
    nl: "Bulgur", ar: "برغل", zh: "碾碎小麦", ja: "ブルグル", ko: "불구르", ru: "Булгур", tr: "Bulgur", vi: "Bulgur"
  },
  "viande": {
    fr: "Viande", en: "Meat", es: "Carne", de: "Fleisch", it: "Carne", pt: "Carne",
    nl: "Vlees", ar: "لحم", zh: "肉", ja: "肉", ko: "고기", ru: "Мясо", tr: "Et", vi: "Thit"
  },
  "poulet": {
    fr: "Poulet", en: "Chicken", es: "Pollo", de: "Hähnchen", it: "Pollo", pt: "Frango",
    nl: "Kip", ar: "دجاج", zh: "鸡肉", ja: "チキン", ko: "치킨", ru: "Курица", tr: "Tavuk", vi: "Ga"
  },
  "mixte": {
    fr: "Mixte", en: "Mixed", es: "Mixto", de: "Gemischt", it: "Misto", pt: "Misto",
    nl: "Mix", ar: "مشكل", zh: "混合", ja: "ミックス", ko: "믹스", ru: "Микс", tr: "Karisik", vi: "Thap cam"
  },

  // ── Sauces ─────────────────────────────────────────────────────────────
  "sauce blanche": {
    fr: "Sauce Blanche", en: "White Sauce", es: "Salsa Blanca", de: "Weiße Soße", it: "Salsa Bianca", pt: "Molho Branco",
    nl: "Witte Saus", ar: "صلصة بيضاء", zh: "白酱", ja: "ホワイトソース", ko: "화이트 소스", ru: "Белый соус", tr: "Beyaz Sos", vi: "Sot trang"
  },
  "sauce samurai": {
    fr: "Sauce Samurai", en: "Samurai Sauce", es: "Salsa Samurai", de: "Samurai Soße", it: "Salsa Samurai", pt: "Molho Samurai",
    nl: "Samuaisaus", ar: "صلصة ساموراي", zh: "武士酱", ja: "サムライソース", ko: "사무라이 소스", ru: "Соус самурай", tr: "Samuray Sos", vi: "Sot Samurai"
  },
  "sauce algerienne": {
    fr: "Sauce Algerienne", en: "Algerian Sauce", es: "Salsa Argelina", de: "Algerische Soße", it: "Salsa Algerina", pt: "Molho Argelino",
    nl: "Algerijnse Saus", ar: "صلصة جزائرية", zh: "阿尔及利亚酱", ja: "アルジェリアンソース", ko: "알제리 소스", ru: "Алжирский соус", tr: "Cezayir Sosu", vi: "Sot Algeria"
  },
  "sauce harissa": {
    fr: "Sauce Harissa", en: "Harissa Sauce", es: "Salsa Harissa", de: "Harissa Soße", it: "Salsa Harissa", pt: "Molho Harissa",
    nl: "Harissa Saus", ar: "صلصة هريسة", zh: "哈里萨酱", ja: "ハリッサソース", ko: "하리사 소스", ru: "Соус харисса", tr: "Harissa Sos", vi: "Sot Harissa"
  },
  "sauce piquante": {
    fr: "Sauce Piquante", en: "Hot Sauce", es: "Salsa Picante", de: "Scharfe Soße", it: "Salsa Piccante", pt: "Molho Picante",
    nl: "Pittige Saus", ar: "صلصة حارة", zh: "辣酱", ja: "ホットソース", ko: "매운 소스", ru: "Острый соус", tr: "Aci Sos", vi: "Sot cay"
  },
  "sauce barbecue": {
    fr: "Sauce Barbecue", en: "BBQ Sauce", es: "Salsa Barbacoa", de: "BBQ Soße", it: "Salsa Barbecue", pt: "Molho Barbecue",
    nl: "BBQ Saus", ar: "صلصة باربيكيو", zh: "烧烤酱", ja: "BBQソース", ko: "바비큐 소스", ru: "Соус барбекю", tr: "Barbekü Sos", vi: "Sot BBQ"
  },
  "sauce ketchup": {
    fr: "Sauce Ketchup", en: "Ketchup", es: "Ketchup", de: "Ketchup", it: "Ketchup", pt: "Ketchup",
    nl: "Ketchup", ar: "كاتشب", zh: "番茄酱", ja: "ケチャップ", ko: "케첩", ru: "Кетчуп", tr: "Ketçap", vi: "Tuong ca"
  },
  "mayonnaise": {
    fr: "Mayonnaise", en: "Mayonnaise", es: "Mayonesa", de: "Mayonnaise", it: "Maionese", pt: "Maionese",
    nl: "Mayonaise", ar: "مايونيز", zh: "蛋黄酱", ja: "マヨネーズ", ko: "마요네즈", ru: "Майонез", tr: "Mayonez", vi: "Sot Mayonnaise"
  },
  "moutarde": {
    fr: "Moutarde", en: "Mustard", es: "Mostaza", de: "Senf", it: "Senape", pt: "Mostarda",
    nl: "Mosterd", ar: "خردل", zh: "芥末酱", ja: "マスタード", ko: "머스타드", ru: "Горчица", tr: "Hardal", vi: "Mu tat"
  },
  "sauce fromagere": {
    fr: "Sauce Fromagere", en: "Cheese Sauce", es: "Salsa de Queso", de: "Käsesoße", it: "Salsa al Formaggio", pt: "Molho de Queijo",
    nl: "Kaassaus", ar: "صلصة الجبن", zh: "奶酪酱", ja: "チーズソース", ko: "치즈 소스", ru: "Сырный соус", tr: "Peynir Sosu", vi: "Sot pho mai"
  },
  "sauce curry": {
    fr: "Sauce Curry", en: "Curry Sauce", es: "Salsa Curry", de: "Curry Soße", it: "Salsa Curry", pt: "Molho de Curry",
    nl: "Kerriesaus", ar: "صلصة كاري", zh: "咖喱酱", ja: "カレーソース", ko: "커리 소스", ru: "Соус карри", tr: "Köri Sos", vi: "Sot ca ri"
  },
  "sauce andalouse": {
    fr: "Sauce Andalouse", en: "Andalouse Sauce", es: "Salsa Andaluza", de: "Andalusische Soße", it: "Salsa Andalusa", pt: "Molho Andaluz",
    nl: "Andalousesaus", ar: "صلصة أندلسية", zh: "安达卢西亚酱", ja: "アンダルーズソース", ko: "안달루즈 소스", ru: "Андалузский соус", tr: "Endülüs Sosu", vi: "Sot Andalouse"
  },
  "sauce cocktail": {
    fr: "Sauce Cocktail", en: "Cocktail Sauce", es: "Salsa Cocktail", de: "Cocktailsoße", it: "Salsa Cocktail", pt: "Molho Cocktail",
    nl: "Cocktailsaus", ar: "صلصة كوكتيل", zh: "鸡尾酒酱", ja: "カクテルソース", ko: "칵테일 소스", ru: "Коктейльный соус", tr: "Kokteyl Sos", vi: "Sot Cocktail"
  },
  "huile d'olive": {
    fr: "Huile d'olive", en: "Olive Oil", es: "Aceite de Oliva", de: "Olivenöl", it: "Olio d'Oliva", pt: "Azeite",
    nl: "Olijfolie", ar: "زيت الزيتون", zh: "橄榄油", ja: "オリーブオイル", ko: "올리브 오일", ru: "Оливковое масло", tr: "Zeytinyagi", vi: "Dau o liu"
  },
  "vinaigrette": {
    fr: "Vinaigrette", en: "Vinaigrette", es: "Vinagreta", de: "Vinaigrette", it: "Vinaigrette", pt: "Vinagrete",
    nl: "Vinaigrette", ar: "صلصة خل", zh: "油醋汁", ja: "ビネグレット", ko: "비네그레트", ru: "Винегрет", tr: "Sos Vinegret", vi: "Sot dam"
  },

  // ── Boissons ───────────────────────────────────────────────────────────
  "coca-cola": {
    fr: "Coca-Cola", en: "Coca-Cola", es: "Coca-Cola", de: "Coca-Cola", it: "Coca-Cola", pt: "Coca-Cola",
    nl: "Coca-Cola", ar: "كوكا كولا", zh: "可口可乐", ja: "コカ・コーラ", ko: "코카콜라", ru: "Кока-Кола", tr: "Coca-Cola", vi: "Coca-Cola"
  },
  "fanta": {
    fr: "Fanta", en: "Fanta", es: "Fanta", de: "Fanta", it: "Fanta", pt: "Fanta",
    nl: "Fanta", ar: "فانتا", zh: "芬达", ja: "ファンタ", ko: "환타", ru: "Фанта", tr: "Fanta", vi: "Fanta"
  },
  "sprite": {
    fr: "Sprite", en: "Sprite", es: "Sprite", de: "Sprite", it: "Sprite", pt: "Sprite",
    nl: "Sprite", ar: "سبرايت", zh: "雪碧", ja: "スプライト", ko: "스프라이트", ru: "Спрайт", tr: "Sprite", vi: "Sprite"
  },
  "orangina": {
    fr: "Orangina", en: "Orangina", es: "Orangina", de: "Orangina", it: "Orangina", pt: "Orangina",
    nl: "Orangina", ar: "أورانجينا", zh: "Orangina", ja: "オランジーナ", ko: "오랑지나", ru: "Оранжина", tr: "Orangina", vi: "Orangina"
  },
  "ice tea": {
    fr: "Ice Tea", en: "Iced Tea", es: "Te Helado", de: "Eistee", it: "Te Freddo", pt: "Cha Gelado",
    nl: "IJsthee", ar: "شاي مثلج", zh: "冰茶", ja: "アイスティー", ko: "아이스티", ru: "Холодный чай", tr: "Buzlu Çay", vi: "Tra da"
  },
  "eau plate": {
    fr: "Eau plate", en: "Still Water", es: "Agua sin Gas", de: "Stilles Wasser", it: "Acqua Naturale", pt: "Agua sem Gas",
    nl: "Plat Water", ar: "ماء عادي", zh: "矿泉水", ja: "ミネラルウォーター", ko: "생수", ru: "Вода без газа", tr: "Su", vi: "Nuoc loc"
  },
  "eau gazeuse": {
    fr: "Eau gazeuse", en: "Sparkling Water", es: "Agua con Gas", de: "Sprudelwasser", it: "Acqua Frizzante", pt: "Agua com Gas",
    nl: "Bruiswater", ar: "ماء فوار", zh: "气泡水", ja: "炭酸水", ko: "탄산수", ru: "Газированная вода", tr: "Soda", vi: "Nuoc co ga"
  },
  "jus d'orange": {
    fr: "Jus d'orange", en: "Orange Juice", es: "Zumo de Naranja", de: "Orangensaft", it: "Succo d'Arancia", pt: "Sumo de Laranja",
    nl: "Sinaasappelsap", ar: "عصير برتقال", zh: "橙汁", ja: "オレンジジュース", ko: "오렌지 주스", ru: "Апельсиновый сок", tr: "Portakal Suyu", vi: "Nuoc cam"
  },
  "jus de pomme": {
    fr: "Jus de pomme", en: "Apple Juice", es: "Zumo de Manzana", de: "Apfelsaft", it: "Succo di Mela", pt: "Sumo de Maca",
    nl: "Appelsap", ar: "عصير تفاح", zh: "苹果汁", ja: "りんごジュース", ko: "사과 주스", ru: "Яблочный сок", tr: "Elma Suyu", vi: "Nuoc tao"
  },
  "ayran": {
    fr: "Ayran", en: "Ayran", es: "Ayran", de: "Ayran", it: "Ayran", pt: "Ayran",
    nl: "Ayran", ar: "عيران", zh: "酸奶饮料", ja: "アイラン", ko: "아이란", ru: "Айран", tr: "Ayran", vi: "Ayran"
  },
  "the": {
    fr: "The", en: "Tea", es: "Te", de: "Tee", it: "Te", pt: "Cha",
    nl: "Thee", ar: "شاي", zh: "茶", ja: "お茶", ko: "차", ru: "Чай", tr: "Çay", vi: "Tra"
  },
  "the a la menthe": {
    fr: "The a la menthe", en: "Mint Tea", es: "Te de Menta", de: "Pfefferminztee", it: "Te alla Menta", pt: "Cha de Menta",
    nl: "Muntthee", ar: "شاي بالنعناع", zh: "薄荷茶", ja: "ミントティー", ko: "민트차", ru: "Мятный чай", tr: "Nane Çayi", vi: "Tra bac ha"
  },
  "cafe": {
    fr: "Cafe", en: "Coffee", es: "Cafe", de: "Kaffee", it: "Caffe", pt: "Cafe",
    nl: "Koffie", ar: "قهوة", zh: "咖啡", ja: "コーヒー", ko: "커피", ru: "Кофе", tr: "Kahve", vi: "Ca phe"
  },
  "expresso": {
    fr: "Expresso", en: "Espresso", es: "Espresso", de: "Espresso", it: "Espresso", pt: "Expresso",
    nl: "Espresso", ar: "إسبريسو", zh: "浓缩咖啡", ja: "エスプレッソ", ko: "에스프레소", ru: "Эспрессо", tr: "Espresso", vi: "Espresso"
  },
  "limonade": {
    fr: "Limonade", en: "Lemonade", es: "Limonada", de: "Limonade", it: "Limonata", pt: "Limonada",
    nl: "Limonade", ar: "عصير ليمون", zh: "柠檬水", ja: "レモネード", ko: "레모네이드", ru: "Лимонад", tr: "Limonata", vi: "Nuoc chanh"
  },
  "perrier": {
    fr: "Perrier", en: "Perrier", es: "Perrier", de: "Perrier", it: "Perrier", pt: "Perrier",
    nl: "Perrier", ar: "بيريه", zh: "Perrier", ja: "ペリエ", ko: "페리에", ru: "Перье", tr: "Perrier", vi: "Perrier"
  },
  "rose": {
    fr: "Rose", en: "Rose Wine", es: "Vino Rosado", de: "Rosewein", it: "Vino Rosato", pt: "Vinho Rose",
    nl: "Rose Wijn", ar: "نبيذ وردي", zh: "桃红葡萄酒", ja: "ロゼワイン", ko: "로제 와인", ru: "Розовое вино", tr: "Roze Sarap", vi: "Ruou Rose"
  },

  // ── Desserts ───────────────────────────────────────────────────────────
  "tiramisu": {
    fr: "Tiramisu", en: "Tiramisu", es: "Tiramisu", de: "Tiramisu", it: "Tiramisu", pt: "Tiramisu",
    nl: "Tiramisu", ar: "تيراميسو", zh: "提拉米苏", ja: "ティラミス", ko: "티라미수", ru: "Тирамису", tr: "Tiramisu", vi: "Tiramisu"
  },
  "fondant au chocolat": {
    fr: "Fondant au chocolat", en: "Chocolate Lava Cake", es: "Fondant de Chocolate", de: "Schokoladen-Fondant", it: "Tortino al Cioccolato", pt: "Fondant de Chocolate",
    nl: "Chocolade Fondant", ar: "فوندان شوكولاتة", zh: "熔岩巧克力蛋糕", ja: "フォンダンショコラ", ko: "퐁당 쇼콜라", ru: "Шоколадный фондан", tr: "Çikolata Sufle", vi: "Banh chocolate tan chay"
  },
  "creme brulee": {
    fr: "Creme brulee", en: "Creme Brulee", es: "Crema Catalana", de: "Creme Brulee", it: "Creme Brulee", pt: "Creme Brulee",
    nl: "Creme Brulee", ar: "كريم بروليه", zh: "焦糖布丁", ja: "クレームブリュレ", ko: "크렘 브륄레", ru: "Крем-брюле", tr: "Krem Brüle", vi: "Kem Brulee"
  },
  "baklava": {
    fr: "Baklava", en: "Baklava", es: "Baklava", de: "Baklava", it: "Baklava", pt: "Baklava",
    nl: "Baklava", ar: "بقلاوة", zh: "果仁蜜饼", ja: "バクラヴァ", ko: "바클라바", ru: "Пахлава", tr: "Baklava", vi: "Baklava"
  },
  "glace vanille": {
    fr: "Glace vanille", en: "Vanilla Ice Cream", es: "Helado de Vainilla", de: "Vanilleeis", it: "Gelato alla Vaniglia", pt: "Gelado de Baunilha",
    nl: "Vanille-ijs", ar: "آيس كريم فانيليا", zh: "香草冰淇淋", ja: "バニラアイス", ko: "바닐라 아이스크림", ru: "Ванильное мороженое", tr: "Vanilya Dondurma", vi: "Kem vani"
  },
  "glace chocolat": {
    fr: "Glace chocolat", en: "Chocolate Ice Cream", es: "Helado de Chocolate", de: "Schokoladeneis", it: "Gelato al Cioccolato", pt: "Gelado de Chocolate",
    nl: "Chocolade-ijs", ar: "آيس كريم شوكولاتة", zh: "巧克力冰淇淋", ja: "チョコレートアイス", ko: "초콜릿 아이스크림", ru: "Шоколадное мороженое", tr: "Çikolata Dondurma", vi: "Kem socola"
  },
  "glace fraise": {
    fr: "Glace fraise", en: "Strawberry Ice Cream", es: "Helado de Fresa", de: "Erdbeereis", it: "Gelato alla Fragola", pt: "Gelado de Morango",
    nl: "Aardbei-ijs", ar: "آيس كريم فراولة", zh: "草莓冰淇淋", ja: "ストロベリーアイス", ko: "딸기 아이스크림", ru: "Клубничное мороженое", tr: "Çilek Dondurma", vi: "Kem dau"
  },
  "brownie": {
    fr: "Brownie", en: "Brownie", es: "Brownie", de: "Brownie", it: "Brownie", pt: "Brownie",
    nl: "Brownie", ar: "براوني", zh: "布朗尼", ja: "ブラウニー", ko: "브라우니", ru: "Брауни", tr: "Brownie", vi: "Brownie"
  },
  "cookie": {
    fr: "Cookie", en: "Cookie", es: "Galleta", de: "Cookie", it: "Biscotto", pt: "Biscoito",
    nl: "Koekje", ar: "كوكي", zh: "曲奇", ja: "クッキー", ko: "쿠키", ru: "Печенье", tr: "Kurabiye", vi: "Banh quy"
  },
  "muffin": {
    fr: "Muffin", en: "Muffin", es: "Muffin", de: "Muffin", it: "Muffin", pt: "Muffin",
    nl: "Muffin", ar: "مافن", zh: "麦芬", ja: "マフィン", ko: "머핀", ru: "Маффин", tr: "Muffin", vi: "Banh Muffin"
  },

  // ── Tailles / Options / Categories ─────────────────────────────────────
  "petit": {
    fr: "Petit", en: "Small", es: "Pequeño", de: "Klein", it: "Piccolo", pt: "Pequeno",
    nl: "Klein", ar: "صغير", zh: "小", ja: "S", ko: "소", ru: "Маленький", tr: "Küçük", vi: "Nho"
  },
  "moyen": {
    fr: "Moyen", en: "Medium", es: "Mediano", de: "Mittel", it: "Medio", pt: "Medio",
    nl: "Middel", ar: "وسط", zh: "中", ja: "M", ko: "중", ru: "Средний", tr: "Orta", vi: "Vua"
  },
  "grand": {
    fr: "Grand", en: "Large", es: "Grande", de: "Groß", it: "Grande", pt: "Grande",
    nl: "Groot", ar: "كبير", zh: "大", ja: "L", ko: "대", ru: "Большой", tr: "Büyük", vi: "Lon"
  },
  "simple": {
    fr: "Simple", en: "Single", es: "Simple", de: "Einfach", it: "Semplice", pt: "Simples",
    nl: "Enkel", ar: "بسيط", zh: "单份", ja: "シングル", ko: "싱글", ru: "Обычный", tr: "Tek", vi: "Don"
  },
  "double": {
    fr: "Double", en: "Double", es: "Doble", de: "Doppelt", it: "Doppio", pt: "Duplo",
    nl: "Dubbel", ar: "دبل", zh: "双份", ja: "ダブル", ko: "더블", ru: "Двойной", tr: "Double", vi: "Doi"
  },
  "triple": {
    fr: "Triple", en: "Triple", es: "Triple", de: "Dreifach", it: "Triplo", pt: "Triplo",
    nl: "Driedubbel", ar: "تريبل", zh: "三份", ja: "トリプル", ko: "트리플", ru: "Тройной", tr: "Üçlü", vi: "Ba"
  },
  "menu": {
    fr: "Menu", en: "Combo Meal", es: "Menu", de: "Menü", it: "Menu", pt: "Menu",
    nl: "Menu", ar: "وجبة", zh: "套餐", ja: "セット", ko: "세트", ru: "Комбо", tr: "Menü", vi: "Set"
  },
  "supplement fromage": {
    fr: "Supplement fromage", en: "Extra Cheese", es: "Suplemento Queso", de: "Extra Käse", it: "Supplemento Formaggio", pt: "Suplemento Queijo",
    nl: "Extra Kaas", ar: "إضافة جبن", zh: "加奶酪", ja: "チーズ追加", ko: "치즈 추가", ru: "Доп. сыр", tr: "Ekstra Peynir", vi: "Them pho mai"
  },
  "supplement viande": {
    fr: "Supplement viande", en: "Extra Meat", es: "Suplemento Carne", de: "Extra Fleisch", it: "Supplemento Carne", pt: "Suplemento Carne",
    nl: "Extra Vlees", ar: "إضافة لحم", zh: "加肉", ja: "肉追加", ko: "고기 추가", ru: "Доп. мясо", tr: "Ekstra Et", vi: "Them thit"
  },
  "supplement sauce": {
    fr: "Supplement sauce", en: "Extra Sauce", es: "Suplemento Salsa", de: "Extra Soße", it: "Supplemento Salsa", pt: "Suplemento Molho",
    nl: "Extra Saus", ar: "إضافة صلصة", zh: "加酱", ja: "ソース追加", ko: "소스 추가", ru: "Доп. соус", tr: "Ekstra Sos", vi: "Them sot"
  },
  "sans oignons": {
    fr: "Sans oignons", en: "No Onions", es: "Sin Cebollas", de: "Ohne Zwiebeln", it: "Senza Cipolle", pt: "Sem Cebolas",
    nl: "Zonder Uien", ar: "بدون بصل", zh: "不加洋葱", ja: "玉ねぎ抜き", ko: "양파 빼기", ru: "Без лука", tr: "Sogansiz", vi: "Khong hanh"
  },
  "sans sauce": {
    fr: "Sans sauce", en: "No Sauce", es: "Sin Salsa", de: "Ohne Soße", it: "Senza Salsa", pt: "Sem Molho",
    nl: "Zonder Saus", ar: "بدون صلصة", zh: "不加酱", ja: "ソース抜き", ko: "소스 빼기", ru: "Без соуса", tr: "Sossuz", vi: "Khong sot"
  },
  "sans tomate": {
    fr: "Sans tomate", en: "No Tomato", es: "Sin Tomate", de: "Ohne Tomate", it: "Senza Pomodoro", pt: "Sem Tomate",
    nl: "Zonder Tomaat", ar: "بدون طماطم", zh: "不加番茄", ja: "トマト抜き", ko: "토마토 빼기", ru: "Без томата", tr: "Domatesiz", vi: "Khong ca chua"
  },
  "barquette": {
    fr: "Barquette", en: "Tray", es: "Bandeja", de: "Schale", it: "Vaschetta", pt: "Bandeja",
    nl: "Bakje", ar: "علبة", zh: "餐盒", ja: "トレイ", ko: "트레이", ru: "Лоток", tr: "Kap", vi: "Hop"
  },
  "assiette": {
    fr: "Assiette", en: "Plate", es: "Plato", de: "Teller", it: "Piatto", pt: "Prato",
    nl: "Bord", ar: "طبق", zh: "盘", ja: "プレート", ko: "플레이트", ru: "Тарелка", tr: "Tabak", vi: "Dia"
  },
  "boissons": {
    fr: "Boissons", en: "Drinks", es: "Bebidas", de: "Getränke", it: "Bevande", pt: "Bebidas",
    nl: "Dranken", ar: "مشروبات", zh: "饮品", ja: "ドリンク", ko: "음료", ru: "Напитки", tr: "Içecekler", vi: "Do uong"
  },
  "desserts": {
    fr: "Desserts", en: "Desserts", es: "Postres", de: "Desserts", it: "Dolci", pt: "Sobremesas",
    nl: "Desserts", ar: "حلويات", zh: "甜点", ja: "デザート", ko: "디저트", ru: "Десерты", tr: "Tatlilar", vi: "Trang mieng"
  },
  "entrees": {
    fr: "Entrees", en: "Starters", es: "Entrantes", de: "Vorspeisen", it: "Antipasti", pt: "Entradas",
    nl: "Voorgerechten", ar: "مقبلات", zh: "前菜", ja: "前菜", ko: "전채", ru: "Закуски", tr: "Baslangiclar", vi: "Mon khai vi"
  },
  "plats": {
    fr: "Plats", en: "Main Courses", es: "Platos", de: "Hauptgerichte", it: "Piatti", pt: "Pratos",
    nl: "Hoofdgerechten", ar: "أطباق", zh: "主菜", ja: "メイン", ko: "메인", ru: "Основные блюда", tr: "Ana Yemekler", vi: "Mon chinh"
  },
  "menus": {
    fr: "Menus", en: "Combo Meals", es: "Menus", de: "Menüs", it: "Menu", pt: "Menus",
    nl: "Menu's", ar: "وجبات", zh: "套餐", ja: "セットメニュー", ko: "세트 메뉴", ru: "Комбо-меню", tr: "Menüler", vi: "Set"
  },
  "divers": {
    fr: "Divers", en: "Miscellaneous", es: "Varios", de: "Sonstiges", it: "Varie", pt: "Diversos",
    nl: "Diversen", ar: "متنوعات", zh: "其他", ja: "その他", ko: "기타", ru: "Разное", tr: "Çesitli", vi: "Khac"
  },
  "supplements": {
    fr: "Supplements", en: "Extras", es: "Suplementos", de: "Extras", it: "Supplementi", pt: "Suplementos",
    nl: "Extra's", ar: "إضافات", zh: "加料", ja: "トッピング", ko: "추가", ru: "Доп. опции", tr: "Ekstralar", vi: "Phu them"
  },
};

// Build a sorted list of keys by length (longest first) for greedy matching
const SORTED_KEYS = Object.keys(MENU_DICT).sort((a, b) => b.length - a.length);

/**
 * Normalize a string for dictionary matching.
 * Lowercases, removes accents, and trims whitespace.
 */
function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[']/g, "'")
    .trim();
}

/**
 * Translate a single term using the dictionary.
 * Returns the translated string, or null if no match is found.
 */
export function translateTerm(term: string, targetLang: string): string | null {
  if (targetLang === "fr") return term;

  const key = normalize(term);
  const entry = MENU_DICT[key];
  if (entry && entry[targetLang]) {
    return entry[targetLang];
  }
  return null;
}

/**
 * Translate a full item name by matching known terms within it.
 * Tries exact match first, then greedy longest-match on substrings.
 * Unknown parts are left as-is.
 */
export function translateMenuText(text: string, targetLang: string): string {
  if (targetLang === "fr") return text;

  // 1. Try exact match on the whole text
  const exactResult = translateTerm(text, targetLang);
  if (exactResult) return exactResult;

  // 2. Greedy matching: scan the normalized text for the longest known keys
  const normalizedText = normalize(text);
  const originalWords = text.split(/\s+/);
  const normalizedWords = normalizedText.split(/\s+/);

  // Track which word indices have been consumed
  const consumed = new Array(normalizedWords.length).fill(false);
  const translations: { start: number; end: number; translated: string }[] = [];

  // Try matching multi-word and single-word keys, longest first
  for (const key of SORTED_KEYS) {
    const keyWords = key.split(/\s+/);
    const keyLen = keyWords.length;

    for (let i = 0; i <= normalizedWords.length - keyLen; i++) {
      // Skip if any word in this range is already consumed
      let alreadyConsumed = false;
      for (let j = i; j < i + keyLen; j++) {
        if (consumed[j]) {
          alreadyConsumed = true;
          break;
        }
      }
      if (alreadyConsumed) continue;

      // Check if the words match
      const slice = normalizedWords.slice(i, i + keyLen).join(" ");
      if (slice === key) {
        const entry = MENU_DICT[key];
        if (entry && entry[targetLang]) {
          for (let j = i; j < i + keyLen; j++) {
            consumed[j] = true;
          }
          translations.push({ start: i, end: i + keyLen, translated: entry[targetLang] });
        }
      }
    }
  }

  // 3. Build the result, preserving original text for unconsumed words
  if (translations.length === 0) return text;

  // Sort translations by start position
  translations.sort((a, b) => a.start - b.start);

  const parts: string[] = [];
  let pos = 0;
  for (const t of translations) {
    // Add any unconsumed words before this translation
    for (let i = pos; i < t.start; i++) {
      parts.push(originalWords[i]);
    }
    parts.push(t.translated);
    pos = t.end;
  }
  // Add remaining unconsumed words
  for (let i = pos; i < originalWords.length; i++) {
    parts.push(originalWords[i]);
  }

  return parts.join(" ");
}
