import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, MapPin, Share2, Store, Loader2 } from 'lucide-react';
import { BrandLogo } from '@/components/BrandLogo';
import { LanguageSelector } from '@/components/restaurant/LanguageSelector';
import { EntryRoleSwitch } from '@/components/EntryRoleSwitch';
import { useLanguage } from '@/context/LanguageContext';
import { clearEntryRole, readEntryPreference, rememberEntryCity } from '@/lib/entry-preferences';
import { findPublicCommerces, validateCity, type PublicCommerce, type PublicCommerceResult } from '@/services/public-commerces';
import { discoveryUrl, shareAppDiscovery } from '@/services/app-discovery-share';
import '@/components/entry/entry.css';

type SearchState = { kind: 'editing' } | { kind: 'loading' | 'error'; city: string } | { kind: 'loaded'; city: string; result: PublicCommerceResult };
function CommerceCard({ item }: { item: PublicCommerce }) {
  const { t } = useLanguage();
  const [imageFailed, setImageFailed] = useState(false);
  const image = item.cover_image || item.image;
  const kind = ({ restaurant: 'commerce.restaurant', epicerie: 'commerce.grocery', fleuriste: 'commerce.florist' } as Record<string, string>)[item.business_type ?? ''];
  const description = kind ? t(kind) : item.cuisine;
  return <Link to={`/${encodeURIComponent(item.slug)}`} className="entry-commerce">
    <div className="entry-commerce-image">{image && !imageFailed ? <img src={image} alt="" width="320" height="180" loading="lazy" onError={() => setImageFailed(true)} /> : <Store aria-hidden="true" />}</div>
    <div className="entry-commerce-copy"><h2>{item.name}</h2>{description && <p>{description}</p>}<p>{item.city}</p><span>{t('entry.pickup')}<ArrowRight aria-hidden="true" className="h-4 w-4 rtl:rotate-180" /></span></div>
  </Link>;
}
export default function ClientDiscoveryPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [city, setCity] = useState(() => readEntryPreference().city);
  const [invalid, setInvalid] = useState(false);
  const [state, setState] = useState<SearchState>({ kind: 'editing' });
  const [shareState, setShareState] = useState('');
  const [sharing, setSharing] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const requestId = useRef(0);
  const pending = useRef<{ controller: AbortController; timer: ReturnType<typeof setTimeout> } | null>(null);
  const mounted = useRef(true);
  const stop = useCallback(() => {
    requestId.current += 1;
    if (pending.current) { clearTimeout(pending.current.timer); pending.current.controller.abort(); pending.current = null; }
  }, []);
  const search = useCallback((chosen: string) => {
    stop();
    const id = requestId.current;
    const controller = new AbortController();
    setState({ kind: 'loading', city: chosen });
    setShareState('');
    const timer = setTimeout(() => {
      if (id !== requestId.current) return;
      stop(); setState({ kind: 'error', city: chosen });
    }, 12000);
    pending.current = { controller, timer };
    void findPublicCommerces(chosen, controller.signal).then(result => {
      if (id === requestId.current) { clearTimeout(timer); pending.current = null; setState({ kind: 'loaded', city: chosen, result }); }
    }).catch(() => {
      if (id === requestId.current) { clearTimeout(timer); pending.current = null; setState({ kind: 'error', city: chosen }); }
    });
  }, [stop]);
  useEffect(() => {
    mounted.current = true;
    const saved = validateCity(readEntryPreference().city);
    if (saved) search(saved);
    return () => { mounted.current = false; stop(); };
  }, [search, stop]);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const chosen = validateCity(city);
    setInvalid(!chosen);
    if (!chosen) { input.current?.focus(); return; }
    input.current?.blur();
    setCity(chosen); rememberEntryCity(chosen); search(chosen);
  };
  const changeCity = () => { stop(); setState({ kind: 'editing' }); setInvalid(false); setShareState(''); };
  const share = async () => {
    setSharing(true); setShareState('');
    const result = await shareAppDiscovery(t('entry.share_title'), t('entry.share_text'));
    if (!mounted.current) return;
    setSharing(false);
    setShareState(result === 'copied' ? 'entry.share_copied' : result === 'unavailable' ? 'entry.share_unavailable' : '');
  };
  return <div className="entry-page">
    <header className="entry-header"><BrandLogo /><LanguageSelector /></header>
    <nav className="entry-navigation" aria-label={t('entry.change_path')}>
      <button type="button" className="entry-back" onClick={() => { stop(); clearEntryRole(); navigate('/', { state: { chooseRole: true } }); }}><ArrowLeft aria-hidden="true" className="h-4 w-4 rtl:rotate-180" />{t('entry.change_path')}</button>
      <EntryRoleSwitch to="merchant" />
    </nav>
    <main className="entry-city-main">
      {state.kind === 'editing' ? <>
        <h1>{t('entry.city_title')}</h1><p className="entry-city-description">{t('entry.pickup')}</p>
        <form noValidate onSubmit={submit} className="entry-city-form">
          <label htmlFor="entry-city">{t('entry.city_label')}</label>
          <div className="entry-city-input"><MapPin aria-hidden="true" /><input ref={input} id="entry-city" name="city" autoComplete="address-level2" enterKeyHint="search" type="text" maxLength={80} value={city} aria-invalid={invalid} aria-describedby={invalid ? 'entry-city-error' : undefined} onChange={event => { setCity(event.target.value); setInvalid(false); }} /></div>
          {invalid && <p id="entry-city-error" className="entry-field-error" role="alert">{t('entry.city_invalid')}</p>}
          <button type="submit" className="entry-primary">{t('entry.see_shops')}<ArrowRight aria-hidden="true" className="h-5 w-5 rtl:rotate-180" /></button>
        </form>
      </> : <>
        <div className="entry-results-header"><h1>{state.city}</h1><button type="button" onClick={changeCity} className="entry-text-action">{t('entry.change_city')}</button></div>
        <p className="entry-city-description">{t('entry.pickup')}</p>
        <div aria-live="polite" aria-atomic="false">
          {state.kind === 'loading' && <p role="status" className="entry-loading"><Loader2 className="h-5 w-5 animate-spin motion-reduce:animate-none" aria-hidden="true" />{t('entry.loading')}</p>}
          {state.kind === 'error' && <div className="entry-empty"><p role="alert">{t('entry.error')}</p><button type="button" className="entry-primary" onClick={() => search(state.city)}>{t('entry.retry')}</button></div>}
          {state.kind === 'loaded' && (state.result.items.length ? <><div className="entry-commerce-list">{state.result.items.map(item => <CommerceCard key={item.slug} item={item} />)}</div>{state.result.has_more && <p className="entry-city-description">{t('entry.partial')}</p>}</> : <div className="entry-empty">
            <Store className="entry-empty-icon" aria-hidden="true" /><h2>{t('entry.empty_title').replace('{city}', state.city)}</h2>
            <p>{t('entry.empty_description')}</p><p className="entry-fees-note">{t('entry.free_products_note')}</p>
            <button type="button" className="entry-primary" disabled={sharing} onClick={() => { void share(); }}><Share2 className="h-5 w-5" aria-hidden="true" />{t('entry.share_action')}</button>
            <p role="status">{shareState && t(shareState)}</p>{shareState === 'entry.share_unavailable' && <a href={discoveryUrl} className="entry-text-action">{discoveryUrl}</a>}
            <Link to="/decouvrir" className="entry-text-action entry-demo-link">{t('entry.try_demo')}</Link>
          </div>)}
        </div>
      </>}
    </main>
  </div>;
}
