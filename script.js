// ════════════════════════════════════════
// Constants
// ════════════════════════════════════════
const SHEET_MM   = {A4:[210,297],A3:[297,420],A2:[420,594],A1:[594,841],A0:[841,1189]};
const BASE_PPMM  = 3.7795;
const UNIT_MM    = {mm:1,cm:10,m:1000,in:25.4,ft:304.8,px:null};
const ZSTEPS     = [5,8,12,17,25,33,50,67,75,90,100,110,125,150,175,200,250,300,400,500];
const PAL        = ['#E24B4A','#D85A30','#EFA827','#3D8B37','#1D9E75','#1558a8','#7F77DD','#D4537E','#666','#111','#0D47A1','#4B0082'];
const GROUPS     = {metric:['mm','cm','m'],imperial:['in','ft'],pixel:['px']};
const SH_NAMES   = {triangle:'Triangle',line:'Line',curve:'Curve',rect:'Rectangle',square:'Square',circle:'Circle',ellipse:'Ellipse',pentagon:'Pentagon',hexagon:'Hexagon',arrow:'Arrow',star:'Star',dimension:'Dimension'};
const LAYER_COLS = ['#1558a8','#c0392b','#27ae60','#8e44ad','#e67e22','#16a085','#2c3e50','#d35400'];
const HANDLE_CURSORS = ['nw-resize','n-resize','ne-resize','e-resize','se-resize','s-resize','sw-resize','w-resize'];

// ════════════════════════════════════════
// DOM
// ════════════════════════════════════════
const sc          = document.getElementById('sc');
const ctx         = sc.getContext('2d');
const vp          = document.getElementById('vp');
const sheetHost   = document.getElementById('sheet-host');
const handleLayer = document.getElementById('handle-layer');
const selBox      = document.getElementById('sel-box');
const rhEl        = document.getElementById('rh');
const rvEl        = document.getElementById('rv');
const rhOut       = document.getElementById('rh-out');
const rvOut       = document.getElementById('rv-out');
const ctxH        = rhEl.getContext('2d');
const ctxV        = rvEl.getContext('2d');
const coordBadge  = document.getElementById('coord-badge');
const snapBadge   = document.getElementById('snap-badge');
const multiBadge  = document.getElementById('multi-badge');
const ctxMenu     = document.getElementById('ctx-menu');

// ════════════════════════════════════════
// Layers
// ════════════════════════════════════════
let layerCounter = 0;
function makeLayer(name,color){ return{id:++layerCounter,name,color:color||LAYER_COLS[(layerCounter-1)%LAYER_COLS.length],visible:true,locked:false}; }

// ════════════════════════════════════════
// State
// ════════════════════════════════════════
const A = {
  shape:'triangle', color:'#1558a8', fill:'filled', stroke:2,
  shapes:[], layers:[makeLayer('Layer 1')], activeLayerId:1,
  // selection
  sel:null,           // single selected index (null when multi-select active)
  multiSel:[],        // array of indices when multiple selected
  hovIdx:-1,          // index of shape currently under mouse (for highlight)
  // drawing
  isDrawing:false, dragSh:null, dragX1:0, dragY1:0,
  // moving (works for both single and multi)
  isMoving:false, movDX:0, movDY:0, movOrigins:[],
  // rubber-band selection drag
  isSelecting:false, selX1:0, selY1:0,
  // resize / rotate
  isResizing:false, resizeHandle:-1, resizeOrigSh:null, resizeStartX:0, resizeStartY:0,
  isRotating:false, rotCX:0, rotCY:0, rotStartAngle:0, rotOrigAngle:0,
  // clipboard
  clipboard:null, pasteOffset:0,
  // view
  unit:'cm', dscale:50, zi:10, swBase:0, shBase:0,
  // grid
  gridVisible:true, snapDivisions:5,
  // snap modes (each independently toggleable)
  snapModes:{ grid:true, endpoint:true, midpoint:true, intersection:true },
  // last computed snap result
  lastSnap:{ x:0, y:0, type:'grid' },
  // history
  undoStack:[], redoStack:[], MAX_HISTORY:50
};

// ════════════════════════════════════════
// Snap mode toggle buttons
// ════════════════════════════════════════
function toggleOSnap(mode){
  A.snapModes[mode] = !A.snapModes[mode];
  const btn = document.getElementById('btn-'+mode+'-snap') ||
              document.getElementById('btn-'+(mode==='grid'?'grid':'end')+'-snap');
  const map = {grid:'btn-grid-snap', endpoint:'btn-end-snap', midpoint:'btn-mid-snap', intersection:'btn-int-snap'};
  const el = document.getElementById(map[mode]);
  if(el) el.classList.toggle('snap-active', A.snapModes[mode]);
}

// add .snap-active style to CSS via JS (simpler than another CSS block)
const snapStyle = document.createElement('style');
snapStyle.textContent = `.snap-active{background:#deeeff!important;border-color:#378ADD!important;color:#1558a8!important;}`;
document.head.appendChild(snapStyle);

// ════════════════════════════════════════
// History
// ════════════════════════════════════════
function snapshot(){ return{shapes:JSON.parse(JSON.stringify(A.shapes)),layers:JSON.parse(JSON.stringify(A.layers)),activeLayerId:A.activeLayerId}; }
function pushHistory(){ A.undoStack.push(snapshot()); if(A.undoStack.length>A.MAX_HISTORY)A.undoStack.shift(); A.redoStack=[]; updateUndoBtns(); }
function applySnapshot(snap){ A.shapes=snap.shapes; A.layers=snap.layers; A.activeLayerId=snap.activeLayerId; A.sel=null; A.multiSel=[]; clearHandles(); renderLayers(); renderSaved(); redraw(); updateMultiBadge(); }
function undo(){ if(!A.undoStack.length)return; A.redoStack.push(snapshot()); applySnapshot(A.undoStack.pop()); updateUndoBtns(); setStatus('Undone'); }
function redo(){ if(!A.redoStack.length)return; A.undoStack.push(snapshot()); applySnapshot(A.redoStack.pop()); updateUndoBtns(); setStatus('Redone'); }
function updateUndoBtns(){ document.getElementById('btn-undo').disabled=!A.undoStack.length; document.getElementById('btn-redo').disabled=!A.redoStack.length; }

// ════════════════════════════════════════
// Keyboard shortcuts
// ════════════════════════════════════════
document.addEventListener('keydown',e=>{
  const tag=document.activeElement.tagName;
  if(tag==='INPUT'||tag==='SELECT'||tag==='TEXTAREA') return;
  const ctrl=e.ctrlKey||e.metaKey;
  if(ctrl&&e.key==='z'){e.preventDefault();undo();}
  if(ctrl&&(e.key==='y'||(e.shiftKey&&e.key==='Z'))){e.preventDefault();redo();}
  if(ctrl&&e.key==='c'){e.preventDefault();copyShape();}
  if(ctrl&&e.key==='v'){e.preventDefault();pasteShape();}
  if(ctrl&&e.key==='d'){e.preventDefault();duplicateShape();}
  if(ctrl&&e.key==='a'){e.preventDefault();selectAll();}
  if(e.key==='Delete'||e.key==='Backspace'){deleteSelected();}
  if(e.key==='Escape'){
    if(A.isDrawing){ A.isDrawing=false;A.dragSh=null;setStatus('Draw cancelled');redraw();return; }
    A.sel=null;A.multiSel=[];clearHandles();redraw();updateMultiBadge();hideCtx();
  }
});

// ════════════════════════════════════════
// Multi-select helpers
// ════════════════════════════════════════
function selectAll(){
  A.multiSel=A.shapes.map((_,i)=>i).filter(i=>{ const l=layerById(A.shapes[i].layerId); return l&&l.visible&&!l.locked; });
  A.sel=null; clearHandles(); redraw(); updateMultiBadge();
  setStatus(A.multiSel.length+' shapes selected');
}
function updateMultiBadge(){
  const n=A.multiSel.length;
  if(n>1){ multiBadge.style.display='block'; multiBadge.textContent=n+' shapes selected — Ctrl+C / Ctrl+D / Del'; }
  else { multiBadge.style.display='none'; }
}
function allSelected(){ return A.multiSel.length>0 ? A.multiSel : (A.sel!==null?[A.sel]:[]); }

