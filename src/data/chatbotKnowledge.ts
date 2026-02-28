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
    question: "Comment gerer ma carte ?",
    answer: "Allez dans Gerer > Ma Carte. Vous pouvez ajouter, modifier ou supprimer des plats, changer les prix, reorganiser les categories par glisser-deposer, et gerer les photos.",
    action: { label: "Aller a Ma Carte", view: "carte" },
  },
  {
    keywords: ["rupture", "indisponible", "desactiver", "activer", "stock"],
    question: "Comment mettre un plat en rupture ?",
    answer: "Depuis la vue Cuisine, cliquez sur le bouton 'Ruptures' en haut a droite. Vous pouvez activer ou desactiver chaque plat avec un simple toggle. Les plats en rupture n'apparaissent plus pour les clients.",
    action: { label: "Aller a la Cuisine", view: "cuisine" },
  },
  {
    keywords: ["supplement", "sauce", "option", "personnalisation", "garniture"],
    question: "Comment ajouter des supplements ou sauces ?",
    answer: "Modifiez un plat dans Ma Carte, puis utilisez la section Supplements et Sauces. Vous pouvez definir des noms, prix, et les rendre optionnels ou obligatoires.",
    action: { label: "Aller a Ma Carte", view: "carte" },
  },
  // Commandes
  {
    keywords: ["commande", "nouvelle", "accepter", "preparer", "prete", "terminer", "status"],
    question: "Comment gerer les commandes ?",
    answer: "Les commandes arrivent dans la vue Cuisine. Cliquez sur 'Accepter' pour commencer la preparation, 'Prete' quand c'est fait, puis 'Terminee' quand le client a recupere. Le son de notification vous alerte a chaque nouvelle commande.",
    action: { label: "Aller a la Cuisine", view: "cuisine" },
  },
  {
    keywords: ["annuler", "rembourser", "probleme", "erreur"],
    question: "Comment annuler une commande ?",
    answer: "Pour l'instant, vous pouvez passer directement la commande en 'Terminee'. Le paiement se fait sur place, donc pas de remboursement en ligne. Contactez le client par telephone si besoin.",
  },
  {
    keywords: ["son", "notification", "alerte", "bruit", "sonnerie"],
    question: "Comment configurer le son des notifications ?",
    answer: "Cliquez sur l'icone son en haut a droite quand vous etes sur Cuisine, Caisse ou En direct. Sur mobile, appuyez d'abord sur la banniere 'Activer le son'. Vous pouvez changer la sonnerie dans Parametres.",
    action: { label: "Aller aux Parametres", view: "parametres" },
  },
  // QR codes
  {
    keywords: ["qr", "code", "qrcode", "imprimer", "table", "telecharger"],
    question: "Comment generer mes QR codes ?",
    answer: "Allez dans Gerer > QR Codes. Vous pouvez generer un QR code unique pour votre restaurant, le telecharger en haute resolution, et l'imprimer pour vos tables ou votre vitrine.",
    action: { label: "Aller aux QR Codes", view: "qrcodes" },
  },
  // Horaires
  {
    keywords: ["horaire", "heure", "ouverture", "fermeture", "disponible", "indisponible", "ouvrir", "fermer"],
    question: "Comment configurer mes horaires ?",
    answer: "Allez dans Gerer > Parametres. Vous pouvez definir vos horaires d'ouverture par jour de la semaine. Le mode 'Toujours ouvert' permet de recevoir des commandes 24/7. Le toggle Disponible/Indisponible en haut permet de couper instantanement.",
    action: { label: "Aller aux Parametres", view: "parametres" },
  },
  // Page / apparence
  {
    keywords: ["couleur", "logo", "image", "photo", "apparence", "design", "page", "couverture"],
    question: "Comment personnaliser l'apparence de ma page ?",
    answer: "Allez dans Gerer > Ma Page. Vous pouvez changer le logo, la photo de couverture, la couleur principale, la description, l'adresse et le telephone. Les changements sont visibles immediatement.",
    action: { label: "Aller a Ma Page", view: "page" },
  },
  // Ban / clients
  {
    keywords: ["ban", "bannir", "bloquer", "client", "interdit", "debannir"],
    question: "Comment bannir un client ?",
    answer: "Deux methodes : (1) Depuis une commande dans la vue Cuisine, cliquez sur l'icone bouclier a cote du nom. (2) Depuis Gerer > Mes clients, trouvez le client et cliquez sur Bannir. Vous pouvez choisir une duree (7j, 30j ou permanent) et ajouter une raison.",
    action: { label: "Aller a Mes clients", view: "clients" },
  },
  // Tablettes
  {
    keywords: ["tablette", "tablet", "appareil", "ecran", "ipad"],
    question: "Comment configurer une tablette ?",
    answer: "Allez dans Gerer > Mes tablettes. Ajoutez une tablette avec son numero de serie et son usage (cuisine, caisse, service client). La tablette accede au meme tableau de bord que votre telephone.",
    action: { label: "Aller aux Tablettes", view: "tablettes" },
  },
  // Caisse
  {
    keywords: ["caisse", "pos", "encaisser", "paiement", "espece", "cb", "carte"],
    question: "Comment utiliser la caisse ?",
    answer: "La vue Caisse permet de prendre des commandes manuellement (telephone, sur place). Selectionnez les plats, le type de commande et validez. Ideal pour les commandes par telephone ou sur place.",
    action: { label: "Aller a la Caisse", view: "caisse" },
  },
  // En direct
  {
    keywords: ["direct", "visiteur", "temps", "reel", "qui", "connecte", "affluence"],
    question: "Comment voir les visiteurs en temps reel ?",
    answer: "La vue En direct montre qui est sur votre page en ce moment. Vous voyez leur panier, leur appareil, et des alertes (grosse commande, hesitation, rush). Utile pour anticiper la charge.",
    action: { label: "Aller a En direct", view: "en-direct" },
  },
  // Stats
  {
    keywords: ["statistique", "stats", "chiffre", "affaire", "analyse", "performance", "panier"],
    question: "Comment voir mes statistiques ?",
    answer: "Allez dans Gerer > Statistiques. Vous verrez le CA, nombre de commandes, panier moyen, top plats, heure de pointe, et des previsions de demande. Filtrez par jour, semaine ou mois.",
    action: { label: "Aller aux Statistiques", view: "stats" },
  },
  // Paiement
  {
    keywords: ["paiement", "payer", "regler", "methode", "moyen"],
    question: "Comment configurer les moyens de paiement ?",
    answer: "Allez dans Parametres. Vous pouvez activer Carte bancaire, Especes et Ticket restaurant. Note : les paiements se font sur place, pas en ligne. Les moyens affiches sont informatifs pour les clients.",
    action: { label: "Aller aux Parametres", view: "parametres" },
  },
  // Abonnement
  {
    keywords: ["abonnement", "prix", "tarif", "gratuit", "plan", "offre", "facturation"],
    question: "Combien coute Commandez ?",
    answer: "Commandez est actuellement gratuit pendant la phase de lancement. Aucun frais cache, aucune commission sur les commandes. Nous vous previendrons avant tout changement de tarification.",
  },
  // Desactivation
  {
    keywords: ["desactiver", "supprimer", "fermer", "compte", "restaurant", "pause"],
    question: "Comment desactiver mon restaurant ?",
    answer: "Utilisez le toggle Disponible/Indisponible en haut du dashboard pour mettre en pause temporairement. Pour une desactivation longue, contactez-nous a contact@commandemaintenant.com.",
  },
  // Contact / aide
  {
    keywords: ["contact", "aide", "support", "probleme", "bug", "email"],
    question: "Comment contacter le support ?",
    answer: "Envoyez un email a contact@commandemaintenant.com. Nous repondons generalement sous 24h. Decrivez votre probleme avec le nom de votre restaurant pour un traitement plus rapide.",
  },
  // Guide
  {
    keywords: ["guide", "tutorial", "tuto", "comment", "commencer", "debut", "onboarding"],
    question: "Comment revoir le guide de demarrage ?",
    answer: "Le guide vous presente les sections principales du dashboard. Cliquez sur 'Revoir le guide' ci-dessous pour le relancer.",
    action: { label: "Revoir le guide", view: "__onboarding__" },
  },
  // Langues
  {
    keywords: ["langue", "traduction", "traduire", "anglais", "arabe", "chinois"],
    question: "Mon menu est-il traduit automatiquement ?",
    answer: "Les noms de categories peuvent etre traduits dans 12 langues via Ma Carte. Les noms de plats gardent leur version originale. Les clients peuvent changer la langue de l'interface depuis la page de votre restaurant.",
  },
  // Commande ajout
  {
    keywords: ["ajouter", "article", "item", "pendant", "encours", "modifier commande"],
    question: "Comment ajouter un article a une commande en cours ?",
    answer: "Depuis la vue Cuisine, sur une commande Nouvelle ou En cours, cliquez sur le bouton '+ Ajouter' en bas de la commande. Selectionnez l'article a ajouter et validez.",
    action: { label: "Aller a la Cuisine", view: "cuisine" },
  },
];
