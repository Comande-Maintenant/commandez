export interface ChatbotEntry {
  keywords: string[];
  question: string;
  answer: string;
  action?: { label: string; view: string };
}

export const chatbotKnowledge: ChatbotEntry[] = [
  // Carte / menu
  {
    keywords: ["carte", "menu", "plat", "plats", "ajouter", "modifier", "supprimer", "prix", "categorie"],
    question: "Comment gérer ma carte ?",
    answer: "Allez dans Gérer > Ma Carte. Vous pouvez ajouter, modifier ou supprimer des plats, changer les prix, réorganiser les catégories par glisser-déposer, et gérer les photos.",
    action: { label: "Aller à Ma Carte", view: "carte" },
  },
  {
    keywords: ["rupture", "indisponible", "désactiver", "activer", "stock"],
    question: "Comment mettre un plat en rupture ?",
    answer: "Depuis la vue Cuisine, cliquez sur le bouton 'Ruptures' en haut à droite. Vous pouvez activer ou désactiver chaque plat avec un simple toggle. Les plats en rupture n'apparaissent plus pour les clients.",
    action: { label: "Aller à la Cuisine", view: "cuisine" },
  },
  {
    keywords: ["supplement", "sauce", "option", "personnalisation", "garniture"],
    question: "Comment ajouter des suppléments ou sauces ?",
    answer: "Modifiez un plat dans Ma Carte, puis utilisez la section Suppléments et Sauces. Vous pouvez définir des noms, prix, et les rendre optionnels ou obligatoires.",
    action: { label: "Aller à Ma Carte", view: "carte" },
  },
  // Commandes
  {
    keywords: ["commande", "nouvelle", "accepter", "preparer", "prete", "terminer", "status"],
    question: "Comment gérer les commandes ?",
    answer: "Les commandes arrivent dans la vue Cuisine. Cliquez sur 'Accepter' pour commencer la préparation, 'Prête' quand c'est fait, puis 'Terminée' quand le client a récupéré. Le son de notification vous alerte à chaque nouvelle commande.",
    action: { label: "Aller à la Cuisine", view: "cuisine" },
  },
  {
    keywords: ["annuler", "rembourser", "problème", "erreur"],
    question: "Comment annuler une commande ?",
    answer: "Pour l'instant, vous pouvez passer directement la commande en 'Terminée'. Le paiement se fait sur place, donc pas de remboursement en ligne. Contactez le client par téléphone si besoin.",
  },
  {
    keywords: ["son", "notification", "alerte", "bruit", "sonnerie"],
    question: "Comment configurer le son des notifications ?",
    answer: "Cliquez sur l'icône son en haut à droite quand vous êtes sur Cuisine, Caisse ou En direct. Sur mobile, appuyez d'abord sur la bannière 'Activer le son'. Vous pouvez changer la sonnerie dans Paramètres.",
    action: { label: "Aller aux Paramètres", view: "parametres" },
  },
  // QR codes
  {
    keywords: ["qr", "code", "qrcode", "imprimer", "table", "telecharger"],
    question: "Comment générer mes QR codes ?",
    answer: "Allez dans Gérer > QR Codes. Vous pouvez générer un QR code unique pour votre restaurant, le télécharger en haute résolution, et l'imprimer pour vos tables ou votre vitrine.",
    action: { label: "Aller aux QR Codes", view: "qrcodes" },
  },
  // Horaires
  {
    keywords: ["horaire", "heure", "ouverture", "fermeture", "disponible", "indisponible", "ouvrir", "fermer"],
    question: "Comment configurer mes horaires ?",
    answer: "Allez dans Gérer > Paramètres. Vous pouvez définir vos horaires d'ouverture par jour de la semaine. Le mode 'Toujours ouvert' permet de recevoir des commandes 24/7. Le toggle Disponible/Indisponible en haut permet de couper instantanément.",
    action: { label: "Aller aux Paramètres", view: "parametres" },
  },
  // Page / apparence
  {
    keywords: ["couleur", "logo", "image", "photo", "apparence", "design", "page", "couverture"],
    question: "Comment personnaliser l'apparence de ma page ?",
    answer: "Allez dans Gérer > Ma Page. Vous pouvez changer le logo, la photo de couverture, la couleur principale, la description, l'adresse et le téléphone. Les changements sont visibles immédiatement.",
    action: { label: "Aller à Ma Page", view: "page" },
  },
  // Ban / clients
  {
    keywords: ["ban", "bannir", "bloquer", "client", "interdit", "debannir"],
    question: "Comment bannir un client ?",
    answer: "Deux méthodes : (1) Depuis une commande dans la vue Cuisine, cliquez sur l'icône bouclier à côté du nom. (2) Depuis Gérer > Mes clients, trouvez le client et cliquez sur Bannir. Vous pouvez choisir une durée (7j, 30j ou permanent) et ajouter une raison.",
    action: { label: "Aller à Mes clients", view: "clients" },
  },
  // Borne client
  {
    keywords: ["tablette", "tablet", "appareil", "ecran", "ipad", "borne", "kiosk"],
    question: "Comment configurer une borne ou tablette client ?",
    answer: "Allez dans Gérer > Borne client. Configurez les modes (sur place, emporter), activez le kiosk et scannez le QR code depuis la tablette.",
    action: { label: "Aller à la Borne", view: "borne" },
  },
  // Caisse
  {
    keywords: ["caisse", "pos", "encaisser", "paiement", "espèce", "cb", "carte"],
    question: "Comment utiliser la caisse ?",
    answer: "La vue Caisse permet de prendre des commandes manuellement (téléphone, sur place). Sélectionnez les plats, le type de commande et validez. Idéal pour les commandes par téléphone ou sur place.",
    action: { label: "Aller à la Caisse", view: "caisse" },
  },
  // En direct
  {
    keywords: ["direct", "visiteur", "temps", "reel", "qui", "connecte", "affluence"],
    question: "Comment voir les visiteurs en temps réel ?",
    answer: "La vue En direct montre qui est sur votre page en ce moment. Vous voyez leur panier, leur appareil, et des alertes (grosse commande, hésitation, rush). Utile pour anticiper la charge.",
    action: { label: "Aller à En direct", view: "en-direct" },
  },
  // Stats
  {
    keywords: ["statistique", "stats", "chiffre", "affaire", "analyse", "performance", "panier"],
    question: "Comment voir mes statistiques ?",
    answer: "Allez dans Gérer > Statistiques. Vous verrez le CA, nombre de commandes, panier moyen, top plats, heure de pointe, et des prévisions de demande. Filtrez par jour, semaine ou mois.",
    action: { label: "Aller aux Statistiques", view: "stats" },
  },
  // Paiement
  {
    keywords: ["paiement", "payer", "regler", "methode", "moyen"],
    question: "Comment configurer les moyens de paiement ?",
    answer: "Allez dans Paramètres. Vous pouvez activer Carte bancaire, Espèces et Ticket restaurant. Note : les paiements se font sur place, pas en ligne. Les moyens affichés sont informatifs pour les clients.",
    action: { label: "Aller aux Paramètres", view: "parametres" },
  },
  // Abonnement
  {
    keywords: ["abonnement", "prix", "tarif", "gratuit", "plan", "offre", "facturation"],
    question: "Combien coûte commandeici ?",
    answer: "commandeici, c'est 1 EUR/mois pendant 3 mois, puis 29,99 EUR/mois. Sans engagement, tu arretes quand tu veux. 0% de commission sur les commandes.",
  },
  // Desactivation
  {
    keywords: ["désactiver", "supprimer", "fermer", "compte", "restaurant", "pause"],
    question: "Comment désactiver mon restaurant ?",
    answer: "Utilisez le toggle Disponible/Indisponible en haut du dashboard pour mettre en pause temporairement. Pour une désactivation longue, contactez-nous à contact@commandeici.com.",
  },
  // Contact / aide
  {
    keywords: ["contact", "aide", "support", "problème", "bug", "email"],
    question: "Comment contacter le support ?",
    answer: "Envoyez un email à contact@commandeici.com. Nous répondons généralement sous 24h. Décrivez votre problème avec le nom de votre restaurant pour un traitement plus rapide.",
  },
  // Guide
  {
    keywords: ["guide", "tutorial", "tuto", "comment", "commencer", "debut", "onboarding"],
    question: "Comment revoir le guide de démarrage ?",
    answer: "Le guide vous présente les sections principales du dashboard. Cliquez sur 'Revoir le guide' ci-dessous pour le relancer.",
    action: { label: "Revoir le guide", view: "__onboarding__" },
  },
  // Langues
  {
    keywords: ["langue", "traduction", "traduire", "anglais", "arabe", "chinois"],
    question: "Mon menu est-il traduit automatiquement ?",
    answer: "Les noms de catégories peuvent être traduits dans 12 langues via Ma Carte. Les noms de plats gardent leur version originale. Les clients peuvent changer la langue de l'interface depuis la page de votre restaurant.",
  },
  // Commande ajout
  {
    keywords: ["ajouter", "article", "item", "pendant", "encours", "modifier commande"],
    question: "Comment ajouter un article à une commande en cours ?",
    answer: "Depuis la vue Cuisine, sur une commande Nouvelle ou En cours, cliquez sur le bouton '+ Ajouter' en bas de la commande. Sélectionnez l'article à ajouter et validez.",
    action: { label: "Aller à la Cuisine", view: "cuisine" },
  },
];