// ════════════════════════════════════════
// Copy / Paste / Duplicate / Delete
// ════════════════════════════════════════
function copyShape(){
  const idxs=allSelected();
  if(!idxs.length){setStatus('Select shapes to copy');return;}
  A.clipboard=idxs.map(i=>JSON.parse(JSON.stringify(A.shapes[i])));
  A.pasteOffset=0;
  setStatus('Copied '+idxs.length+' shape'+(idxs.length>1?'s':''));
}
function pasteShape(){
  if(!A.clipboard||!A.clipboard.length){setStatus('Nothing to paste');return;}
  A.pasteOffset+=20;
  pushHistory();
  const newIdxs=[];
  A.clipboard.forEach(sh=>{
    const c=JSON.parse(JSON.stringify(sh));
    c.x1+=A.pasteOffset;c.y1+=A.pasteOffset;c.x2+=A.pasteOffset;c.y2+=A.pasteOffset;
    c.saved=false; A.shapes.push(c); newIdxs.push(A.shapes.length-1);
  });
  A.multiSel=newIdxs; A.sel=null; clearHandles(); redraw(); updateMultiBadge();
  setStatus('Pasted '+newIdxs.length+' shape'+(newIdxs.length>1?'s':''));
}
function duplicateShape(){
  const idxs=allSelected();
  if(!idxs.length){setStatus('Select shapes to duplicate');return;}
  pushHistory();
  const newIdxs=[];
  idxs.forEach(i=>{
    const c=JSON.parse(JSON.stringify(A.shapes[i]));
    c.x1+=20;c.y1+=20;c.x2+=20;c.y2+=20;c.saved=false;
    A.shapes.push(c); newIdxs.push(A.shapes.length-1);
  });
  A.multiSel=newIdxs; A.sel=null; clearHandles(); redraw(); updateMultiBadge();
  setStatus('Duplicated');
}
function deleteSelected(){
  const idxs=allSelected();
  if(!idxs.length){setStatus('Nothing selected');return;}
  const locked=idxs.filter(i=>{ const l=layerById(A.shapes[i].layerId); return l&&l.locked; });
  if(locked.length){setStatus('Some shapes are on locked layers');return;}
  pushHistory();
  // remove highest indices first so lower indices stay valid
  [...idxs].sort((a,b)=>b-a).forEach(i=>A.shapes.splice(i,1));
  A.sel=null; A.multiSel=[]; clearHandles(); renderSaved(); redraw(); updateMultiBadge();
  setStatus('Deleted '+idxs.length+' shape'+(idxs.length>1?'s':''));
}

// ════════════════════════════════════════
// Context menu
// ════════════════════════════════════════
function showCtx(x,y){ ctxMenu.style.left=x+'px'; ctxMenu.style.top=y+'px'; ctxMenu.classList.add('visible'); }
function hideCtx(){ ctxMenu.classList.remove('visible'); }
document.addEventListener('click',hideCtx);
sc.addEventListener('contextmenu',e=>{
  e.preventDefault();
  const[mx,my]=mxy(e);
  let hit=false;
  for(let i=A.shapes.length-1;i>=0;i--){
    if(hitTest(mx,my,A.shapes[i])){
      if(!A.multiSel.includes(i)){ A.sel=i; A.multiSel=[]; }
      syncSide(); buildHandles(); redraw(); hit=true; break;
    }
  }
  if(hit||A.multiSel.length) showCtx(e.clientX,e.clientY);
});

// ════════════════════════════════════════
// Layers
// ════════════════════════════════════════
function addLayer(){ pushHistory(); const l=makeLayer('Layer '+(A.layers.length+1)); A.layers.push(l); A.activeLayerId=l.id; renderLayers(); setStatus('Layer added'); }
function deleteLayer(id){ if(A.layers.length===1){setStatus("Can't delete the only layer");return;} pushHistory(); A.shapes=A.shapes.filter(s=>s.layerId!==id); A.layers=A.layers.filter(l=>l.id!==id); if(A.activeLayerId===id)A.activeLayerId=A.layers[0].id; A.sel=null;A.multiSel=[];clearHandles();renderLayers();renderSaved();redraw();updateMultiBadge(); }
function toggleLayerVisible(id){ pushHistory(); const l=A.layers.find(x=>x.id===id); if(l){l.visible=!l.visible;renderLayers();redraw();} }
function toggleLayerLock(id){ pushHistory(); const l=A.layers.find(x=>x.id===id); if(l){l.locked=!l.locked;renderLayers();} }
function setActiveLayer(id){ A.activeLayerId=id; const l=A.layers.find(x=>x.id===id); if(l){A.color=l.color;document.getElementById('cc').value=l.color;} renderLayers(); }
function activeLayer(){ return A.layers.find(l=>l.id===A.activeLayerId)||A.layers[0]; }
function layerById(id){ return A.layers.find(l=>l.id===id); }
function startRenameLayer(id,el){ const row=el.closest('.layer-row'); const nameEl=row.querySelector('.layer-name'); const inp=document.createElement('input'); inp.className='layer-name-input'; inp.value=nameEl.textContent; nameEl.replaceWith(inp); inp.focus(); inp.select(); const commit=()=>{pushHistory();const l=A.layers.find(x=>x.id===id);if(l)l.name=inp.value.trim()||l.name;renderLayers();}; inp.addEventListener('blur',commit); inp.addEventListener('keydown',e=>{if(e.key==='Enter')inp.blur();if(e.key==='Escape'){inp.value='';inp.blur();}}); }
function renderLayers(){
  const el=document.getElementById('layer-list'); el.innerHTML='';
  [...A.layers].reverse().forEach(l=>{
    const row=document.createElement('div'); row.className='layer-row'+(l.id===A.activeLayerId?' active-layer':''); row.onclick=(e)=>{if(e.target.tagName==='BUTTON')return;setActiveLayer(l.id);};
    const dot=document.createElement('div'); dot.className='layer-dot'; dot.style.background=l.color;
    const name=document.createElement('span'); name.className='layer-name'; name.textContent=l.name; name.ondblclick=(e)=>{e.stopPropagation();startRenameLayer(l.id,name);};
    const vis=document.createElement('button'); vis.className='layer-vis'; vis.textContent=l.visible?'👁':'🚫'; vis.onclick=(e)=>{e.stopPropagation();toggleLayerVisible(l.id);};
    const lock=document.createElement('button'); lock.className='layer-lock'; lock.textContent=l.locked?'🔒':'🔓'; lock.onclick=(e)=>{e.stopPropagation();toggleLayerLock(l.id);};
    const del=document.createElement('button'); del.className='layer-del'; del.textContent='×'; del.onclick=(e)=>{e.stopPropagation();deleteLayer(l.id);};
    row.append(dot,name,vis,lock,del); el.appendChild(row);
  });
}

