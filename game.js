// game.js - simple Drive Mad like game
(() => {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;

  // UI elements
  const scoreEl = document.getElementById('score');
  const levelEl = document.getElementById('level');
  const distanceEl = document.getElementById('distance');
  const energyFill = document.getElementById('energy-fill');
  const energyDecBtn = document.getElementById('energy-decrease');
  const energyIncBtn = document.getElementById('energy-increase');
  const levelUpBtn = document.getElementById('level-up');
  const lvlCostEl = document.getElementById('lvl-cost');

  // Game state
  let score = 0;
  let distance = 0;
  let level = 1;
  let lvlCost = 100;

  // Terrain generation (segments)
  const terrain = [];
  const SEG_W = 80; // width of a segment in px
  const worldLength = 120; // number of segments
  let offsetX = 0; // camera offset

  // Car
  const car = {
    x: 150,
    y: 0,
    vx: 0,
    vy: 0,
    angle: 0,
    wheelRot: 0,
    width: 80,
    height: 30,
    onGround: false,
    speedFactor: 0.12, // throttle accel
    maxEnergy: 100,
    energy: 100,
    mass: 1.8,
  };

  // physics
  const GRAV = 0.5;
  const FRICTION_GROUND = 0.95;
  const MAX_V = 12 + level * 0.5;

  // Controls
  const keys = { left:false, right:false, up:false };

  // Generate terrain: mix of flat, hills, and a bridge in middle
  function generateTerrain(){
    terrain.length = 0;
    // base height
    const base = H - 120;
    for(let i=0;i<worldLength;i++){
      let h = base;
      // create hills in ranges
      if(i>6 && i<20){ h -= Math.sin(i*0.6)*40 - 10; }
      else if(i>22 && i<38){ h -= Math.sin(i*0.4)*70; }
      else if(i>40 && i<55){ h -= Math.cos(i*0.6)*35; }
      else if(i>60 && i<75){ h -= Math.sin(i*0.5)*55; }
      else if(i>78 && i<85){ h = base - 140; } // high ledge
      // bridge around middle
      if(i === Math.floor(worldLength/2) - 2){
        // make a gap and then a bridge spanning three segments
        terrain.push({height:base, type:'gap'});
        terrain.push({height:base, type:'bridge'});
        terrain.push({height:base, type:'bridge'});
        i += 2;
        continue;
      }
      terrain.push({height:Math.max(100, Math.round(h)), type:'ground'});
    }
  }

  // find ground y for a given world x
  function groundY(worldX){
    const idx = Math.floor(worldX / SEG_W);
    if(idx < 0) return H;
    if(idx >= terrain.length) return H;
    const seg = terrain[idx];
    if(seg.type === 'gap') return H + 1000; // very low
    return seg.height;
  }

  // draw terrain with simple polygon and bridge
  function drawTerrain(camX){
    ctx.save();
    ctx.translate(-camX,0);
    // draw ground segments
    ctx.beginPath();
    for(let i=0;i<terrain.length;i++){
      const x = i*SEG_W;
      const y = terrain[i].type === 'gap' ? H+200 : terrain[i].height;
      if(i===0) ctx.moveTo(x,y);
      else ctx.lineTo(x,y);
    }
    ctx.lineTo(terrain.length*SEG_W, H);
    ctx.lineTo(0,H);
    ctx.closePath();
    ctx.fillStyle = '#cdbf90';
    ctx.fill();

    // bridge drawing
    const mid = Math.floor(worldLength/2);
    for(let i=mid-2;i<=mid;i++){
      if(terrain[i] && terrain[i].type === 'bridge'){
        const x = i*SEG_W;
        const y = terrain[i].height;
        // deck
        ctx.fillStyle = '#6b3f2a';
        ctx.fillRect(x+10, y-20, SEG_W-20, 20);
        // supports
        ctx.fillStyle = '#4b2b18';
        ctx.fillRect(x+12, y, 10, 40);
        ctx.fillRect(x+SEG_W-26, y, 10, 40);
      }
    }

    // simple decorations (grass)
    for(let i=0;i<terrain.length;i+=2){
      const x = i*SEG_W + 8;
      const y = terrain[i].type === 'gap' ? H+200 : terrain[i].height;
      if(terrain[i].type === 'ground'){
        ctx.fillStyle = '#2f8b3a';
        ctx.fillRect(x, y-6, 12, 6);
      }
    }

    ctx.restore();
  }

  // Draw car - simple boxy jeep
  function drawCar(){
    const cx = car.x;
    const cy = car.y;

    // body
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(car.angle);
    // chassis
    ctx.fillStyle = '#f2d45a';
    roundRect(ctx, -car.width/2, -car.height-10, car.width, car.height, 6, true, false);
    // windows
    ctx.fillStyle = '#cfe7ff';
    ctx.fillRect(-car.width/2 + 8, -car.height-6, car.width/3, car.height/2);
    ctx.fillRect( -car.width/2 + 8 + car.width/3 + 6, -car.height-6, car.width/3 - 8, car.height/2);

    // wheels
    ctx.restore();
    // left wheel
    drawWheel(car.x - car.width*0.27, car.y+6, 18, car.wheelRot);
    // right wheel
    drawWheel(car.x + car.width*0.27, car.y+6, 18, car.wheelRot);
  }

  function drawWheel(x,y,r,rot){
    ctx.save();
    ctx.translate(x,y);
    ctx.rotate(rot);
    ctx.beginPath();
    ctx.fillStyle = '#111';
    ctx.arc(0,0,r,0,Math.PI*2);
    ctx.fill();
    // hub
    ctx.fillStyle = '#777';
    ctx.beginPath();
    ctx.arc(0,0,r*0.45,0,Math.PI*2);
    ctx.fill();
    ctx.restore();
  }

  function roundRect(ctx,x,y,w,h,r,fill,stroke){
    if (typeof r === 'undefined') r = 5;
    ctx.beginPath();
    ctx.moveTo(x+r,y);
    ctx.arcTo(x+w,y,x+w,y+h,r);
    ctx.arcTo(x+w,y+h,x,y+h,r);
    ctx.arcTo(x,y+h,x,y,r);
    ctx.arcTo(x,y,x+w,y,r);
    ctx.closePath();
    if(fill) ctx.fill();
    if(stroke) ctx.stroke();
  }

  // update physics & game loop
  let lastT = performance.now();
  function loop(t){
    const dt = Math.min(40, t - lastT);
    lastT = t;

    update(dt/16);
    render();

    requestAnimationFrame(loop);
  }

  function update(step){
    // controls -> throttle
    const throttle = keys.left ? 1 : 0;
    const brake = keys.right ? 1 : 0;

    // consumption based on throttle and level
    const consumeRate = 0.05 + 0.01 * level;
    if(throttle && car.energy > 0){
      car.vx += car.speedFactor * (1 + level*0.02);
      car.energy = Math.max(0, car.energy - consumeRate);
    }
    if(brake){
      car.vx *= 0.9;
      car.energy = Math.max(0, car.energy - consumeRate*0.6);
    }

    // gravity
    car.vy += GRAV;

    // simple ground collision detection
    const worldX = car.x + offsetX;
    const gY = groundY(worldX);
    if(car.y + 12 >= gY){
      // land
      car.y = gY - 12;
      car.vy = 0;
      car.onGround = true;
    } else {
      car.onGround = false;
    }

    // apply movement
    car.x += car.vx;
    car.y += car.vy;

    // if jump requested
    if(keys.up && car.onGround){
      car.vy = -10 - level*0.8;
      car.onGround = false;
      car.energy = Math.max(0, car.energy - 4);
    }

    // friction if on ground
    if(car.onGround) car.vx *= FRICTION_GROUND;
    else car.vx *= 0.999;

    // clamp vx
    const maxSpeed = 12 + level*1.2;
    car.vx = Math.max(-4, Math.min(maxSpeed, car.vx));

    // wheel rotation
    car.wheelRot += car.vx*0.12;

    // camera: follow car
    const camTarget = Math.max(0, car.x - 200);
    offsetX = lerp(offsetX, camTarget, 0.08);

    // update score & distance
    distance = Math.max(0, Math.floor((car.x + offsetX)/10));
    score = Math.floor(distance + level*10 + (100 - car.energy)*0.2);
    scoreEl.textContent = score;
    distanceEl.textContent = distance;
    levelEl.textContent = level;

    // energy bar
    energyFill.style.width = Math.round((car.energy / car.maxEnergy) * 100) + '%';

    // auto-small regen when idle & level>1
    if(!keys.left && !keys.right && car.onGround){
      car.energy = Math.min(car.maxEnergy, car.energy + 0.025*level);
    }

    // level up auto when score >= cost?
    // (we leave level-up to button)

    // clamp car within world
    if(car.x > worldLength*SEG_W - 60){
      car.x = worldLength*SEG_W - 60;
      car.vx = 0;
    }

    // if car falls into gap (big fall) reset a bit
    if(car.y > H + 300){
      // respawn at last safe place
      car.x = 150;
      car.y = groundY(150)-12;
      car.vx = 0;
      car.vy = 0;
      car.energy = Math.max(20, car.energy - 30);
    }
  }

  function render(){
    ctx.clearRect(0,0,W,H);

    // sky gradient (already in css but canvas sized)
    const g = ctx.createLinearGradient(0,0,0,H);
    g.addColorStop(0,'#87ceff');
    g.addColorStop(0.6,'#86b6ff');
    g.addColorStop(1,'#cfeaff');
    ctx.fillStyle = g;
    ctx.fillRect(0,0,W,H);

    // mountains simple
    drawMountains(offsetX);

    // terrain
    drawTerrain(offsetX);

    // draw car relative to camera
    ctx.save();
    ctx.translate(-offsetX, 0);
    drawCar();
    ctx.restore();

    // HUD overlay small
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(8,8,220,56);
    ctx.fillStyle = '#fff';
    ctx.font = '14px Arial';
    ctx.fillText(`Score: ${score}`, 16, 28);
    ctx.fillText(`Level: ${level}`, 16, 46);
  }

  function drawMountains(camX){
    ctx.save();
    ctx.translate(-camX*0.2, 0);
    // 3 layers
    ctx.fillStyle = '#2b60a3';
    ctx.beginPath();
    ctx.moveTo(-200, H);
    ctx.lineTo(120, H-180);
    ctx.lineTo(360, H);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#4b86c6';
    ctx.beginPath();
    ctx.moveTo(200, H);
    ctx.lineTo(420, H-220);
    ctx.lineTo(760, H);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  // helpers
  function lerp(a,b,t){ return a + (b-a)*t; }

  // input
  window.addEventListener('keydown', (e)=>{
    if(e.key === 'a' || e.key === 'ArrowLeft') keys.left = true;
    if(e.key === 'd' || e.key === 'ArrowRight') keys.right = true;
    if(e.key === 'w' || e.key === ' ' || e.key === 'Spacebar') keys.up = true;
  });
  window.addEventListener('keyup', (e)=>{
    if(e.key === 'a' || e.key === 'ArrowLeft') keys.left = false;
    if(e.key === 'd' || e.key === 'ArrowRight') keys.right = false;
    if(e.key === 'w' || e.key === ' ' || e.key === 'Spacebar') keys.up = false;
  });

  // UI buttons
  energyDecBtn.addEventListener('click', ()=>{
    car.maxEnergy = Math.max(40, car.maxEnergy - 10);
    car.energy = Math.min(car.energy, car.maxEnergy);
  });
  energyIncBtn.addEventListener('click', ()=>{
    // increase energy capacity cost = 20 score
    if(score >= 20){
      score -= 20;
      car.maxEnergy = Math.min(200, car.maxEnergy + 10);
      car.energy = car.maxEnergy;
      scoreEl.textContent = score;
    } else {
      flashMsg('Need 20 score to increase energy');
    }
  });

  levelUpBtn.addEventListener('click', ()=>{
    if(score >= lvlCost){
      score -= lvlCost;
      level += 1;
      lvlCost = Math.round(lvlCost * 1.8);
      lvlCostEl.textContent = lvlCost;
      // small buff on level up
      car.speedFactor += 0.01;
      car.maxEnergy = Math.min(300, car.maxEnergy + 15);
      car.energy = car.maxEnergy;
      scoreEl.textContent = score;
      levelEl.textContent = level;
    } else {
      flashMsg('Score not enough for level up');
    }
  });

  // message bar
  function flashMsg(text){
    const el = document.createElement('div');
    el.textContent = text;
    el.style.position = 'fixed';
    el.style.left = '50%';
    el.style.transform = 'translateX(-50%)';
    el.style.top = '18px';
    el.style.background = 'rgba(0,0,0,0.6)';
    el.style.color = '#fff';
    el.style.padding = '8px 12px';
    el.style.borderRadius = '6px';
    document.body.appendChild(el);
    setTimeout(()=>{ el.style.transition = 'opacity 300ms'; el.style.opacity = '0'; }, 1200);
    setTimeout(()=>el.remove(), 1600);
  }

  // init
  function init(){
    generateTerrain();
    car.x = 150;
    car.y = groundY(150)-12;
    car.vx = 0;
    car.vy = 0;
    lvlCostEl.textContent = lvlCost;
    requestAnimationFrame(loop);
    canvas.focus();
  }

  init();

})();
