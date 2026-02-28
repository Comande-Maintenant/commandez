-- POS Refonte: add dessert_pending column + update customization_config for Antalya Kebab

ALTER TABLE orders ADD COLUMN IF NOT EXISTS dessert_pending boolean DEFAULT false;

-- Update customization_config for Antalya Kebab with the full POS structure
UPDATE restaurants
SET customization_config = '{
  "enabled": true,
  "base_price": 7.50,
  "steps": [
    {
      "id": "base",
      "title": "Base",
      "type": "single",
      "required": true,
      "options": [
        {"id": "sandwich", "name": "Sandwich", "price_modifier": 0, "image": null},
        {"id": "galette", "name": "Galette", "price_modifier": 0, "image": null},
        {"id": "assiette", "name": "Assiette", "price_modifier": 1.50, "image": null},
        {"id": "tacos", "name": "Tacos", "price_modifier": 1.00, "image": null, "allow_multi_meat": true},
        {"id": "burger", "name": "Burger", "price_modifier": 0.50, "image": null},
        {"id": "panini", "name": "Panini", "price_modifier": 0, "image": null},
        {"id": "wrap", "name": "Wrap", "price_modifier": 0, "image": null}
      ]
    },
    {
      "id": "viande",
      "title": "Viande",
      "type": "single_or_multi",
      "required": true,
      "max_selections": 3,
      "options": [
        {"id": "kebab", "name": "Kebab", "price_modifier": 0, "image": null},
        {"id": "poulet", "name": "Poulet", "price_modifier": 0, "image": null},
        {"id": "mixte", "name": "Mixte", "price_modifier": 0.50, "image": null},
        {"id": "merguez", "name": "Merguez", "price_modifier": 0, "image": null},
        {"id": "kefta", "name": "Kefta", "price_modifier": 0, "image": null},
        {"id": "escalope", "name": "Escalope", "price_modifier": 0.50, "image": null},
        {"id": "nuggets", "name": "Nuggets", "price_modifier": 0, "image": null},
        {"id": "falafel", "name": "Falafel", "price_modifier": 0, "image": null},
        {"id": "cordon-bleu", "name": "Cordon Bleu", "price_modifier": 0.50, "image": null}
      ]
    },
    {
      "id": "garniture",
      "title": "Garniture",
      "type": "custom_garniture",
      "required": false,
      "shortcut_label": "Complet",
      "shortcut_sets": {
        "complet": {
          "include": ["salade", "tomate", "oignon", "chou-rouge", "carotte", "mais", "olive"]
        }
      },
      "options": [
        {"id": "salade", "name": "Salade", "price_modifier": 0.50, "image": null},
        {"id": "tomate", "name": "Tomate", "price_modifier": 0.50, "image": null},
        {"id": "oignon", "name": "Oignon", "price_modifier": 0.50, "image": null},
        {"id": "chou-rouge", "name": "Chou rouge", "price_modifier": 0.50, "image": null},
        {"id": "carotte", "name": "Carotte", "price_modifier": 0.50, "image": null},
        {"id": "mais", "name": "Mais", "price_modifier": 0.50, "image": null},
        {"id": "olive", "name": "Olive", "price_modifier": 0.50, "image": null}
      ]
    },
    {
      "id": "sauces",
      "title": "Sauces",
      "type": "multiple",
      "required": false,
      "max_selections": 3,
      "skip_label": "Sans sauce",
      "options": [
        {"id": "blanche", "name": "Blanche", "price_modifier": 0, "image": null},
        {"id": "samourai", "name": "Samourai", "price_modifier": 0, "image": null},
        {"id": "harissa", "name": "Harissa", "price_modifier": 0, "image": null},
        {"id": "biggy", "name": "Biggy", "price_modifier": 0, "image": null},
        {"id": "ketchup", "name": "Ketchup", "price_modifier": 0, "image": null},
        {"id": "mayo", "name": "Mayo", "price_modifier": 0, "image": null},
        {"id": "bbq", "name": "BBQ", "price_modifier": 0, "image": null},
        {"id": "andalouse", "name": "Andalouse", "price_modifier": 0, "image": null}
      ]
    },
    {
      "id": "accompagnement",
      "title": "Accompagnement",
      "type": "single",
      "required": false,
      "skip_label": "Sans accompagnement",
      "options": [
        {
          "id": "frites",
          "name": "Frites",
          "price_modifier": 0,
          "image": null,
          "portion_options": [
            {"id": "normale", "label": "Normale", "price_modifier": 0},
            {"id": "double", "label": "Double", "price_modifier": 2.00}
          ],
          "has_sub_sauce": true
        },
        {
          "id": "ble",
          "name": "Ble / Riz",
          "price_modifier": 0,
          "image": null,
          "portion_options": [
            {"id": "normale", "label": "Normale", "price_modifier": 0},
            {"id": "double", "label": "Double", "price_modifier": 2.00}
          ],
          "has_sub_sauce": false
        }
      ]
    },
    {
      "id": "supplements",
      "title": "Supplements",
      "type": "multiple_with_quantity",
      "required": false,
      "max_qty_per_option": 3,
      "skip_label": "Pas de supplement",
      "options": [
        {"id": "fromage", "name": "Fromage", "price_modifier": 1.00, "image": null},
        {"id": "oeuf", "name": "Oeuf", "price_modifier": 1.00, "image": null},
        {"id": "viande-sup", "name": "Viande sup.", "price_modifier": 2.00, "image": null},
        {"id": "avocat", "name": "Avocat", "price_modifier": 1.50, "image": null}
      ]
    }
  ]
}'::jsonb
WHERE slug = 'moneteau-antalya-kebab';
