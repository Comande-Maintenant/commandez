-- 1. Add customization_config column on restaurants
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS customization_config jsonb DEFAULT NULL;

-- 2. Reorganize categories for demo (Antalya Kebab)
-- Move items to new sub-categories (real item names from DB)
UPDATE public.menu_items SET category = 'Paninis sales' WHERE restaurant_id = 'c236aa92-cab3-4aa1-a337-7767770cb764' AND name IN ('Panini 3 Fromages', 'Panini Poulet Fromage');
UPDATE public.menu_items SET category = 'Galettes' WHERE restaurant_id = 'c236aa92-cab3-4aa1-a337-7767770cb764' AND name IN ('Galette', 'Galette Geante');
UPDATE public.menu_items SET category = 'Burgers' WHERE restaurant_id = 'c236aa92-cab3-4aa1-a337-7767770cb764' AND name IN ('Hamburger', 'Hamburger Double Steack');
UPDATE public.menu_items SET category = 'Paninis sucres' WHERE restaurant_id = 'c236aa92-cab3-4aa1-a337-7767770cb764' AND name IN ('Panini Nutella', 'Panini Speculos');

-- 3. Update restaurant categories list
UPDATE public.restaurants SET categories = ARRAY['Personnalisation','Sandwichs','Paninis sales','Galettes','Burgers','Tacos','Assiettes','Paninis sucres','Boissons','Desserts'] WHERE id = 'c236aa92-cab3-4aa1-a337-7767770cb764';

-- 4. Update category_translations (format: { lang: { catName: translation } })
UPDATE public.restaurants SET category_translations = jsonb_build_object(
  'en', jsonb_build_object('Personnalisation','Customize','Sandwichs','Sandwiches','Paninis sales','Savory Paninis','Galettes','Galettes','Burgers','Burgers','Tacos','Tacos','Assiettes','Platters','Paninis sucres','Sweet Paninis','Boissons','Drinks','Desserts','Desserts'),
  'ar', jsonb_build_object('Personnalisation','تخصيص','Sandwichs','سندويشات','Paninis sales','بانيني مالح','Galettes','غاليت','Burgers','برجر','Tacos','تاكو','Assiettes','أطباق','Paninis sucres','بانيني حلو','Boissons','مشروبات','Desserts','حلويات'),
  'de', jsonb_build_object('Personnalisation','Anpassen','Sandwichs','Sandwiches','Paninis sales','Herzhafte Paninis','Galettes','Galettes','Burgers','Burger','Tacos','Tacos','Assiettes','Teller','Paninis sucres','Suesse Paninis','Boissons','Getranke','Desserts','Desserts'),
  'es', jsonb_build_object('Personnalisation','Personalizar','Sandwichs','Bocadillos','Paninis sales','Paninis salados','Galettes','Galettes','Burgers','Hamburguesas','Tacos','Tacos','Assiettes','Platos','Paninis sucres','Paninis dulces','Boissons','Bebidas','Desserts','Postres'),
  'it', jsonb_build_object('Personnalisation','Personalizza','Sandwichs','Panini','Paninis sales','Panini salati','Galettes','Galette','Burgers','Hamburger','Tacos','Tacos','Assiettes','Piatti','Paninis sucres','Panini dolci','Boissons','Bevande','Desserts','Dolci'),
  'ja', jsonb_build_object('Personnalisation','カスタマイズ','Sandwichs','サンドイッチ','Paninis sales','パニーニ(食事)','Galettes','ガレット','Burgers','バーガー','Tacos','タコス','Assiettes','プレート','Paninis sucres','パニーニ(甘い)','Boissons','ドリンク','Desserts','デザート'),
  'ko', jsonb_build_object('Personnalisation','맞춤','Sandwichs','샌드위치','Paninis sales','짭짤한 파니니','Galettes','갈레트','Burgers','버거','Tacos','타코','Assiettes','플레이트','Paninis sucres','달콤한 파니니','Boissons','음료','Desserts','디저트'),
  'nl', jsonb_build_object('Personnalisation','Aanpassen','Sandwichs','Broodjes','Paninis sales','Hartige Paninis','Galettes','Galettes','Burgers','Burgers','Tacos','Tacos','Assiettes','Borden','Paninis sucres','Zoete Paninis','Boissons','Dranken','Desserts','Desserts'),
  'pt', jsonb_build_object('Personnalisation','Personalizar','Sandwichs','Sanduiches','Paninis sales','Paninis salgados','Galettes','Galettes','Burgers','Hamburgueres','Tacos','Tacos','Assiettes','Pratos','Paninis sucres','Paninis doces','Boissons','Bebidas','Desserts','Sobremesas'),
  'ru', jsonb_build_object('Personnalisation','Настроить','Sandwichs','Сэндвичи','Paninis sales','Панини соленые','Galettes','Галеты','Burgers','Бургеры','Tacos','Такос','Assiettes','Тарелки','Paninis sucres','Панини сладкие','Boissons','Напитки','Desserts','Десерты'),
  'zh', jsonb_build_object('Personnalisation','定制','Sandwichs','三明治','Paninis sales','咸味帕尼尼','Galettes','薄饼','Burgers','汉堡','Tacos','塔可','Assiettes','拼盘','Paninis sucres','甜味帕尼尼','Boissons','饮料','Desserts','甜点')
) WHERE id = 'c236aa92-cab3-4aa1-a337-7767770cb764';

