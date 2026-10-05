import React from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter} from 'react-router-dom';
import {LanguageProvider} from '../../src/context/LanguageContext';
import {MerchantSetup} from '../../src/components/dashboard/MerchantSetup';
import type {DbRestaurant} from '../../src/types/database';
import '../../src/index.css';
const restaurant={id:'fixture-restaurant',slug:'fixture-restaurant',owner_id:'fixture-owner'} as DbRestaurant;
createRoot(document.getElementById('root')!).render(<BrowserRouter><LanguageProvider><main className="p-4"><MerchantSetup restaurant={restaurant} ownerUserId="fixture-owner" onNavigate={view=>{document.getElementById('destination')!.textContent=view;}}/><p id="destination" role="status"/></main></LanguageProvider></BrowserRouter>);