// ════════════════════════════════════════
// Zoom
// ════════════════════════════════════════
const zf=()=>ZSTEPS[A.zi]/100;
const scW=()=>Math.round(A.swBase*zf());
const scH=()=>Math.round(A.shBase*zf());
function applyZoom(){ sc.width=scW();sc.height=scH();document.getElementById('zlbl').textContent=ZSTEPS[A.zi]+'%';drawRulers();redraw();if(A.sel!==null)buildHandles(); }
function doZoom(dir){ const ni=A.zi+dir;if(ni<0||ni>=ZSTEPS.length)return;const cx=vp.scrollLeft+vp.clientWidth/2,cy=vp.scrollTop+vp.clientHeight/2;const ratio=ZSTEPS[ni]/ZSTEPS[A.zi];A.zi=ni;applyZoom();vp.scrollLeft=cx*ratio-vp.clientWidth/2;vp.scrollTop=cy*ratio-vp.clientHeight/2; }
function zoomFit(){ const fw=(vp.clientWidth-80)/A.swBase,fh=(vp.clientHeight-80)/A.shBase;const pct=Math.floor(Math.min(fw,fh)*100);let best=0,bd=9999;ZSTEPS.forEach((s,i)=>{const d=Math.abs(s-pct);if(d<bd){bd=d;best=i;}});A.zi=best;applyZoom();vp.scrollLeft=(scW()-vp.clientWidth)/2;vp.scrollTop=0; }
function initSheet(key){ const[wMM,hMM]=SHEET_MM[key];A.swBase=Math.round(wMM*BASE_PPMM);A.shBase=Math.round(hMM*BASE_PPMM);applyZoom(); }

// ════════════════════════════════════════
// Coords & units
// ════════════════════════════════════════
function mxy(e){ const r=sc.getBoundingClientRect();return[e.clientX-r.left,e.clientY-r.top]; }
function pxToUnit(px){ if(A.unit==='px')return px;return(px/zf()/BASE_PPMM*A.dscale)/UNIT_MM[A.unit]; }
function unitToPx(u){ if(A.unit==='px')return u*zf();return(u*UNIT_MM[A.unit]/A.dscale)*BASE_PPMM*zf(); }

// ════════════════════════════════════════
// Grid step
// ════════════════════════════════════════
function pickStep(){ const ppu=unitToPx(1);for(const n of [0.001,0.002,0.005,0.01,0.02,0.05,0.1,0.2,0.5,1,2,5,10,20,50,100,200,500,1000,2000,5000])if(n*ppu>=45)return n;return 5000; }

// ════════════════════════════════════════
// OBJECT SNAP ENGINE  (new in v8)
// Priority: endpoint > midpoint > intersection > grid
// Tolerance: 12px on screen
// ════════════════════════════════════════
const SNAP_TOL = 14; // px on screen

function getShapeKeyPoints(sh){
  // returns { endpoints:[[x,y]...], midpoints:[[x,y]...] }
  const{x1,y1,x2,y2}=sh;
  const cx=(x1+x2)/2, cy=(y1+y2)/2;
  const{x,y,w,h}=getBBox(sh);
  const eps=[], mids=[];

  switch(sh.type){
    case 'line': case 'curve': case 'arrow': case 'dimension':
      eps.push([x1,y1],[x2,y2]);
      mids.push([cx,cy]);
      break;
    case 'rect':
      eps.push([x,y],[x+w,y],[x+w,y+h],[x,y+h]);
      mids.push([x+w/2,y],[x+w,y+h/2],[x+w/2,y+h],[x,y+h/2]);
      break;
    case 'square':{ const s=Math.min(w,h);const sx=cx-s/2,sy=cy-s/2;eps.push([sx,sy],[sx+s,sy],[sx+s,sy+s],[sx,sy+s]);mids.push([sx+s/2,sy],[sx+s,sy+s/2],[sx+s/2,sy+s],[sx,sy+s/2]);break;}
    case 'circle':{ const r=Math.sqrt((x2-x1)**2+(y2-y1)**2);eps.push([x1,y1-r],[x1+r,y1],[x1,y1+r],[x1-r,y1]);mids.push([x1,y1]);break;}
    case 'ellipse':
      eps.push([cx,y],[x+w,cy],[cx,y+h],[x,cy]);
      mids.push([cx,cy]);
      break;
    default:
      eps.push([x,y],[x+w,y],[x+w,y+h],[x,y+h]);
      mids.push([cx,cy]);
  }
  // apply rotation to all points
  const rot=(sh.rotation||0)*Math.PI/180;
  const rotPts=pts=>pts.map(([px,py])=>{
    const dx=px-cx,dy=py-cy;
    return[cx+dx*Math.cos(rot)-dy*Math.sin(rot), cy+dx*Math.sin(rot)+dy*Math.cos(rot)];
  });
  return{ endpoints:rotPts(eps), midpoints:rotPts(mids) };
}

function lineIntersection(p1,p2,p3,p4){
  // returns intersection point of segment p1-p2 and p3-p4, or null
  const[x1,y1]=p1,[x2,y2]=p2,[x3,y3]=p3,[x4,y4]=p4;
  const denom=(x1-x2)*(y3-y4)-(y1-y2)*(x3-x4);
  if(Math.abs(denom)<0.001)return null;
  const t=((x1-x3)*(y3-y4)-(y1-y3)*(x3-x4))/denom;
  const u=-((x1-x2)*(y1-y3)-(y1-y2)*(x1-x3))/denom;
  if(t<0||t>1||u<0||u>1)return null;
  return[x1+t*(x2-x1), y1+t*(y2-y1)];
}

function computeSnap(rawX, rawY){
  // Returns { x, y, type } — the best snap point near rawX,rawY
  let best = { x:rawX, y:rawY, type:'none', dist:Infinity };

  const check=(px,py,type)=>{
    const d=Math.sqrt((px-rawX)**2+(py-rawY)**2);
    if(d<SNAP_TOL&&d<best.dist){ best={x:px,y:py,type,dist:d}; }
  };

  const visShapes=A.shapes.filter(sh=>{ const l=layerById(sh.layerId);return l&&l.visible; });

  // 1. Endpoint snap
  if(A.snapModes.endpoint){
    visShapes.forEach(sh=>{
      const{endpoints}=getShapeKeyPoints(sh);
      endpoints.forEach(([px,py])=>check(px,py,'endpoint'));
    });
  }

  // 2. Midpoint snap (only if no endpoint found yet)
  if(A.snapModes.midpoint&&best.type==='none'){
    visShapes.forEach(sh=>{
      const{midpoints}=getShapeKeyPoints(sh);
      midpoints.forEach(([px,py])=>check(px,py,'midpoint'));
    });
  }

  // 3. Intersection snap (line-line only, cost more but very useful)
  if(A.snapModes.intersection&&best.type==='none'){
    const lineShapes=visShapes.filter(s=>['line','arrow','dimension'].includes(s.type));
    for(let i=0;i<lineShapes.length;i++){
      for(let j=i+1;j<lineShapes.length;j++){
        const a=lineShapes[i],b=lineShapes[j];
        const pt=lineIntersection([a.x1,a.y1],[a.x2,a.y2],[b.x1,b.y1],[b.x2,b.y2]);
        if(pt) check(pt[0],pt[1],'intersection');
      }
    }
  }

  // 4. Grid snap (fallback)
  if(A.snapModes.grid&&best.type==='none'){
    const spx=unitToPx(pickStep())/A.snapDivisions;
    const gx=Math.round(rawX/spx)*spx, gy=Math.round(rawY/spx)*spx;
    const d=Math.sqrt((gx-rawX)**2+(gy-rawY)**2);
    if(d<SNAP_TOL) best={x:gx,y:gy,type:'grid',dist:d};
  }

  // if nothing snapped, just return raw
  if(best.type==='none') best={x:rawX,y:rawY,type:'none',dist:0};
  return best;
}

function snapPt(rawX,rawY){
  const s=computeSnap(rawX,rawY);
  A.lastSnap=s;
  return[s.x,s.y];
}

// snap crosshair drawn on canvas
function renderSnapMarker(x,y,type){
  if(!type||type==='none') return;
  const colors={endpoint:'#c0392b',midpoint:'#8e44ad',intersection:'#16a085',grid:'#378ADD'};
  const c=colors[type]||'#378ADD';
  ctx.save(); ctx.strokeStyle=c; ctx.lineWidth=1.5;
  if(type==='endpoint'){
    // small square
    ctx.strokeRect(x-6,y-6,12,12);
  } else if(type==='midpoint'){
    // triangle marker
    ctx.beginPath(); ctx.moveTo(x,y-7); ctx.lineTo(x+6,y+5); ctx.lineTo(x-6,y+5); ctx.closePath(); ctx.stroke();
  } else if(type==='intersection'){
    // X marker
    ctx.beginPath(); ctx.moveTo(x-7,y-7); ctx.lineTo(x+7,y+7); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x+7,y-7); ctx.lineTo(x-7,y+7); ctx.stroke();
  } else {
    // grid: small cross
    ctx.beginPath(); ctx.moveTo(x-7,y); ctx.lineTo(x+7,y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x,y-7); ctx.lineTo(x,y+7); ctx.stroke();
  }
  ctx.restore();
}

