/* hotel/exterior.js — Hotel Presidential. 5-star curved glass tower on
   Woji Road: rounded drum + flanking wings, gold crown, porte-cochère,
   pool deck and palm-lined driveway. */
import * as THREE from "three";
import { M, EM, textLabel, windowTexture, getEnv } from "../../core/kit.js";
import meta from "./meta.js";

export function buildExterior() {
  const g = new THREE.Group();

  const glassMat = new THREE.MeshStandardMaterial({
    map: windowTexture("#e6eef5", "#ffd76b", 6, 12),
    roughness: 0.22, metalness: 0.65, envMap: getEnv(),
  });
  const goldMat = M(0xd4af37, 0.35, 0.85);
  const stoneMat = M(0xe8e0d0, 0.9);
  const roofMat = M(0x1a1a1e, 0.8);
  const poolMat = new THREE.MeshStandardMaterial({ color: 0x2a9ac4, roughness: 0.05, metalness: 0.35, transparent: true, opacity: 0.85 });
  const palmTrunk = M(0x6b5340, 0.9);
  const palmLeaf = M(0x2f8a4a, 1);

  const add = (geo, mat, x, y, z, shadow) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    if (shadow) { m.castShadow = true; m.receiveShadow = true; }
    g.add(m);
    return m;
  };

  /* Curved drum (open arc facing +Z so the front reads as glass sweep) */
  add(new THREE.CylinderGeometry(8, 8, 22, 28, 1, false), glassMat, 0, 11, 0, true);
  const crown = add(new THREE.TorusGeometry(8.15, 0.28, 8, 32), goldMat, 0, 22, 0);
  crown.rotation.x = Math.PI / 2;
  add(new THREE.CylinderGeometry(3.2, 3.4, 3.2, 20), glassMat, 0, 23.6, 0);
  add(new THREE.ConeGeometry(3.8, 1.8, 20), roofMat, 0, 26.1, 0);
  add(new THREE.SphereGeometry(0.22, 10, 8), EM(0xff3030, 2.4), 0, 27.2, 0);

  /* Wings */
  for (const s of [-1, 1]) {
    add(new THREE.BoxGeometry(6, 15, 10), glassMat, s * 10.5, 7.5, -1, true);
    add(new THREE.BoxGeometry(6.3, 0.32, 10.3), goldMat, s * 10.5, 15.16, -1);
    for (let i = -2; i <= 2; i++) add(new THREE.BoxGeometry(0.14, 15, 0.3), goldMat, s * 10.5 + i * 1.2, 7.5, 4.1);
  }

  /* Porte-cochère */
  add(new THREE.BoxGeometry(16, 0.5, 6), stoneMat, 0, 4.5, 8, true);
  add(new THREE.BoxGeometry(16.2, 0.14, 6.2), goldMat, 0, 4.78, 8);
  for (const x of [-6, -2, 2, 6]) {
    add(new THREE.CylinderGeometry(0.32, 0.36, 4.2, 10), stoneMat, x, 2.1, 10.4, true);
    add(new THREE.CylinderGeometry(0.42, 0.32, 0.22, 10), goldMat, x, 4.42, 10.4);
  }

  /* Revolving door */
  const ring = add(new THREE.TorusGeometry(1.6, 0.16, 8, 24), goldMat, 0, 1.8, 7.4);
  ring.rotation.x = Math.PI / 2;
  add(new THREE.CylinderGeometry(1.4, 1.4, 3.2, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xbcd8f0, transparent: true, opacity: 0.35, side: THREE.DoubleSide }), 0, 1.6, 7.4);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const mu = add(new THREE.BoxGeometry(0.06, 3.2, 0.06), goldMat, Math.cos(a) * 1.4, 1.6, 7.4 + Math.sin(a) * 1.4);
    mu.rotation.y = -a;
  }

  /* HOTEL SITE PLAN — every exterior feature belongs to a clear zone.
     Front = +Z. Tower and porte-cochere are the centre; pool is east,
     tennis/garden is west, and the arrival court/drive is directly ahead. */

  /* EAST WING: pool terrace, immediately beside the tower rather than
     floating in the arrival court. */
  add(new THREE.BoxGeometry(13.5, 0.22, 18), stoneMat, 22.5, 0.11, -1.0, true);
  add(new THREE.BoxGeometry(8.2, 0.08, 12.0), poolMat, 22.5, 0.26, -1.0);
  for (const [x,z,w,d] of [[22.5,-7,8.6,.22],[22.5,5,8.6,.22],[18.3,-1,.22,12.2],[26.7,-1,.22,12.2]])
    add(new THREE.BoxGeometry(w,.24,d), goldMat,x,.25,z);
  for (const [x,z] of [[18.5,-6],[22.5,-6],[26.5,-6],[18.5,4],[22.5,4],[26.5,4]]) {
    add(new THREE.BoxGeometry(1.35,.16,2.15),M(0xfff0d0,.9),x,.42,z);
    const back=add(new THREE.BoxGeometry(1.35,.62,.14),M(0xe0d0b0,.9),x,.73,z-.85);
    back.rotation.x=-.22;
  }
  for (const x of [16.5,28.5]) for (const z of [-7,5]) {
    add(new THREE.CylinderGeometry(.18,.22,2.4,8),palmTrunk,x,1.2,z,true);
    for(let f=0;f<6;f++) { const a=f*Math.PI/3; const leaf=add(new THREE.ConeGeometry(.42,2.4,4),palmLeaf,x+Math.cos(a)*.7,2.45,z+Math.sin(a)*.7); leaf.rotation.set(Math.cos(a),0,-Math.sin(a)); }
  }

  /* WEST WING: landscaped garden and a correctly aligned tennis court. */
  add(new THREE.BoxGeometry(17,0.18,12),M(0x71805c,.95),-22.5,.09,-1,true);
  add(new THREE.BoxGeometry(15,.08,8),M(0x315b48,.95),-22.5,.22,-1);
  for (const x of [-29.5,-15.5]) for (const z of [-6,4]) {
    add(new THREE.BoxGeometry(1.5,.35,1.5),M(0x806044,.95),x,.2,z,true);
    add(new THREE.SphereGeometry(.72,10,8),palmLeaf,x,.85,z);
  }
  /* Tennis court: green playing surface, white boundary lines and net. */
  add(new THREE.BoxGeometry(15,.08,8),M(0x286b48,.95),-22.5,.28,-1);
  for(const [x,z,w,d] of [[-22.5,-5,14.6,.07],[-22.5,3,14.6,.07],[-29.8,-1,.07,7.8],[-15.2,-1,.07,7.8],[-22.5,-1,.07,7.8]])
    add(new THREE.BoxGeometry(w,.025,d),M(0xf4f1e8,.9),x,.34,z);
  add(new THREE.BoxGeometry(.08,1.0,.08),M(0xe6e1d5,.9),-22.5,.78,-1,true);
  add(new THREE.BoxGeometry(14.5,.06,.06),M(0xe6e1d5,.9),-22.5,.78,-1);

  /* FRONT ARRIVAL COURT: one continuous paved forecourt leading to the
     main entrance. Steps and canopy stay on the same centre line. */
  add(new THREE.BoxGeometry(54,.18,32),M(0xb8b0a4,.9),0,.09,24,true).receiveShadow=true;
  add(new THREE.BoxGeometry(18,.28,5),stoneMat,0,.14,13.2,true);
  for(let i=0;i<7;i++) {
    const step=add(new THREE.BoxGeometry(18-i*.35,.18,.72),M(0xd6cbb8,.95),0,.18+i*.18,10.4-i*.72,true);
    step.receiveShadow=true;
  }
  /* A centred arrival loop: two clear vehicle lanes pass the fountain. */
  add(new THREE.BoxGeometry(8,.12,24),M(0x34343a,.65),0,.16,36,true);
  add(new THREE.BoxGeometry(4,.12,24),M(0xb8b0a4,.9),0,.17,36);
  add(new THREE.CylinderGeometry(2.6,2.9,.5,32),stoneMat,-15,.25,23,true);
  add(new THREE.CylinderGeometry(2.15,2.15,.08,32),poolMat,-15,.55,23);
  add(new THREE.CylinderGeometry(.32,.48,1.2,12),goldMat,-15,1.18,23);
  add(new THREE.SphereGeometry(.38,16,12),EM(0x9feaff,1.4),-15,1.98,23);

  /* Symmetrical planting beds frame the approach instead of scattered
     flower pots. Keep the central vehicle route completely unobstructed. */
  const tropical=[M(0x267a43,1),M(0x4b9b50,1),M(0xf0a34a,.8),M(0xe7d26a,.8),M(0xd96b83,.8)];
  for(const x of [-21,21]) for(const z of [17,29]) {
    add(new THREE.BoxGeometry(5.2,.42,3.2),M(0x806044,.95),x,.22,z,true);
    add(new THREE.BoxGeometry(5,.18,3),M(0x327b42,1),x,.5,z);
    for(let j=0;j<7;j++) {
      const px=x-2.0+(j%4)*1.25, pz=z-0.8+Math.floor(j/4)*1.2;
      add(new THREE.SphereGeometry(.22,8,6),tropical[(j+(x>0?2:0))%tropical.length],px,.78,pz);
    }
  }
  /* Palm rows follow both edges of the driveway at equal intervals. */
  for(let i=0;i<5;i++) for(const side of [-1,1]) {
    const x=side*8.2, z=16+i*5.2, th=5.2+(i%3)*.25;
    add(new THREE.CylinderGeometry(.18,.24,th,7),palmTrunk,x,th/2,z,true);
    for(let f=0;f<7;f++) { const a=f*Math.PI*2/7; const leaf=add(new THREE.ConeGeometry(.48,2.8,4),palmLeaf,x+Math.cos(a)*.85,th+.35,z+Math.sin(a)*.85); leaf.rotation.set(Math.cos(a)*1.05,0,-Math.sin(a)*1.05); }
  }
  /* Valet/security pavilion sits at the forecourt's east edge, with a
     clear view of the entrance and no overlap with the pool terrace. */
  add(new THREE.BoxGeometry(4.8,2.8,3.8),stoneMat,22.8,1.4,34,true);
  add(new THREE.BoxGeometry(5,.18,4),goldMat,22.8,2.86,34);
  add(new THREE.BoxGeometry(3.6,1.1,.12),glassMat,22.8,1.55,32.05);
  for(let i=0;i<7;i++) {
    const x=-6+i*2;
    add(new THREE.CylinderGeometry(.11,.14,.8,8),goldMat,x,.4,40);
    add(new THREE.SphereGeometry(.15,8,6),EM(0xffd88a,1.2),x,.88,40);
  }
  /* Discreet perimeter hedge and low garden lights define the site edge. */
  for(const x of [-27,27]) for(let i=0;i<4;i++) {
    const z=13+i*8;
    add(new THREE.BoxGeometry(.45,.8,5.5),M(0x2f7040,1),x,.4,z);
    add(new THREE.CylinderGeometry(.07,.09,1.15,8),goldMat,x+(x<0?1:-1),.58,z);
    add(new THREE.SphereGeometry(.13,8,6),EM(0xffd88a,1.1),x+(x<0?1:-1),1.2,z);
  }

  /* Sign + 5 stars */
  const lbl = textLabel(meta.name, meta.sub);
  lbl.position.y = 6.4;
  lbl.scale.multiplyScalar(1.3);
  g.add(lbl);
  for (let i = 0; i < 5; i++) add(new THREE.OctahedronGeometry(0.32, 0), EM(0xffd76b, 1.8), -2.4 + i * 1.2, 5.6, 6.4);

  /* The old tower was ~12m; scale so the landmark stays in proportion
     with the other exteriors on the map. */
  g.scale.setScalar(0.70);
  return g;
}
