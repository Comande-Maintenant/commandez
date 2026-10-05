import {cleanup,render} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {MemoryRouter} from 'react-router-dom';
const f=vi.hoisted(()=>({insert:vi.fn().mockResolvedValue({error:null})}));
vi.mock('@/integrations/supabase/client',()=>({supabase:{from:()=>({insert:f.insert})}}));
vi.mock('@/lib/visitorUtils',()=>({getOrCreateVisitorId:()=> 'demo-visitor',detectDevice:()=> 'mobile'}));
import {usePageTracking} from '@/hooks/usePageTracking';
function Probe(){usePageTracking();return null;}
afterEach(()=>{cleanup();vi.clearAllMocks();});
for(const path of ['/decouvrir','/demo/epicerie','/demo/fleuriste','/decouvrir/','/DECOUVRIR','/demo/epicerie/','/demo/fleuriste/','/demo/%65picerie','/demo/%66leuriste','/de%63ouvrir'])it(`keeps ${path} as a local-only demonstration`,()=>{
 render(<MemoryRouter initialEntries={[path]}><Probe/></MemoryRouter>);expect(f.insert).not.toHaveBeenCalled();
});

it('preserves tracking for the normal signup route',()=>{
 render(<MemoryRouter initialEntries={['/inscription']}><Probe/></MemoryRouter>);expect(f.insert).toHaveBeenCalledTimes(1);expect(f.insert).toHaveBeenCalledWith(expect.objectContaining({page_path:'/inscription',page_type:'inscription'}));
});