// snap badge shown near cursor
function showSnapBadge(e,type){
  if(!type||type==='none'){ snapBadge.style.display='none'; return; }
  const labels={endpoint:'Endpoint',midpoint:'Midpoint',intersection:'Intersection',grid:'Grid'};
  snapBadge.className=''; snapBadge.classList.add('snap-'+type);
  snapBadge.textContent=labels[type]||type;
  snapBadge.style.display='block';
  snapBadge.style.left=e.clientX+'px';
  snapBadge.style.top=e.clientY+'px';
}

// ════════════════════════════════════════
// Rulers
// ════════════════════════════════════════
function drawRulers(){
  const sx=vp.scrollLeft,sy=vp.scrollTop,OX=40,OY=40;
  const step=pickStep(),spx=unitToPx(step),dp=step<0.01?3:step<0.1?2:step<1?1:0;
  const RW=rhOut.clientWidth; rhEl.width=RW;
  ctxH.fillStyle='#e4e4e4';ctxH.fillRect(0,0,RW,24);
  ctxH.strokeStyle='#999';ctxH.lineWidth=0.5;ctxH.beginPath();ctxH.moveTo(0,23.5);ctxH.lineTo(RW,23.5);ctxH.stroke();
  const su=Math.floor((sx-OX)/spx)*step;
  for(let u=su;;u+=step){ const x=OX+unitToPx(u)-sx;if(x>RW+spx)break;if(x<-spx)continue;ctxH.strokeStyle='#aaa';ctxH.beginPath();ctxH.moveTo(x,15);ctxH.lineTo(x,24);ctxH.stroke();for(let m=1;m<5;m++){const xm=x+m*spx/5;if(xm>RW)break;ctxH.beginPath();ctxH.moveTo(xm,19);ctxH.lineTo(xm,24);ctxH.stroke();}if(x>8&&x<RW-8){ctxH.fillStyle='#555';ctxH.font='9px sans-serif';ctxH.textAlign='center';ctxH.fillText(u.toFixed(dp),x,12);} }
  ctxH.textAlign='right';ctxH.fillStyle='#378ADD';ctxH.font='bold 9px sans-serif';ctxH.fillText(A.unit,RW-3,12);
  const VH=rvOut.clientHeight;rvEl.height=VH;
  ctxV.fillStyle='#e4e4e4';ctxV.fillRect(0,0,24,VH);
  ctxV.strokeStyle='#999';ctxV.lineWidth=0.5;ctxV.beginPath();ctxV.moveTo(23.5,0);ctxV.lineTo(23.5,VH);ctxV.stroke();
  const sv=Math.floor((sy-OY)/spx)*step;
  for(let u=sv;;u+=step){ const y=OY+unitToPx(u)-sy;if(y>VH+spx)break;if(y<-spx)continue;ctxV.strokeStyle='#aaa';ctxV.beginPath();ctxV.moveTo(15,y);ctxV.lineTo(24,y);ctxV.stroke();for(let m=1;m<5;m++){const ym=y+m*spx/5;if(ym>VH)break;ctxV.beginPath();ctxV.moveTo(19,ym);ctxV.lineTo(24,ym);ctxV.stroke();}if(y>8&&y<VH-8){ctxV.save();ctxV.translate(11,y);ctxV.rotate(-Math.PI/2);ctxV.fillStyle='#555';ctxV.font='9px sans-serif';ctxV.textAlign='center';ctxV.fillText(u.toFixed(dp),0,0);ctxV.restore();} }
  ctxV.save();ctxV.translate(11,VH-6);ctxV.rotate(-Math.PI/2);ctxV.fillStyle='#378ADD';ctxV.font='bold 9px sans-serif';ctxV.textAlign='center';ctxV.fillText(A.unit,0,0);ctxV.restore();
}
vp.addEventListener('scroll',drawRulers);
new ResizeObserver(drawRulers).observe(vp);

