import {expect,test} from '@playwright/test';
test('florist options, gift notes and pickup survive the complete local merchant journey',async({page})=>{
 let writes=0;await page.route('**/rest/v1/**',async route=>{if(route.request().method()!=='GET'){writes++;await route.fulfill({status:400,json:{message:'Local demo only'}});}else await route.continue();});
 await page.goto('/demo/fleuriste?lang=fr',{waitUntil:'networkidle'});
 await expect(page.locator('article')).toHaveCount(8);
 await page.getByRole('button',{name:'Choisir Bouquet de saison',exact:true}).click();
 const sheet=page.getByRole('dialog');await expect(sheet.getByRole('button',{name:'Retour',exact:true})).toBeVisible();
 await sheet.getByRole('radio',{name:/Généreux/}).check();await sheet.getByRole('radio',{name:/Pastel/}).check();await sheet.getByRole('radio',{name:/Papier cadeau/}).check();await sheet.getByLabel('Message pour la carte').fill('Bon anniversaire');
 await sheet.getByRole('button',{name:/Ajouter au panier/}).click();
 await page.getByRole('button',{name:'Choisir Bouquet de saison',exact:true}).click();await sheet.getByRole('button',{name:/Ajouter au panier/}).click();
 await page.getByRole('button',{name:/Voir mon panier/}).click();await expect(sheet.locator('article')).toHaveCount(2);await expect(sheet).toContainText('Bon anniversaire');await sheet.getByRole('radio',{name:'Dans environ 30 min'}).check();await sheet.getByRole('button',{name:/Simuler la commande/}).click();
 const merchant=page.getByRole('region',{name:'Côté commerçant'});await expect(merchant).toContainText('Bon anniversaire');await expect(merchant).toContainText('66,50');
 await page.getByRole('button',{name:'Préparer la commande',exact:true}).click();await page.reload({waitUntil:'networkidle'});await page.getByRole('button',{name:'Marquer comme prête',exact:true}).click();
 const cash=page.locator('#commerce-tab-cash');await expect(cash).toContainText('1');await cash.click();await expect(cash).toHaveAttribute('aria-pressed','true');
 await page.getByRole('radio',{name:'Carte',exact:true}).check();await page.getByRole('button',{name:'Commande retirée',exact:true}).click();await expect(cash).not.toContainText('1');await expect(merchant).toContainText('Encaissement simulé');expect(writes).toBe(0);
});
test('every commerce panel has an exit including empty basket, cash and unavailable products',async({page})=>{
 await page.goto('/demo/epicerie?lang=fr');await page.getByRole('button',{name:'Ajouter Panier de saison',exact:true}).click();const sheet=page.getByRole('dialog');await sheet.getByRole('button',{name:/Ajouter au panier/}).click();
 const basket=page.getByRole('button',{name:/Voir mon panier/});await basket.click();await sheet.getByRole('button',{name:'Diminuer Panier de saison',exact:true}).click();await expect(sheet.getByRole('button',{name:'Retour',exact:true})).toBeVisible();await sheet.getByRole('button',{name:'Continuer mes achats'}).click();await expect(sheet).not.toBeVisible();
 await page.getByRole('button',{name:'Côté commerçant',exact:true}).click();await page.locator('#commerce-tab-cash').click();await expect(page.getByRole('button',{name:'Revenir aux commandes'})).toBeVisible();await page.getByRole('button',{name:'Revenir aux commandes'}).click();
 await page.locator('#commerce-tab-catalog').click();const edit=page.getByRole('button',{name:'Modifier Panier de saison',exact:true});await edit.click();await sheet.getByLabel('Stock de démonstration').fill('0');await sheet.getByRole('button',{name:'Enregistrer les changements'}).click();await expect(edit).toBeFocused();
 await page.getByRole('button',{name:'Côté client',exact:true}).click();await expect(page.getByRole('button',{name:'Ajouter Panier de saison',exact:true})).toBeDisabled();await expect(page.getByRole('link',{name:'Changer de démo',exact:true})).toBeVisible();
});
