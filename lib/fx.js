// Shared helpers for Jonnie's Game Room 3D games
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export function makeStore(prefix){return{get(k,d){try{const v=localStorage.getItem(prefix+k);return v?JSON.parse(v):d}catch(e){return d}},set(k,v){try{localStorage.setItem(prefix+k,JSON.stringify(v))}catch(e){}}}}

// Renderer + bloom with automatic quality drop on slow phones
export function makeRenderer(canvas,{bloom=.55,radius=.5,threshold=.82,exposure=.6}={}){
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
  let pr=Math.min(window.devicePixelRatio||1,1.75);renderer.setPixelRatio(pr);
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=exposure;
  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(62,1,0.1,20000);
  const composer=new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene,camera));
  const bloomPass=new UnrealBloomPass(new THREE.Vector2(256,256),bloom,radius,threshold);
  composer.addPass(bloomPass);composer.addPass(new OutputPass());
  let useComposer=true;
  function resize(){const w=innerWidth,h=innerHeight;renderer.setSize(w,h,false);composer.setPixelRatio(pr);composer.setSize(w,h);bloomPass.resolution.set(w/2,h/2);camera.aspect=w/h;camera.updateProjectionMatrix()}
  addEventListener('resize',resize);resize();
  // adaptive quality
  let acc=0,frames=0,level=0;
  function quality(dt){acc+=dt;frames++;if(acc>2.5){const avg=acc/frames;acc=0;frames=0;
    if(avg>1/34&&level<3){level++;
      if(level===1){pr=Math.min(pr,1.25);renderer.setPixelRatio(pr);resize()}
      else if(level===2){pr=1;renderer.setPixelRatio(pr);renderer.shadowMap.enabled=false;scene.traverse(o=>{if(o.material)o.material.needsUpdate=true});resize()}
      else if(level===3){useComposer=false}}}}
  function render(dt){quality(dt);if(useComposer)composer.render();else renderer.render(scene,camera)}
  return{renderer,scene,camera,composer,bloomPass,render,resize,get quality(){return level}};
}

// value noise + fbm
function hash(x,z){const s=Math.sin(x*127.1+z*311.7)*43758.5453;return s-Math.floor(s)}
export function noise(x,z){const xi=Math.floor(x),zi=Math.floor(z),xf=x-xi,zf=z-zi,u=xf*xf*(3-2*xf),v=zf*zf*(3-2*zf);
  const a=hash(xi,zi),b=hash(xi+1,zi),c=hash(xi,zi+1),d=hash(xi+1,zi+1);return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v}
export function fbm(x,z,o=4){let s=0,a=.5,f=1;for(let i=0;i<o;i++){s+=a*noise(x*f,z*f);f*=2.03;a*=.5}return s/(1-Math.pow(.5,o))}

export function canvasTex(w,h,draw,{repeat=[1,1],srgb=true}={}){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(...repeat);if(srgb)t.colorSpace=THREE.SRGBColorSpace;return t}
export const softTex=(inner='rgba(255,255,255,1)',outer='rgba(255,255,255,0)')=>canvasTex(64,64,(g,w,h)=>{const r=g.createRadialGradient(32,32,0,32,32,32);r.addColorStop(0,inner);r.addColorStop(1,outer);g.fillStyle=r;g.fillRect(0,0,w,h)});

export const std=(c,o={})=>new THREE.MeshStandardMaterial({color:c,roughness:.6,...o});
export function box(w,h,d,mat,x=0,y=0,z=0){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);return m}
export function shadowAll(o,cast=true,recv=true){o.traverse(m=>{if(m.isMesh){m.castShadow=cast;m.receiveShadow=recv}});return o}

export function banner(el,text,ms=1800){el.textContent=text;el.classList.add('show');clearTimeout(el._h);el._h=setTimeout(()=>el.classList.remove('show'),ms)}
export function vibrate(ms){try{navigator.vibrate&&navigator.vibrate(ms)}catch(e){}}

// Virtual joystick on a touch region. Returns live {x,y,active} in -1..1
export function joystick(el,{radius=60,onStart,onEnd}={}){const st={x:0,y:0,active:false,id:null,ox:0,oy:0};
  const knob=document.createElement('div'),base=document.createElement('div');
  Object.assign(base.style,{position:'fixed',width:radius*2+'px',height:radius*2+'px',borderRadius:'50%',border:'2px solid rgba(255,255,255,.25)',background:'rgba(255,255,255,.06)',pointerEvents:'none',display:'none',zIndex:4,backdropFilter:'blur(4px)'});
  Object.assign(knob.style,{position:'fixed',width:'54px',height:'54px',borderRadius:'50%',background:'rgba(255,255,255,.35)',boxShadow:'0 4px 14px rgba(0,0,0,.4)',pointerEvents:'none',display:'none',zIndex:4});
  document.body.append(base,knob);
  const place=(x,y)=>{knob.style.left=x-27+'px';knob.style.top=y-27+'px'};
  el.addEventListener('touchstart',e=>{for(const t of e.changedTouches){if(st.id!==null)break;st.id=t.identifier;st.ox=t.clientX;st.oy=t.clientY;st.active=true;st.x=st.y=0;
    base.style.left=st.ox-radius+'px';base.style.top=st.oy-radius+'px';base.style.display=knob.style.display='block';place(st.ox,st.oy);onStart&&onStart()}e.preventDefault()},{passive:false});
  el.addEventListener('touchmove',e=>{for(const t of e.changedTouches){if(t.identifier!==st.id)continue;let dx=t.clientX-st.ox,dy=t.clientY-st.oy;const L=Math.hypot(dx,dy);if(L>radius){dx*=radius/L;dy*=radius/L}st.x=dx/radius;st.y=dy/radius;place(st.ox+dx,st.oy+dy)}e.preventDefault()},{passive:false});
  const end=e=>{for(const t of e.changedTouches){if(t.identifier!==st.id)continue;st.id=null;st.active=false;st.x=st.y=0;base.style.display=knob.style.display='none';onEnd&&onEnd()}};
  el.addEventListener('touchend',end);el.addEventListener('touchcancel',end);
  return st}

// Keep the physical Sky from blowing out the bloom: clamp its brightness
export function tameSky(sky,cap=1.5){const m=sky.material;m.uniforms.skyCap={value:cap};
  m.fragmentShader=m.fragmentShader.replace('gl_FragColor = vec4( texColor, 1.0 );','float skyM = max( max( texColor.r, texColor.g ), max( texColor.b, 1e-4 ) ); gl_FragColor = vec4( texColor * min( 1.0, skyCap / skyM ), 1.0 );');m.fragmentShader='uniform float skyCap;\n'+m.fragmentShader;
  m.needsUpdate=true;return m.uniforms.skyCap}
