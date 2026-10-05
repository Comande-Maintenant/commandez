import {expect,it} from 'vitest';
import {withReadableWhiteText} from '@/lib/color-contrast';

function whiteContrast(hex:string) {
  const rgb=[1,3,5].map(index=>parseInt(hex.slice(index,index+2),16)/255);
  const luminance=rgb.map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4).reduce((sum,x,i)=>sum+x*[.2126,.7152,.0722][i],0);
  return 1.05/(luminance+.05);
}
it('preserves already readable brand colors exactly',()=>{
  for(const color of ['#187A26','#000000','#047857','#2563eb','#b91c1c'])expect(withReadableWhiteText(color)).toBe(color);
});
it('keeps white text readable across light and saturated merchant palettes',()=>{
  for(const r of [0,32,64,96,128,160,192,224,255])for(const g of [0,32,64,96,128,160,192,224,255])for(const b of [0,32,64,96,128,160,192,224,255]) {
    const input='#'+[r,g,b].map(x=>x.toString(16).padStart(2,'0')).join('');
    const output=withReadableWhiteText(input);
    expect(whiteContrast(output),input).toBeGreaterThanOrEqual(4.8);
    expect(withReadableWhiteText(output)).toBe(output);
  }
});
it('supports shorthand colors and keeps their channel order',()=>{
  expect(withReadableWhiteText('#000')).toBe('#000000');
  const output=withReadableWhiteText('#ff0');expect(whiteContrast(output)).toBeGreaterThanOrEqual(4.5);expect(output.slice(1,3)).toBe(output.slice(3,5));expect(output.slice(5)).toBe('00');
});
it('falls back to the readable brand color for malformed persisted values',()=>{
  for(const color of ['','yellow','#gggggg','#abcd','rgb(255,255,0)'])expect(withReadableWhiteText(color)).toBe('#187A26');
});
