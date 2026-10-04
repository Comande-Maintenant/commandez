/** Preserve a merchant's hue with readable white text and warm menu surfaces. */
export function withReadableWhiteText(hex:string):string {
  const expanded=/^#[\da-f]{3}$/i.test(hex)?'#'+hex.slice(1).split('').map(x=>x+x).join(''):hex;
  if(!/^#[\da-f]{6}$/i.test(expanded)) return '#187A26';
  const channels=[1,3,5].map(index=>parseInt(expanded.slice(index,index+2),16));
  const luminance=(rgb:number[])=>rgb.map(value=>{
    const s=value/255;return s<=.04045?s/12.92:((s+.055)/1.055)**2.4;
  }).reduce((sum,value,index)=>sum+value*[.2126,.7152,.0722][index],0);
  // 4.8 against white also leaves 4.5 for text on the menu's #FFF8F0 surface.
  const readable=(rgb:number[])=>1.05/(luminance(rgb)+.05)>=4.8;
  if(readable(channels)) return expanded;
  // Search darker shades in deterministic, bounded integer steps.
  for(let step=1;step<=255;step++) {
    const shade=channels.map(value=>Math.floor(value*(255-step)/255));
    if(readable(shade)) return '#'+shade.map(value=>value.toString(16).padStart(2,'0')).join('');
  }
  return '#000000';
}