// ════════════════════════════════════════
// Grid
// ════════════════════════════════════════
function drawGrid(){
  if(!A.gridVisible){ctx.save();ctx.strokeStyle='#999';ctx.lineWidth=1.2;ctx.strokeRect(0,0,sc.width,sc.height);ctx.restore();return;}
  const majorPx=unitToPx(pickStep()),minorPx=majorPx/A.snapDivisions,W=sc.width,H=sc.height;
  ctx.save();
  ctx.strokeStyle='#eef0f8';ctx.lineWidth=0.5;
  for(let x=0;x<W;x+=minorPx){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
  for(let y=0;y<H;y+=minorPx){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
  ctx.strokeStyle='#d0d8ee';ctx.lineWidth=0.8;
  for(let x=0;x<W;x+=majorPx){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
  for(let y=0;y<H;y+=majorPx){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
  ctx.strokeStyle='#999';ctx.lineWidth=1.2;ctx.strokeRect(0,0,W,H);
  ctx.restore();
}

// ════════════════════════════════════════
// Shape bbox helpers
// ════════════════════════════════════════
function getBBox(sh){ return{x:Math.min(sh.x1,sh.x2),y:Math.min(sh.y1,sh.y2),w:Math.abs(sh.x2-sh.x1),h:Math.abs(sh.y2-sh.y1)}; }
function getCentre(sh){ return{cx:(sh.x1+sh.x2)/2,cy:(sh.y1+sh.y2)/2}; }
function getHandlePositions(sh){ const{x,y,w,h}=getBBox(sh);return[[x,y],[x+w/2,y],[x+w,y],[x+w,y+h/2],[x+w,y+h],[x+w/2,y+h],[x,y+h],[x,y+h/2]]; }

// ════════════════════════════════════════
// Shape renderer
// ════════════════════════════════════════
function renderShape(sh,alpha,overrideColor){
  alpha=alpha||1;
  const{type,x1,y1,x2,y2,color,fill,stroke,rotation}=sh;
  const rot=(rotation||0)*Math.PI/180;
  const{cx,cy}=getCentre(sh);
  const dx=x2-x1,dy=y2-y1,w=Math.abs(dx),h=Math.abs(dy);
  const r=Math.sqrt(dx*dx+dy*dy),side=Math.min(w,h);
  const useColor=overrideColor||color;

  ctx.save();
  ctx.globalAlpha=alpha;
  ctx.translate(cx,cy);ctx.rotate(rot);ctx.translate(-cx,-cy);
  ctx.strokeStyle=useColor;ctx.lineWidth=stroke;
  ctx.fillStyle=fill==='filled'?useColor:'transparent';

  const poly=pts=>{ctx.beginPath();ctx.moveTo(pts[0][0],pts[0][1]);for(let i=1;i<pts.length;i++)ctx.lineTo(pts[i][0],pts[i][1]);ctx.closePath();if(fill==='filled')ctx.fill();ctx.stroke();};
  const polyR=(px,py,R,n,off)=>{const p=[];for(let i=0;i<n;i++){const a=(off||0)+(2*Math.PI*i/n)-Math.PI/2;p.push([px+R*Math.cos(a),py+R*Math.sin(a)]);}return p;};

  switch(type){
    case 'line': ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();break;
    case 'curve': ctx.beginPath();ctx.moveTo(x1,y1);ctx.quadraticCurveTo((x1+x2)/2,(y1+y2)/2-r*.4,x2,y2);ctx.stroke();break;
    case 'arrow':{const ang=Math.atan2(dy,dx),hw=stroke*4+8;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();ctx.beginPath();ctx.moveTo(x2,y2);ctx.lineTo(x2-hw*Math.cos(ang-.4),y2-hw*Math.sin(ang-.4));ctx.lineTo(x2-hw*Math.cos(ang+.4),y2-hw*Math.sin(ang+.4));ctx.closePath();ctx.fillStyle=useColor;ctx.fill();break;}
    case 'rect': ctx.beginPath();ctx.rect(Math.min(x1,x2),Math.min(y1,y2),w,h);if(fill==='filled')ctx.fill();ctx.stroke();break;
    case 'square': ctx.beginPath();ctx.rect(cx-side/2,cy-side/2,side,side);if(fill==='filled')ctx.fill();ctx.stroke();break;
    case 'circle': ctx.beginPath();ctx.arc(x1,y1,r,0,Math.PI*2);if(fill==='filled')ctx.fill();ctx.stroke();break;
    case 'ellipse': if(w>0&&h>0){ctx.beginPath();ctx.ellipse(cx,cy,w/2,h/2,0,0,Math.PI*2);if(fill==='filled')ctx.fill();ctx.stroke();}break;
    case 'triangle': poly([[cx,y1],[x1,y2],[x2,y2]]);break;
    case 'pentagon': poly(polyR(cx,cy,r*.8,5));break;
    case 'hexagon':  poly(polyR(cx,cy,r*.8,6,Math.PI/6));break;
    case 'star':{const pts=[];for(let i=0;i<10;i++){const a=(Math.PI*i/5)-Math.PI/2;const ri=i%2?r*.35:r*.8;pts.push([cx+ri*Math.cos(a),cy+ri*Math.sin(a)]);}poly(pts);break;}
    case 'dimension': renderDimension(sh,useColor);break;
  }
  ctx.restore();
}

function renderDimension(sh,useColor){
  const{x1,y1,x2,y2,stroke}=sh;
  const color=useColor||sh.color||'#c0392b';
  const dx=x2-x1,dy=y2-y1,len=Math.sqrt(dx*dx+dy*dy);
  if(len<4)return;
  const ang=Math.atan2(dy,dx),perp=ang-Math.PI/2,offset=22;
  const ex1x=x1+Math.cos(perp)*offset,ex1y=y1+Math.sin(perp)*offset;
  const ex2x=x2+Math.cos(perp)*offset,ex2y=y2+Math.sin(perp)*offset;
  ctx.save();ctx.strokeStyle=color;ctx.lineWidth=1;ctx.setLineDash([4,3]);
  ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(ex1x,ex1y);ctx.stroke();
  ctx.beginPath();ctx.moveTo(x2,y2);ctx.lineTo(ex2x,ex2y);ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();ctx.moveTo(ex1x,ex1y);ctx.lineTo(ex2x,ex2y);ctx.stroke();
  const hw=8;
  ctx.fillStyle=color;
  ctx.beginPath();ctx.moveTo(ex1x,ex1y);ctx.lineTo(ex1x+hw*Math.cos(ang-.3),ex1y+hw*Math.sin(ang-.3));ctx.lineTo(ex1x+hw*Math.cos(ang+.3),ex1y+hw*Math.sin(ang+.3));ctx.closePath();ctx.fill();
  ctx.beginPath();ctx.moveTo(ex2x,ex2y);ctx.lineTo(ex2x-hw*Math.cos(ang-.3),ex2y-hw*Math.sin(ang-.3));ctx.lineTo(ex2x-hw*Math.cos(ang+.3),ex2y-hw*Math.sin(ang+.3));ctx.closePath();ctx.fill();
  const mx=(ex1x+ex2x)/2,my=(ex1y+ex2y)/2;
  const rl=pxToUnit(len);const dp=rl<1?3:rl<10?2:1;
  const label=rl.toFixed(dp)+' '+A.unit;
  ctx.save();ctx.translate(mx,my);ctx.rotate(ang);ctx.font='bold 11px sans-serif';ctx.textAlign='center';
  const tw=ctx.measureText(label).width;
  ctx.fillStyle='rgba(255,255,255,.9)';ctx.fillRect(-tw/2-4,-14,tw+8,16);
  ctx.fillStyle=color;ctx.fillText(label,0,0);
  ctx.restore();ctx.restore();
}

// highlight ring drawn around hovered or selected shapes
function renderHighlight(sh,color,dash){
  const{x,y,w,h}=getBBox(sh);
  const pad=5;
  ctx.save();
  const{cx,cy}=getCentre(sh);
  ctx.translate(cx,cy);ctx.rotate((sh.rotation||0)*Math.PI/180);ctx.translate(-cx,-cy);
  ctx.strokeStyle=color;ctx.lineWidth=1.8;
  if(dash)ctx.setLineDash([5,3]);
  ctx.strokeRect(x-pad,y-pad,w+pad*2,h+pad*2);
  ctx.setLineDash([]);
  ctx.restore();
}

// ════════════════════════════════════════
// Redraw
// ════════════════════════════════════════
function redraw(){
  ctx.clearRect(0,0,sc.width,sc.height);
  ctx.fillStyle='#fff';ctx.fillRect(0,0,sc.width,sc.height);
  drawGrid();

  A.layers.forEach(l=>{
    if(!l.visible)return;
    A.shapes.forEach((sh,i)=>{
      if(sh.layerId!==l.id)return;

      // object highlight on hover  (new v8)
      if(i===A.hovIdx&&A.sel!==i&&!A.multiSel.includes(i)){
        renderHighlight(sh,'rgba(55,138,221,0.5)',false);
      }
      // multi-select highlight
      if(A.multiSel.includes(i)){
        renderHighlight(sh,'#378ADD',true);
      }

      renderShape(sh);

      // single selection box
      if(i===A.sel&&!A.multiSel.length){
        renderHighlight(sh,'#378ADD',true);
      }
    });
  });

  // live draw preview
  if(A.isDrawing&&A.dragSh){
    renderShape(A.dragSh,0.45);
    renderSnapMarker(A.dragSh.x2,A.dragSh.y2,A.lastSnap.type);
  } else {
    renderSnapMarker(A.lastSnap.x,A.lastSnap.y,A.lastSnap.type);
  }
}

// ════════════════════════════════════════
// Hit test (rotated bounding box)
// ════════════════════════════════════════
function hitTest(mx,my,sh){
  const{cx,cy}=getCentre(sh);
  const rot=-(sh.rotation||0)*Math.PI/180;
  const lx=(mx-cx)*Math.cos(rot)-(my-cy)*Math.sin(rot)+cx;
  const ly=(mx-cx)*Math.sin(rot)+(my-cy)*Math.cos(rot)+cy;
  const pad=8;const{x,y,w,h}=getBBox(sh);
  return lx>=x-pad&&lx<=x+w+pad&&ly>=y-pad&&ly<=y+h+pad;
}

// ════════════════════════════════════════
// Handle layer (resize + rotate DOM handles)
// ════════════════════════════════════════
function clearHandles(){ handleLayer.innerHTML=''; }
function buildHandles(){
  clearHandles();
  if(A.sel===null||A.multiSel.length>0)return; // no handles during multi-select
  const sh=A.shapes[A.sel];if(!sh)return;
  const pts=getHandlePositions(sh);
  const{cx,cy}=getCentre(sh);
  const rot=(sh.rotation||0)*Math.PI/180;
  function rotPt(px,py){const dx=px-cx,dy=py-cy;return[cx+dx*Math.cos(rot)-dy*Math.sin(rot),cy+dx*Math.sin(rot)+dy*Math.cos(rot)];}
  pts.forEach(([px,py],i)=>{
    const[rpx,rpy]=rotPt(px,py);
    const h=document.createElement('div');h.className='handle';
    h.style.left=rpx+'px';h.style.top=rpy+'px';h.style.cursor=HANDLE_CURSORS[i];
    h.style.pointerEvents='all';h.dataset.handle=i;
    h.addEventListener('mousedown',onResizeStart);handleLayer.appendChild(h);
  });
  const[rtx,rty]=rotPt(cx,getBBox(sh).y-30);
  const rh=document.createElement('div');rh.className='handle rotate-handle';
  rh.style.left=rtx+'px';rh.style.top=rty+'px';rh.style.pointerEvents='all';rh.style.cursor='grab';
  rh.addEventListener('mousedown',onRotateStart);handleLayer.appendChild(rh);
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.style.cssText='position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;overflow:visible';
  const[topMx,topMy]=rotPt(cx,getBBox(sh).y);
  const line=document.createElementNS('http://www.w3.org/2000/svg','line');
  line.setAttribute('x1',topMx);line.setAttribute('y1',topMy);line.setAttribute('x2',rtx);line.setAttribute('y2',rty);
  line.setAttribute('stroke','#378ADD');line.setAttribute('stroke-width','1');line.setAttribute('stroke-dasharray','3,2');
  svg.appendChild(line);handleLayer.appendChild(svg);
}

// resize
function onResizeStart(e){
  e.stopPropagation();if(A.sel===null)return;
  A.isResizing=true;A.resizeHandle=+e.currentTarget.dataset.handle;
  A.resizeOrigSh=JSON.parse(JSON.stringify(A.shapes[A.sel]));
  const r=sc.getBoundingClientRect();A.resizeStartX=e.clientX-r.left;A.resizeStartY=e.clientY-r.top;
  document.addEventListener('mousemove',onResizeMove);document.addEventListener('mouseup',onResizeEnd);
}
function onResizeMove(e){
  if(!A.isResizing||A.sel===null)return;
  const r=sc.getBoundingClientRect();
  const[mx,my]=snapPt(e.clientX-r.left,e.clientY-r.top);
  const orig=A.resizeOrigSh,sh=A.shapes[A.sel],hi=A.resizeHandle;
  if(hi===0||hi===1||hi===2)sh.y1=Math.min(my,orig.y2-4);
  if(hi===4||hi===5||hi===6)sh.y2=Math.max(my,orig.y1+4);
  if(hi===0||hi===6||hi===7)sh.x1=Math.min(mx,orig.x2-4);
  if(hi===2||hi===3||hi===4)sh.x2=Math.max(mx,orig.x1+4);
  redraw();buildHandles();
}
function onResizeEnd(){if(!A.isResizing)return;A.isResizing=false;pushHistory();document.removeEventListener('mousemove',onResizeMove);document.removeEventListener('mouseup',onResizeEnd);}

// rotate
function onRotateStart(e){
  e.stopPropagation();if(A.sel===null)return;
  A.isRotating=true;const{cx,cy}=getCentre(A.shapes[A.sel]);A.rotCX=cx;A.rotCY=cy;
  const r=sc.getBoundingClientRect();const mx=e.clientX-r.left,my=e.clientY-r.top;
  A.rotStartAngle=Math.atan2(my-cy,mx-cx)*180/Math.PI;A.rotOrigAngle=A.shapes[A.sel].rotation||0;
  e.currentTarget.style.cursor='grabbing';
  document.addEventListener('mousemove',onRotateMove);document.addEventListener('mouseup',onRotateEnd);
}
function onRotateMove(e){
  if(!A.isRotating||A.sel===null)return;
  const r=sc.getBoundingClientRect();const mx=e.clientX-r.left,my=e.clientY-r.top;
  let angle=Math.atan2(my-A.rotCY,mx-A.rotCX)*180/Math.PI;
  let delta=angle-A.rotStartAngle;if(e.shiftKey)delta=Math.round(delta/15)*15;
  let newAngle=(A.rotOrigAngle+delta)%360;if(newAngle<0)newAngle+=360;
  A.shapes[A.sel].rotation=newAngle;
  document.getElementById('rot-slider').value=Math.round(newAngle);
  document.getElementById('rot-val').textContent=Math.round(newAngle)+'°';
  document.getElementById('ia').textContent=Math.round(newAngle)+'°';
  redraw();buildHandles();
}
function onRotateEnd(){if(!A.isRotating)return;A.isRotating=false;pushHistory();document.removeEventListener('mousemove',onRotateMove);document.removeEventListener('mouseup',onRotateEnd);}
document.getElementById('rot-slider').addEventListener('input',e=>{
  const v=+e.target.value;document.getElementById('rot-val').textContent=v+'°';document.getElementById('ia').textContent=v+'°';
  if(A.sel!==null){A.shapes[A.sel].rotation=v;redraw();buildHandles();}
});

// ════════════════════════════════════════
// ════════════════════════════════════════
// Tool mode  (new in v8 fix)
// 'select' = V key / Escape  → click selects, drag = rubber band
// 'draw'   = any shape button → first click sets anchor,
//             move previews, second click commits the shape
// ════════════════════════════════════════
A.toolMode = 'draw';   // start in draw mode

function setToolMode(mode){
  A.toolMode = mode;
  if(mode==='select'){ A.isDrawing=false; A.dragSh=null; redraw(); }
  sc.style.cursor = mode==='select'?'default':'crosshair';
  // update mode pill in topbar
  const pill  = document.getElementById('mode-pill');
  const icon  = document.getElementById('mode-icon');
  const label = document.getElementById('mode-label');
  if(mode==='select'){
    pill.style.background='#fff3e0'; pill.style.borderColor='#f0a800'; pill.style.color='#a06000';
    icon.textContent='🖱️'; label.textContent='SELECT';
  } else {
    pill.style.background='#deeeff'; pill.style.borderColor='#aaccff'; pill.style.color='#1558a8';
    icon.textContent='✏️'; label.textContent='DRAW';
  }
  setStatus(mode==='select'
    ? 'Select mode — click a shape or drag a box to select  |  press a shape button to draw'
    : 'Draw mode — click once to set start, move mouse, click again to place  |  Escape to cancel  |  V to select');
}

// pressing V or Escape goes to select mode
document.addEventListener('keydown', kk=>{
  const tag=document.activeElement.tagName;
  if(tag==='INPUT'||tag==='SELECT'||tag==='TEXTAREA') return;
  if(kk.key==='v'||kk.key==='V'){
    setToolMode('select');
    document.querySelectorAll('.sbtn').forEach(b=>b.classList.remove('active'));
  }
});

// shape buttons: set the active shape AND switch to draw mode
document.getElementById('sbtns').addEventListener('click', e=>{
  const b=e.target.closest('.sbtn'); if(!b) return;
  A.shape=b.dataset.shape;
  document.querySelectorAll('.sbtn').forEach(x=>x.classList.remove('active'));
  b.classList.add('active');
  setToolMode('draw');
});

// Mouse — mousedown
// ════════════════════════════════════════
sc.addEventListener('mousedown',e=>{
  if(e.button!==0)return;
  hideCtx();
  const[rawX,rawY]=mxy(e);
  const ctrl=e.ctrlKey||e.metaKey;

  // ── Ctrl+Click: toggle shape into multi-select (works in both modes) ──
  if(ctrl){
    for(let i=A.shapes.length-1;i>=0;i--){
      const sh=A.shapes[i];
      const l=layerById(sh.layerId);
      if(!l||!l.visible||l.locked)continue;
      if(hitTest(rawX,rawY,sh)){
        if(A.multiSel.includes(i)){
          A.multiSel=A.multiSel.filter(x=>x!==i);
        } else {
          if(A.sel!==null){ A.multiSel=[A.sel,i]; A.sel=null; }
          else A.multiSel=[...A.multiSel,i];
        }
        clearHandles();redraw();updateMultiBadge();return;
      }
    }
    return;
  }

  // ══════════════════════════════
  // SELECT MODE
  // ══════════════════════════════
  if(A.toolMode==='select'){
    // click existing shape → select + prepare to move
    for(let i=A.shapes.length-1;i>=0;i--){
      const sh=A.shapes[i];
      const l=layerById(sh.layerId);
      if(!l||!l.visible||l.locked)continue;
      if(hitTest(rawX,rawY,sh)){
        if(A.multiSel.length>1&&A.multiSel.includes(i)){
          A.isMoving=true;
          A.movDX=rawX-sh.x1;A.movDY=rawY-sh.y1;
          A.movOrigins=A.multiSel.map(idx=>({x1:A.shapes[idx].x1,y1:A.shapes[idx].y1,x2:A.shapes[idx].x2,y2:A.shapes[idx].y2}));
          return;
        }
        A.multiSel=[];A.sel=i;A.isMoving=true;
        A.movDX=rawX-sh.x1;A.movDY=rawY-sh.y1;
        syncSide();buildHandles();redraw();return;
      }
    }
    // click empty space → start rubber-band
    A.sel=null;A.multiSel=[];clearHandles();redraw();updateMultiBadge();
    A.isSelecting=true;
    A.selX1=rawX;A.selY1=rawY;
    selBox.style.display='block';
    selBox.style.left=rawX+'px';selBox.style.top=rawY+'px';
    selBox.style.width='0px';selBox.style.height='0px';
    return;
  }

  // ══════════════════════════════
  // DRAW MODE
  // ══════════════════════════════

  // If clicking an existing shape while in draw mode → switch to select that shape
  for(let i=A.shapes.length-1;i>=0;i--){
    const sh=A.shapes[i];
    const l=layerById(sh.layerId);
    if(!l||!l.visible||l.locked)continue;
    if(hitTest(rawX,rawY,sh)){
      // cancel any in-progress draw
      A.isDrawing=false;A.dragSh=null;
      A.multiSel=[];A.sel=i;A.isMoving=true;
      A.movDX=rawX-sh.x1;A.movDY=rawY-sh.y1;
      syncSide();buildHandles();redraw();return;
    }
  }

  const al=activeLayer();
  if(al.locked){ setStatus('Layer "'+al.name+'" is locked');return; }

  const[sx,sy]=snapPt(rawX,rawY);

  if(!A.isDrawing){
    // ── FIRST CLICK: set anchor ──
    A.isDrawing=true;
    A.dragX1=sx;A.dragY1=sy;
    A.dragSh={
      type:A.shape,x1:sx,y1:sy,x2:sx,y2:sy,
      color:A.color,fill:A.fill,stroke:A.stroke,
      rotation:0,layerId:A.activeLayerId,saved:false
    };
    setStatus('Start point set — move and click to place the shape (Escape to cancel)');
    redraw();
  } else {
    // ── SECOND CLICK: commit the shape ──
    A.dragSh.x2=sx;A.dragSh.y2=sy;
    const sh=A.dragSh;
    A.isDrawing=false;A.dragSh=null;
    const w=Math.abs(sh.x2-sh.x1),h=Math.abs(sh.y2-sh.y1);
    if(w>3||h>3){
      pushHistory();A.shapes.push(sh);A.sel=A.shapes.length-1;
      setStatus('Shape placed — click again to draw another, or press V to select');
      syncSide();buildHandles();
    } else {
      setStatus('Points too close — try again');
    }
    document.getElementById('iw').textContent='—';
    document.getElementById('ih').textContent='—';
    redraw();
  }
});

// ════════════════════════════════════════
// Mouse — mousemove
// ════════════════════════════════════════
sc.addEventListener('mousemove',e=>{
  const[rawX,rawY]=mxy(e);
  const[sx,sy]=snapPt(rawX,rawY);

  // coordinate badge
  coordBadge.style.display='block';
  coordBadge.style.left=e.clientX+'px';
  coordBadge.style.top=e.clientY+'px';
  coordBadge.textContent=pxToUnit(sx).toFixed(2)+', '+pxToUnit(sy).toFixed(2)+' '+A.unit;

  // snap badge
  showSnapBadge(e,A.lastSnap.type);

  // sidebar coords
  document.getElementById('ix').textContent=pxToUnit(sx).toFixed(2)+' '+A.unit;
  document.getElementById('iy').textContent=pxToUnit(sy).toFixed(2)+' '+A.unit;
  document.getElementById('isnap').textContent=A.lastSnap.type||'none';

  // ── move multi-selected shapes ──
  if(A.isMoving&&A.multiSel.length>1){
    const dx=rawX-A.selX1||rawX-(A.shapes[A.multiSel[0]]?.x1||0);
    // use movOrigins for clean multi-move
    if(A.movOrigins.length){
      const refSh=A.shapes[A.multiSel[0]];
      const ddx=rawX-A.movDX-A.movOrigins[0].x1;
      const ddy=rawY-A.movDY-A.movOrigins[0].y1;
      // snap the reference shape
      const[snx,sny]=snapPt(A.movOrigins[0].x1+rawX-A.movDX,A.movOrigins[0].y1+rawY-A.movDY);
      const actualDX=snx-A.movOrigins[0].x1;
      const actualDY=sny-A.movOrigins[0].y1;
      A.multiSel.forEach((idx,ii)=>{
        const o=A.movOrigins[ii];if(!o)return;
        A.shapes[idx].x1=o.x1+actualDX;A.shapes[idx].y1=o.y1+actualDY;
        A.shapes[idx].x2=o.x2+actualDX;A.shapes[idx].y2=o.y2+actualDY;
      });
    }
    redraw();return;
  }

  // ── move single shape ──
  if(A.isMoving&&A.sel!==null){
    const sh=A.shapes[A.sel];
    const dw=sh.x2-sh.x1,dh=sh.y2-sh.y1;
    let[nx,ny]=snapPt(rawX-A.movDX,rawY-A.movDY);
    sh.x1=nx;sh.y1=ny;sh.x2=sh.x1+dw;sh.y2=sh.y1+dh;
    redraw();buildHandles();return;
  }

  // ── rubber-band selection box ──
  if(A.isSelecting){
    const bx=Math.min(rawX,A.selX1),by=Math.min(rawY,A.selY1);
    const bw=Math.abs(rawX-A.selX1),bh=Math.abs(rawY-A.selY1);
    selBox.style.left=bx+'px';selBox.style.top=by+'px';
    selBox.style.width=bw+'px';selBox.style.height=bh+'px';
    // preview which shapes would be captured
    A.multiSel=[];
    A.shapes.forEach((sh,i)=>{
      const l=layerById(sh.layerId);if(!l||!l.visible||l.locked)return;
      const{cx,cy}=getCentre(sh);
      if(cx>=bx&&cx<=bx+bw&&cy>=by&&cy<=by+bh) A.multiSel.push(i);
    });
    redraw();updateMultiBadge();return;
  }

  // ── draw mode: update the live preview as the mouse moves ──
  if(A.isDrawing&&A.dragSh){
    A.dragSh.x2=sx;A.dragSh.y2=sy;
    document.getElementById('iw').textContent=pxToUnit(Math.abs(sx-A.dragX1)).toFixed(2)+' '+A.unit;
    document.getElementById('ih').textContent=pxToUnit(Math.abs(sy-A.dragY1)).toFixed(2)+' '+A.unit;
    redraw();return;
  }

  // ── hover highlight ──
  let hov=-1;
  for(let i=A.shapes.length-1;i>=0;i--){
    const l=layerById(A.shapes[i].layerId);
    if(!l||!l.visible||l.locked)continue;
    if(hitTest(rawX,rawY,A.shapes[i])){hov=i;break;}
  }
  if(hov!==A.hovIdx){ A.hovIdx=hov; redraw(); }
  sc.style.cursor=hov>=0?'move':'crosshair';
});

// ════════════════════════════════════════
// Mouse — mouseup
// ════════════════════════════════════════
sc.addEventListener('mouseup',e=>{
  const[rawX,rawY]=mxy(e);
  const[sx,sy]=snapPt(rawX,rawY);

  if(A.isMoving){
    A.isMoving=false;A.movOrigins=[];pushHistory();
    if(A.sel!==null)buildHandles();
    return;
  }

  // ── rubber-band selection complete ──
  if(A.isSelecting){
    A.isSelecting=false;
    selBox.style.display='none';
    const bx=Math.min(rawX,A.selX1),by=Math.min(rawY,A.selY1);
    const bw=Math.abs(rawX-A.selX1),bh=Math.abs(rawY-A.selY1);

    if(bw<5&&bh<5){
      // tiny movement = just a click on empty space, deselect everything
      A.multiSel=[]; A.sel=null; clearHandles(); updateMultiBadge();
      redraw(); return;
    }

    // real selection box: select all shapes whose centre is inside
    A.multiSel=[];
    A.shapes.forEach((sh,i)=>{
      const l=layerById(sh.layerId);if(!l||!l.visible||l.locked)return;
      const{cx,cy}=getCentre(sh);
      if(cx>=bx&&cx<=bx+bw&&cy>=by&&cy<=by+bh) A.multiSel.push(i);
    });
    if(A.multiSel.length===1){A.sel=A.multiSel[0];A.multiSel=[];syncSide();buildHandles();}
    else if(A.multiSel.length>1){A.sel=null;clearHandles();setStatus(A.multiSel.length+' shapes selected');}
    redraw();updateMultiBadge();
    return;
  }

  // in draw mode, shapes are committed on the SECOND CLICK (in mousedown),
  // not on mouseup — so nothing to do here for drawing.
});

sc.addEventListener('mouseleave',()=>{ coordBadge.style.display='none'; snapBadge.style.display='none'; A.hovIdx=-1; if(!A.isDrawing)redraw(); });
vp.addEventListener('wheel',e=>{if(!e.ctrlKey)return;e.preventDefault();doZoom(e.deltaY<0?1:-1);},{passive:false});

// ════════════════════════════════════════
// Sidebar sync
// ════════════════════════════════════════
function syncSide(){
  if(A.sel===null)return;
  const sh=A.shapes[A.sel];
  document.getElementById('skr').value=sh.stroke;document.getElementById('skv').textContent=sh.stroke;
  const rot=Math.round(sh.rotation||0);
  document.getElementById('rot-slider').value=rot;document.getElementById('rot-val').textContent=rot+'°';document.getElementById('ia').textContent=rot+'°';
  A.color=sh.color;A.fill=sh.fill;A.stroke=sh.stroke;A.shape=sh.type;
  document.querySelectorAll('#fseg button').forEach(b=>b.classList.toggle('active',b.dataset.v===sh.fill));
  document.getElementById('cc').value=sh.color;
  document.querySelectorAll('.sbtn').forEach(b=>b.classList.toggle('active',b.dataset.shape===sh.type));
  document.getElementById('iw').textContent=pxToUnit(Math.abs(sh.x2-sh.x1)).toFixed(2)+' '+A.unit;
  document.getElementById('ih').textContent=pxToUnit(Math.abs(sh.y2-sh.y1)).toFixed(2)+' '+A.unit;
}
function applyToSel(){
  const idxs=allSelected();if(!idxs.length)return;
  pushHistory();
  idxs.forEach(i=>{A.shapes[i].color=A.color;A.shapes[i].fill=A.fill;});
  redraw();
}

// ════════════════════════════════════════
// Controls
// ════════════════════════════════════════
function setGroup(g,btn){ document.querySelectorAll('.ugb').forEach(b=>b.classList.remove('active'));btn.classList.add('active');const sel=document.getElementById('usel');sel.innerHTML='';GROUPS[g].forEach(u=>{const o=document.createElement('option');o.value=u;o.textContent=u;sel.appendChild(o);});A.unit=GROUPS[g][g==='metric'?1:0];sel.value=A.unit;drawRulers();redraw(); }
function setFill(v,btn){ A.fill=v;document.querySelectorAll('#fseg button').forEach(b=>b.classList.remove('active'));btn.classList.add('active');applyToSel(); }
document.getElementById('skr').addEventListener('input',e=>{ A.stroke=+e.target.value;document.getElementById('skv').textContent=A.stroke;const idxs=allSelected();if(idxs.length){pushHistory();idxs.forEach(i=>A.shapes[i].stroke=A.stroke);redraw();} });
// sbtns click is handled above in setToolMode section — shape selection happens there too

function initPalette(){ const g=document.getElementById('cgrid');g.innerHTML='';PAL.forEach(c=>{ const sw=document.createElement('div');sw.className='sw'+(c===A.color?' active':'');sw.style.background=c;sw.onclick=()=>{A.color=c;document.getElementById('cc').value=c;document.querySelectorAll('.sw').forEach(s=>s.classList.remove('active'));sw.classList.add('active');applyToSel();};g.appendChild(sw); }); }
initPalette();
document.getElementById('cc').addEventListener('input',e=>{ A.color=e.target.value;document.querySelectorAll('.sw').forEach(s=>s.classList.remove('active'));applyToSel(); });

// ════════════════════════════════════════
// Toolbar
// ════════════════════════════════════════
function saveShape(){ const idxs=allSelected();if(!idxs.length){setStatus('Select a shape first');return;}pushHistory();idxs.forEach(i=>A.shapes[i].saved=true);renderSaved();setStatus('Saved!'); }
function clearAll(){ pushHistory();A.shapes=[];A.sel=null;A.multiSel=[];A.isDrawing=false;A.dragSh=null;clearHandles();renderSaved();setStatus('Canvas cleared');redraw();updateMultiBadge(); }

// ════════════════════════════════════════
// Saved list
// ════════════════════════════════════════
function renderSaved(){
  const el=document.getElementById('slist');
  if(!A.shapes.some(s=>s.saved)){el.innerHTML='<p class="emp">Nothing saved yet.</p>';return;}
  el.innerHTML='';
  A.shapes.forEach((sh,i)=>{
    if(!sh.saved)return;
    const l=layerById(sh.layerId);
    const row=document.createElement('div');row.className='si';
    const dot=document.createElement('div');dot.style.cssText='width:8px;height:8px;border-radius:50%;background:'+(l?l.color:'#999')+';flex-shrink:0';
    const tc=document.createElement('canvas');tc.width=20;tc.height=20;tc.style.flexShrink='0';
    const tx=tc.getContext('2d');tx.strokeStyle=sh.color;tx.lineWidth=1.5;tx.fillStyle=sh.fill==='filled'?sh.color:'transparent';
    tx.beginPath();
    if(sh.type==='circle')tx.arc(10,10,7,0,Math.PI*2);
    else if(sh.type==='triangle'){tx.moveTo(10,2);tx.lineTo(1,18);tx.lineTo(19,18);tx.closePath();}
    else if(sh.type==='dimension'){tx.moveTo(2,10);tx.lineTo(18,10);tx.moveTo(2,6);tx.lineTo(2,14);tx.moveTo(18,6);tx.lineTo(18,14);}
    else tx.rect(2,4,16,12);
    if(sh.fill==='filled')tx.fill();tx.stroke();
    const lbl=document.createElement('span');lbl.className='si-l';lbl.textContent=(SH_NAMES[sh.type]||sh.type)+' '+(i+1)+(l?' ['+l.name+']':'');
    const del=document.createElement('button');del.className='si-d';del.textContent='×';
    del.onclick=ev=>{ev.stopPropagation();pushHistory();A.shapes.splice(i,1);if(A.sel===i){A.sel=null;clearHandles();}else if(A.sel>i)A.sel--;A.multiSel=A.multiSel.filter(x=>x!==i).map(x=>x>i?x-1:x);renderSaved();redraw();updateMultiBadge();};
    row.onclick=()=>{A.sel=i;A.multiSel=[];syncSide();buildHandles();redraw();updateMultiBadge();};
    row.append(dot,tc,lbl,del);el.appendChild(row);
  });
}
function setStatus(m){ document.getElementById('status').textContent=m; }

// ════════════════════════════════════════
// Boot
// ════════════════════════════════════════
renderLayers();
initSheet('A3');
setTimeout(()=>{ zoomFit(); drawRulers(); },100);