-- 5. Set customization_config for demo
UPDATE public.restaurants SET customization_config = '{
  "enabled": true,
  "base_price": 6.50,
  "steps": [
    {
      "id": "base",
      "title": "Choisissez votre base",
      "title_translations": {"en":"Choose your base","ar":"اختر القاعدة","de":"Wahlen Sie Ihre Basis","es":"Elija su base"},
      "type": "single",
      "required": true,
      "options": [
        {"id":"kebab","name":"Kebab","name_translations":{"en":"Kebab"},"price_modifier":0,"image":null},
        {"id":"durum","name":"Durum (wrap)","name_translations":{"en":"Durum (wrap)"},"price_modifier":1.00,"image":null},
        {"id":"assiette","name":"Assiette","name_translations":{"en":"Platter"},"price_modifier":2.50,"image":null},
        {"id":"frites","name":"Kebab frites","name_translations":{"en":"Kebab with fries"},"price_modifier":1.50,"image":null}
      ]
    },
    {
      "id": "viande",
      "title": "Choisissez votre viande",
      "title_translations": {"en":"Choose your meat","ar":"اختر اللحم","de":"Wahlen Sie Ihr Fleisch","es":"Elija su carne"},
      "type": "single",
      "required": true,
      "options": [
        {"id":"agneau","name":"Agneau","name_translations":{"en":"Lamb"},"price_modifier":0,"image":null},
        {"id":"poulet","name":"Poulet","name_translations":{"en":"Chicken"},"price_modifier":0,"image":null},
        {"id":"mixte","name":"Mixte (agneau + poulet)","name_translations":{"en":"Mixed (lamb + chicken)"},"price_modifier":1.00,"image":null},
        {"id":"falafel","name":"Falafel (vegetarien)","name_translations":{"en":"Falafel (vegetarian)"},"price_modifier":0,"image":null}
      ]
    },
    {
      "id": "garniture",
      "title": "Garnitures",
      "title_translations": {"en":"Toppings","ar":"إضافات","de":"Beilagen","es":"Guarniciones"},
      "type": "multiple",
      "required": false,
      "max_selections": 6,
      "options": [
        {"id":"salade","name":"Salade","name_translations":{"en":"Lettuce"},"price_modifier":0,"image":null},
        {"id":"tomates","name":"Tomates","name_translations":{"en":"Tomatoes"},"price_modifier":0,"image":null},
        {"id":"oignons","name":"Oignons","name_translations":{"en":"Onions"},"price_modifier":0,"image":null},
        {"id":"mais","name":"Mais","name_translations":{"en":"Corn"},"price_modifier":0,"image":null},
        {"id":"chou","name":"Chou rouge","name_translations":{"en":"Red cabbage"},"price_modifier":0,"image":null},
        {"id":"fromage","name":"Fromage","name_translations":{"en":"Cheese"},"price_modifier":0.50,"image":null}
      ]
    },
    {
      "id": "sauce",
      "title": "Sauces",
      "title_translations": {"en":"Sauces","ar":"صلصات","de":"Saucen","es":"Salsas"},
      "type": "multiple",
      "required": false,
      "max_selections": 3,
      "options": [
        {"id":"blanche","name":"Blanche","name_translations":{"en":"White"},"price_modifier":0,"image":null},
        {"id":"samourai","name":"Samourai","name_translations":{"en":"Samurai"},"price_modifier":0,"image":null},
        {"id":"algerienne","name":"Algerienne","name_translations":{"en":"Algerian"},"price_modifier":0,"image":null},
        {"id":"harissa","name":"Harissa","name_translations":{"en":"Harissa"},"price_modifier":0,"image":null},
        {"id":"ketchup","name":"Ketchup","name_translations":{"en":"Ketchup"},"price_modifier":0,"image":null},
        {"id":"barbecue","name":"Barbecue","name_translations":{"en":"BBQ"},"price_modifier":0,"image":null}
      ]
    },
    {
      "id": "supplement",
      "title": "Supplements",
      "title_translations": {"en":"Extras","ar":"إضافات","de":"Extras","es":"Extras"},
      "type": "multiple",
      "required": false,
      "options": [
        {"id":"double_viande","name":"Double viande","name_translations":{"en":"Double meat"},"price_modifier":2.50,"image":null},
        {"id":"frites_sup","name":"Portion frites","name_translations":{"en":"Fries"},"price_modifier":2.00,"image":null},
        {"id":"boisson_sup","name":"Boisson","name_translations":{"en":"Drink"},"price_modifier":1.50,"image":null}
      ]
    }
  ]
}'::jsonb WHERE id = 'c236aa92-cab3-4aa1-a337-7767770cb764';
