"use client";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import {
  isGlimpseOfUs,
  isRomanticPortraitSong,
  portraitLens,
} from "../lib/portrait-songs";
import { portraitEffects } from "../lib/portrait-effects";
import { genres } from "../lib/music";
import type { MapNode } from "../lib/constellation";
import type { SceneCommand } from "./constellation";

let portraitBytes: Promise<ArrayBuffer> | undefined;
function loadPortraitBytes() {
  return (portraitBytes ??= fetch("/portrait.bin")
    .then((response) => {
      if (!response.ok) throw Error("Portrait unavailable");
      return response.arrayBuffer();
    })
    .catch((error) => {
      portraitBytes = undefined;
      throw error;
    }));
}

let expressionBytes: Promise<ArrayBuffer> | undefined;
function loadExpressionBytes() {
  return (expressionBytes ??= fetch("/portrait-expressions.bin")
    .then((response) => {
      if (!response.ok) throw Error("Portrait expressions unavailable");
      return response.arrayBuffer();
    })
    .catch((error) => {
      expressionBytes = undefined;
      throw error;
    }));
}

type Props = {
  genre: string;
  songs: MapNode[];
  playCounts: Record<string, number>;
  onSelect: (id: string) => void;
  theme: "dark" | "light";
  command: SceneCommand;
  onReady: (ready: boolean) => void;
};
export default function Portrait2D({
  genre,
  theme,
  command,
  onReady,
  songs,
  playCounts,
  onSelect,
}: Props) {
  const host = useRef<HTMLDivElement>(null);
  const state = useRef({ genre, theme, command, songs, playCounts, onSelect });
  state.current = { genre, theme, command, songs, playCounts, onSelect };
  const density = 85;
  const [headphonesOff, setHeadphonesOff] = useState(false);
  const [tongueRequest, setTongueRequest] = useState(0);
  const [tongueVisible, setTongueVisible] = useState(false);
  const [signature, setSignature] = useState(0);
  const [signatureVisible, setSignatureVisible] = useState(false);
  const options = useRef({ headphonesOff, tongueRequest, signature });
  options.current = { headphonesOff, tongueRequest, signature };
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const container = host.current!;
    let alive = true,
      frame = 0;
    let renderer: THREE.WebGLRenderer | undefined;
    let geometry: THREE.BufferGeometry | undefined;
    let material: THREE.ShaderMaterial | undefined;
    let tongueGeometry: THREE.BufferGeometry | undefined;
    let tongueMaterial: THREE.ShaderMaterial | undefined;
    let headsetGeometry: THREE.BufferGeometry | undefined;
    let headsetMaterial: THREE.ShaderMaterial | undefined;
    let trailGeometry: THREE.BufferGeometry | undefined;
    let tooltip: HTMLButtonElement | undefined;
    const trailMaterials: THREE.ShaderMaterial[] = [];
    let starsGeometry: THREE.BufferGeometry | undefined;
    let starsMaterial: THREE.ShaderMaterial | undefined;
    let observer: ResizeObserver | undefined;
    let removeEvents = () => {};
    setError(false);
    onReady(false);
    async function start() {
      const [buffer, expressions] = await Promise.all([
        loadPortraitBytes(),
        loadExpressionBytes(),
      ]);
      if (!alive) return;
      if (buffer.byteLength < 12) throw Error("Invalid portrait data");
      const view = new DataView(buffer);
      const source = {
        width: view.getUint32(0, true),
        height: view.getUint32(4, true),
      };
      const count = view.getUint32(8, true);
      if (
        !source.width ||
        !source.height ||
        buffer.byteLength !== 12 + count * 8
      )
        throw Error("Invalid portrait data");
      const positions = new Float32Array(count * 3),
        colors = new Float32Array(count * 3),
        seeds = new Float32Array(count);
      for (let i = 0; i < count; i++) {
        const at = 12 + i * 8;
        positions[i * 3] =
          ((view.getUint16(at, true) / 65535 - 0.5) * source.width) /
          source.height;
        positions[i * 3 + 1] = 0.5 - view.getUint16(at + 2, true) / 65535;
        for (let c = 0; c < 3; c++)
          colors[i * 3 + c] = view.getUint8(at + 4 + c) / 255;
        seeds[i] = view.getUint8(at + 7) / 255;
      }
      if (
        expressions.byteLength !== 8 + count * 9 ||
        new TextDecoder().decode(expressions.slice(0, 4)) !== "RDPX"
      )
        throw Error("Invalid expression data");
      const expression = new Uint8Array(expressions);
      const tongueColors = new Float32Array(count * 4),
        bareColors = new Float32Array(count * 4),
        headphoneMask = new Float32Array(count),
        gearMask = new Float32Array(count);
      for (let i = 0; i < count; i++) {
        for (let c = 0; c < 4; c++) {
          tongueColors[i * 4 + c] = expression[8 + i * 9 + c] / 255;
          bareColors[i * 4 + c] = expression[8 + i * 9 + 4 + c] / 255;
        }
        headphoneMask[i] = expression[8 + i * 9 + 8] > 0 ? 1 : 0;
        gearMask[i] = expression[8 + i * 9 + 8] > 200 ? 1 : 0;
      }
      // Every target belongs to an existing portrait particle: no incoming swarm.
      await document.fonts.ready;
      if (!alive) return;
      const lettering = document.createElement("canvas");
      lettering.width = 1200;
      lettering.height = 320;
      const ink = lettering.getContext("2d")!;
      ink.font = '700 250px "DM Sans Variable", sans-serif';
      ink.textAlign = "center";
      ink.textBaseline = "middle";
      ink.fillText("wrestle", 600, 160, 1120);
      const pixels = ink.getImageData(0, 0, 1200, 320).data;
      const glyph: number[] = [];
      for (let y = 0; y < 320; y += 3)
        for (let x = 0; x < 1200; x += 3)
          if (pixels[(y * 1200 + x) * 4 + 3] > 128)
            glyph.push((x - 600) / 1200, (160 - y) / 1200);
      const wordPositions = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        const target = ((i * 997) % (glyph.length / 2)) * 2;
        wordPositions[i * 3] = glyph[target] + Math.sin(i * 127.1) * 0.0006;
        wordPositions[i * 3 + 1] =
          glyph[target + 1] + Math.cos(i * 311.7) * 0.0006;
      }
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: false,
        powerPreference: "low-power",
      });
      renderer.setPixelRatio(Math.min(Math.max(devicePixelRatio, 1.5), 2));
      renderer.setClearColor(0, 0);
      renderer.domElement.setAttribute(
        "aria-label",
        "Interactive 2D particle portrait of Russel",
      );
      renderer.domElement.setAttribute("role", "img");
      container.appendChild(renderer.domElement);
      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
      camera.position.z = 2;
      geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(positions, 3),
      );
      geometry.setAttribute(
        "aColor",
        new THREE.Float32BufferAttribute(colors, 3),
      );
      geometry.setAttribute(
        "wordPosition",
        new THREE.Float32BufferAttribute(wordPositions, 3),
      );
      geometry.setAttribute("seed", new THREE.Float32BufferAttribute(seeds, 1));
      geometry.setAttribute(
        "tongueColor",
        new THREE.Float32BufferAttribute(tongueColors, 4),
      );
      geometry.setAttribute(
        "bareColor",
        new THREE.Float32BufferAttribute(bareColors, 4),
      );
      geometry.setAttribute(
        "headphoneMask",
        new THREE.Float32BufferAttribute(headphoneMask, 1),
      );
      geometry.setAttribute(
        "gearMask",
        new THREE.Float32BufferAttribute(gearMask, 1),
      );
      const reduced = matchMedia("(prefers-reduced-motion: reduce)");
      // One choreography shared by the face, expression and sparse afterimages.
      const choreographyShader = `
        uniform float signature, revealTime, wordScale, wordPointSize, trailOffset;
        uniform vec2 wordPointer;
        float landing; float energy; float satellite;
        vec3 choreograph(vec3 origin, vec3 glyph, float id){
          landing=0.; energy=0.; satellite=0.;
          if(signature<=0.) return origin;
          float progress=clamp(signature-trailOffset*sin(signature*3.14159),0.,1.);
          float column=clamp(glyph.x+.5,0.,1.);
          landing=smoothstep(.46+column*.14,.84+column*.14,progress);
          float winding=smoothstep(.055,.44,progress);
          float lane=floor((origin.y+.5)*9.);
          float hash=fract(sin(dot(origin.xy,vec2(127.1,311.7)))*43758.5453);
          float angle=mix(atan(origin.y,origin.x),hash*6.28318,winding)+progress*7.8+lane*.28+revealTime*.55;
          float radius=(.22+lane*.018+hash*.025)*min(wordScale,1.5);
          vec3 ribbon=vec3(cos(angle)*radius,sin(angle)*radius*.48,sin(angle)*.12);
          ribbon.y+=sin(angle*2.+lane)*.025;
          vec3 target=glyph*wordScale;
          satellite=1.-step(.008,id);
          float orbit=hash*6.28318+revealTime*(.8+id*20.);
          vec3 halo=vec3(cos(orbit)*.49,sin(orbit)*.18,sin(orbit)*.06)*wordScale;
          halo.y+=cos(orbit)*.035*wordScale*(step(.004,id)*2.-1.);
          target=mix(target,halo,satellite*motion);
          float settle=sin(landing*3.14159)*exp(-landing*2.);
          target.y+=sin(revealTime*2.8+column*8.)*.006*wordScale*landing*motion;
          target.y+=settle*(.11+hash*.04)*motion;
          float proximity=exp(-pow(length(target.xy-wordPointer)*9.,2.))*motion;
          target.xy+=(target.xy-wordPointer)*proximity*.32;
          vec3 p=mix(origin*(1.-sin(progress*3.14159)*.1),ribbon,winding);
          p=mix(p,target,landing);
          // Project the orbit depth before the portrait group's pixel-scale transform.
          p.xy*=1.+p.z*.25;
          p.z=0.;
          energy=sin(progress*3.14159)*(1.-landing*.65);
          return p;
        }
      `;
      const uniforms = {
        time: { value: 0 },
        amount: { value: 0 },
        accent: { value: new THREE.Color("#67d8bc") },
        pointer: { value: new THREE.Vector2(10, 10) },
        hover: { value: 0 },
        motion: { value: 1 },
        light: { value: 0 },
        pointSize: { value: 1 },
        density: { value: 0.85 },
        profile: { value: new THREE.Vector3() },
        ripple: { value: new THREE.Vector3(0, 0, -10) },
        tongue: { value: 0 },
        bare: { value: 0 },
        gearLayer: { value: 0 },
        signature: { value: 0 },
        revealTime: { value: 0 },
        trailOffset: { value: 0 },
        trail: { value: 0 },
        wordPointer: { value: new THREE.Vector2(10, 10) },
        wordScale: { value: 1 },
        wordPointSize: { value: renderer.getPixelRatio() * 1.6 },
      };
      material = new THREE.ShaderMaterial({
        transparent: true,
        depthTest: false,
        depthWrite: false,
        uniforms,
        vertexShader: `attribute vec3 aColor, wordPosition; attribute float seed; attribute vec4 tongueColor, bareColor; attribute float headphoneMask, gearMask;
          uniform float time, amount, motion, pointSize, hover, density, tongue, bare, gearLayer;
          uniform vec2 pointer; uniform vec3 profile, ripple;
          varying vec3 color; varying float glow, keep, opacity;
          ${choreographyShader}
          void main(){
            vec3 p=position; vec2 delta=p.xy-pointer; float d=length(delta);
            float near=exp(-d*d*70.)*hover;
            float t=time*profile.y, phase=p.y*14.+p.x*8.;
            vec2 dance=vec2(0.);
            if(profile.x<.5){float beat=pow(.5+.5*sin(t*3.-length(p.xy)*12.),4.);dance=p.xy*beat*profile.z;}
            else if(profile.x<1.5){dance=vec2(sin(phase+t),cos(p.x*10.-t*.7)*.35)*profile.z;}
            else if(profile.x<2.5){float scan=pow(.5+.5*sin(p.y*32.-t*2.),12.);dance=vec2(sin(seed*70.+t*5.)*scan,0.)*profile.z;}
            else if(profile.x<3.5){float beat=pow(max(0.,sin(t*2.-length(p.xy)*16.)),8.);dance=normalize(p.xy+vec2(.001))*beat*profile.z;}
            else{dance=vec2(-p.y,p.x)*sin(length(p.xy)*18.-t*2.)*profile.z;}
            float age=time-ripple.z, distance=length(p.xy-ripple.xy);
            float ring=exp(-pow((distance-age*.32)*22.,2.))*exp(-max(age,0.)*1.8)*step(0.,age);
            p.xy+=motion*(delta*near*.2*(1.-tongue)+dance*amount+normalize(p.xy-ripple.xy+vec2(.001))*ring*.026);
            float headset = headphoneMask * bare;
            float revealed=smoothstep(.06,.62,bare);
            // The ear stays anchored; the original headset has its own lift layer.
            if(gearLayer>.5){
              float lift=bare*bare*(3.-2.*bare);
              float turn=-.035*sin(bare*3.14159)*motion;
              p.xy=mat2(cos(turn),-sin(turn),sin(turn),cos(turn))*p.xy;
              p.x*=1.+lift*.035*motion;
              p.y+=lift*.045*motion;
            }
            float pink = step(tongueColor.g*.96,tongueColor.b)*step(tongueColor.g*1.12,tongueColor.r)*step(.3,tongueColor.a)*step(.207,-position.y)*step(-position.y,.29)*step(seed,.85);
            float opening = exp(-pow(position.x/.075,2.)-pow((position.y+.216)/.005,2.));
            opacity = mix(1.,bareColor.a,headset)*(1.-pink*tongue*.95);
            opacity=mix(opacity,bareColor.a*revealed,gearMask);
            if(gearLayer>.5){
              float band=smoothstep(.08,.22,position.y);
              opacity=1.-smoothstep(mix(.15,.06,band),mix(.95,.65,band),bare);
            }
            p=choreograph(p,wordPosition,seed);
            float arrival=landing;
            float shade=dot(aColor,vec3(.2126,.7152,.0722));
            // Keep finer light edges, while opening space through broad flat areas.
            keep=step(seed,mix(density+max(0.,shade-.45)*.18,.14,arrival));
            glow=amount*(.35+.35*sin(p.y*12.-time*1.8+seed*2.)) + ring*.25;
            color=mix(aColor,bareColor.rgb,max(headset,gearMask));
            if(gearLayer>.5) color=aColor;
            color=mix(color,vec3(.10,.035,.03),opening*tongue*.35);
            color=mix(color,vec3(.86,.64,.31),energy*.8);
            color=mix(color,mix(vec3(.35,.90,.72),vec3(.68,.91,.88),seed),arrival*.9);
            float sweep=exp(-pow((wordPosition.x-(revealTime-2.4)*.55+.55)*18.,2.))*arrival*motion;
            color+=vec3(.65,.70,.55)*sweep;
            color=mix(color,vec3(.94,.69,.32),satellite*arrival*motion);
            glow+=energy*.6;
            opacity*=mix(1.,.82,energy);

            gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
            gl_PointSize=mix(pointSize*(.85+seed*.25+near*.12),wordPointSize*(1.+energy*1.5+satellite*arrival*.3),max(arrival,energy)) *keep;
          }`,
        fragmentShader: `uniform vec3 accent; uniform float trail;
          varying vec3 color; varying float glow, keep, opacity;
          void main(){if(keep<.5)discard;float r=length(gl_PointCoord-.5)*2.;if(r>1.)discard;
            float alpha=1.-smoothstep(.3,.92,r);
            vec3 c=mix(pow(color,vec3(.9))*1.3,accent*(.5+length(color)*.45),clamp(glow*.6,0.,.65));
            gl_FragColor=vec4(c,alpha*opacity*mix(1.,.18,trail));}`,
      });
      const points = new THREE.Points(geometry, material);
      scene.add(points);
      headsetGeometry = new THREE.BufferGeometry();
      for (const [name, attribute] of Object.entries(geometry.attributes))
        headsetGeometry.setAttribute(name, attribute);
      const equipmentIndices: number[] = [];
      for (let i = 0; i < count; i++)
        if (gearMask[i] > 0.5) equipmentIndices.push(i);
      headsetGeometry.setIndex(equipmentIndices);
      headsetMaterial = new THREE.ShaderMaterial({
        vertexShader: material.vertexShader,
        fragmentShader: material.fragmentShader,
        uniforms: { ...uniforms, gearLayer: { value: 1 } },
        transparent: true,
        depthTest: false,
        depthWrite: false,
      });
      const headsetPoints = new THREE.Points(headsetGeometry, headsetMaterial);
      headsetPoints.renderOrder = 1;
      scene.add(headsetPoints);
      // Reuse real portrait vertices for two faint trails; no new particles spawn.
      trailGeometry = new THREE.BufferGeometry();
      for (const [name, attribute] of Object.entries(geometry.attributes))
        trailGeometry.setAttribute(name, attribute);
      trailGeometry.setIndex(
        Array.from({ length: Math.ceil(count / 12) }, (_, i) => i * 12).filter(
          (i) => i < count,
        ),
      );
      const trails = [0.055, 0.11].map((offset) => {
        const paint = new THREE.ShaderMaterial({
          vertexShader: material!.vertexShader,
          fragmentShader: material!.fragmentShader,
          uniforms: {
            ...uniforms,
            trailOffset: { value: offset },
            trail: { value: 1 },
          },
          transparent: true,
          depthTest: false,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        });
        trailMaterials.push(paint);
        const trail = new THREE.Points(trailGeometry!, paint);
        trail.renderOrder = -1;
        trail.visible = false;
        scene.add(trail);
        return trail;
      });
      const tonguePositions: number[] = [],
        tonguePaint: number[] = [],
        tongueSeeds: number[] = [],
        tongueWords: number[] = [];
      for (let i = 0; i < count; i++) {
        const r = tongueColors[i * 4],
          g = tongueColors[i * 4 + 1],
          b = tongueColors[i * 4 + 2];
        if (
          tongueColors[i * 4 + 3] > 0.3 &&
          b > g * 0.96 &&
          r > g * 1.12 &&
          positions[i * 3 + 1] < -0.207 &&
          positions[i * 3 + 1] > -0.29
        ) {
          tonguePositions.push(positions[i * 3], positions[i * 3 + 1], 0);
          tonguePaint.push(r, g, b);
          tongueSeeds.push(seeds[i]);
          tongueWords.push(wordPositions[i * 3], wordPositions[i * 3 + 1], 0);
        }
      }
      tongueGeometry = new THREE.BufferGeometry();
      tongueGeometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(tonguePositions, 3),
      );
      tongueGeometry.setAttribute(
        "aColor",
        new THREE.Float32BufferAttribute(tonguePaint, 3),
      );
      tongueGeometry.setAttribute(
        "seed",
        new THREE.Float32BufferAttribute(tongueSeeds, 1),
      );
      tongueGeometry.setAttribute(
        "wordPosition",
        new THREE.Float32BufferAttribute(tongueWords, 3),
      );
      tongueMaterial = new THREE.ShaderMaterial({
        transparent: true,
        depthTest: false,
        depthWrite: false,
        uniforms: {
          tongue: uniforms.tongue,
          pointSize: uniforms.pointSize,
          light: uniforms.light,
          signature: uniforms.signature,
          wordScale: uniforms.wordScale,
          wordPointSize: uniforms.wordPointSize,
          revealTime: uniforms.revealTime,
          trailOffset: uniforms.trailOffset,
          wordPointer: uniforms.wordPointer,
          motion: uniforms.motion,
        },
        vertexShader: `attribute vec3 aColor,wordPosition; attribute float seed; uniform float tongue,pointSize,motion; varying vec3 color; varying float keep;
          ${choreographyShader}
          void main(){vec3 p=position;p.x*=mix(.75,1.,tongue);p.y=-.216+(position.y+.216)*tongue;
          p=choreograph(p,wordPosition,seed);
          color=mix(aColor,vec3(.35,.90,.72),landing*.9);
          keep=step(seed,mix(.85,.14,landing));
          gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
          gl_PointSize=mix(pointSize*(.85+seed*.25),wordPointSize*(1.+energy*1.5),max(landing,energy))*keep;}`,
        fragmentShader: `uniform float tongue;varying vec3 color;varying float keep;
          void main(){if(keep<.5||tongue<.01)discard;float r=length(gl_PointCoord-.5)*2.;if(r>1.)discard;
          gl_FragColor=vec4(pow(color,vec3(.9))*1.15,(1.-smoothstep(.3,.92,r))*smoothstep(0.,.15,tongue));}`,
      });
      const tonguePoints = new THREE.Points(tongueGeometry, tongueMaterial);
      tonguePoints.renderOrder = 3;
      scene.add(tonguePoints);
      const starPositions = new Float32Array(120 * 3);
      for (let i = 0; i < 120; i++) {
        const angle = i * 2.399963,
          radius = 0.56 + ((i % 13) / 13) * 0.22;
        starPositions[i * 3] = Math.cos(angle) * radius;
        starPositions[i * 3 + 1] = Math.sin(angle) * radius * 0.85;
      }
      starsGeometry = new THREE.BufferGeometry();
      starsGeometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(starPositions, 3),
      );
      starsMaterial = new THREE.ShaderMaterial({
        transparent: true,
        depthTest: false,
        depthWrite: false,
        uniforms: {
          time: uniforms.time,
          amount: uniforms.amount,
          motion: uniforms.motion,
          accent: uniforms.accent,
          light: uniforms.light,
          pixelRatio: { value: renderer.getPixelRatio() },
        },
        vertexShader: `uniform float time, amount, motion, pixelRatio; varying float alpha;
          void main(){float t=time*.025*motion;vec3 p=position;float a=atan(p.y,p.x)+t;float radius=length(p.xy);p.xy=vec2(cos(a),sin(a))*radius;
          alpha=(.12+amount*.18)*(.5+.5*sin(position.x*60.+time));
          gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);gl_PointSize=(1.+amount)*pixelRatio;}`,
        fragmentShader: `uniform vec3 accent; uniform float light, amount; varying float alpha;void main(){float r=length(gl_PointCoord-.5)*2.;if(r>1.)discard;gl_FragColor=vec4(mix(vec3(.62,.72,.68),accent,amount*.6)*(1.-light*.7),alpha*(1.-r));}`,
      });
      const stars = new THREE.Points(starsGeometry, starsMaterial);
      scene.add(stars);

      let width = 1,
        height = 1,
        fit = 1,
        zoom = 1,
        targetZoom = 1,
        nonce = state.current.command.nonce;
      const resize = () => {
        width = container.clientWidth;
        height = container.clientHeight;
        renderer!.setSize(width, height);
        camera.left = -width / 2;
        camera.right = width / 2;
        camera.top = height / 2;
        camera.bottom = -height / 2;
        camera.updateProjectionMatrix();
        const legend =
          container.parentElement
            ?.querySelector(".genre-legend")
            ?.getBoundingClientRect().height || 100;
        fit = Math.min(
          (width - (width < 600 ? 28 : 160)) / (source.width / source.height),
          height - legend - 60,
        );
        fit *= 0.96;
        points.position.y = legend / 2 + 5;
        uniforms.pointSize.value =
          Math.max(0.8, (fit / source.height) * 2.6) *
          renderer!.getPixelRatio();
      };
      observer = new ResizeObserver(resize);
      observer.observe(container);
      resize();
      tooltip = document.createElement("button");
      tooltip.className = "graph-tooltip portrait-song-tooltip";
      tooltip.hidden = true;
      container.appendChild(tooltip);
      let hoveredSong: MapNode | undefined;
      let lastPointerType = "mouse";
      let indexedSongs: MapNode[] | undefined;
      const cells = new Map<
        string,
        { song: MapNode; point: number; romantic: boolean }[]
      >();
      const lenses: number[] = [],
        otherPoints: number[] = [];
      let glimpsePoint = 0,
        glimpseDistance = Infinity;
      for (let i = 0; i < count; i++) {
        const x = positions[i * 3],
          y = positions[i * 3 + 1];
        if (portraitLens(x, y)) {
          lenses.push(i);
          const distance =
            (x - (445 - 615) / 1278) ** 2 + (y - (0.5 - 650 / 1278)) ** 2;
          if (distance < glimpseDistance) {
            glimpseDistance = distance;
            glimpsePoint = i;
          }
        } else otherPoints.push(i);
      }
      const cellKey = (x: number, y: number) =>
        Math.floor(x / 0.035) + ":" + Math.floor(y / 0.035);
      const indexSongs = () => {
        if (indexedSongs === state.current.songs) return;
        indexedSongs = state.current.songs;
        cells.clear();
        const assigned = new Set<number>();
        for (const song of [...indexedSongs].sort(
          (a, b) =>
            Number(isGlimpseOfUs(b)) - Number(isGlimpseOfUs(a)) ||
            (isGlimpseOfUs(a) && isGlimpseOfUs(b)
              ? (state.current.playCounts[b.id] ?? 0) -
                (state.current.playCounts[a.id] ?? 0)
              : 0) ||
            a.id.localeCompare(b.id),
        )) {
          let hash = 2166136261;
          for (let i = 0; i < song.id.length; i++)
            hash = Math.imul(hash ^ song.id.charCodeAt(i), 16777619);
          const romantic = isRomanticPortraitSong(song);
          const pool = romantic ? lenses : otherPoints;
          let slot = (hash >>> 0) % pool.length;
          let point = isGlimpseOfUs(song) ? glimpsePoint : pool[slot];
          for (let step = 0; assigned.has(point) && step < pool.length; step++)
            point = pool[++slot % pool.length];
          assigned.add(point);
          const key = cellKey(positions[point * 3], positions[point * 3 + 1]);
          const bucket = cells.get(key) ?? [];
          bucket.push({ song, point, romantic });
          cells.set(key, bucket);
        }
      };
      const clearSong = () => {
        hoveredSong = undefined;
        tooltip!.hidden = true;
      };
      const showSong = (event: PointerEvent) => {
        if (uniforms.signature.value > 0) {
          clearSong();
          return;
        }
        indexSongs();
        const x = pointerTarget.x,
          y = pointerTarget.y;
        let closest = (16 / (fit * zoom)) ** 2;
        let hit: MapNode | undefined;
        const cx = Math.floor(x / 0.035),
          cy = Math.floor(y / 0.035);
        for (let dx = -2; dx <= 2; dx++)
          for (let dy = -2; dy <= 2; dy++) {
            for (const { song, point, romantic } of cells.get(
              cx + dx + ":" + (cy + dy),
            ) ?? []) {
              if (romantic !== Boolean(portraitLens(x, y))) continue;
              if (
                state.current.genre !== "All genres" &&
                song.genre !== state.current.genre
              )
                continue;
              if (
                uniforms.bare.value > 0.8 &&
                headphoneMask[point] &&
                bareColors[point * 4 + 3] < 0.1
              )
                continue;
              const distance =
                (positions[point * 3] - x) ** 2 +
                (positions[point * 3 + 1] - y) ** 2;
              if (distance < closest) {
                closest = distance;
                hit = song;
              }
            }
          }
        if (!hit) {
          clearSong();
          return;
        }
        hoveredSong = hit;
        const plays = state.current.playCounts[hit.id];
        const title = document.createElement("strong");
        title.textContent =
          hit.track.name + (plays === undefined ? "" : " (" + plays + ")");
        tooltip!.replaceChildren(title);
        tooltip!.setAttribute(
          "aria-label",
          "Open details for " + hit.track.name,
        );
        tooltip!.hidden = false;
        const box = container.getBoundingClientRect();
        tooltip!.style.left =
          Math.max(
            10,
            Math.min(
              width - tooltip!.offsetWidth - 10,
              event.clientX - box.left + 15,
            ),
          ) + "px";
        tooltip!.style.top =
          Math.max(
            10,
            Math.min(
              height - tooltip!.offsetHeight - 10,
              event.clientY - box.top - tooltip!.offsetHeight - 18,
            ),
          ) + "px";
      };
      tooltip.addEventListener("click", () => {
        if (hoveredSong) state.current.onSelect(hoveredSong.id);
        clearSong();
      });
      const pointerTarget = new THREE.Vector2(10, 10);
      let hovering = false;
      const move = (event: PointerEvent) => {
        if (tooltip!.contains(event.target as Node)) return;
        if ((event.target as HTMLElement).closest("button")) {
          hovering = false;
          clearSong();
          return;
        }
        lastPointerType = event.pointerType;
        hovering = true;
        const box = container.getBoundingClientRect();
        pointerTarget.set(
          (event.clientX - box.left - width / 2) / (fit * zoom),
          (height / 2 - (event.clientY - box.top) - points.position.y) /
            (fit * zoom),
        );
        if (event.pointerType === "mouse") showSong(event);
      };
      const tap = (event: PointerEvent) => {
        if ((event.target as HTMLElement).closest("button,input,label")) {
          if (!tooltip!.contains(event.target as Node)) clearSong();
          return;
        }
        if (uniforms.signature.value > 0) return;
        move(event);
        if (event.pointerType === "touch") showSong(event);
        uniforms.ripple.value.set(
          pointerTarget.x,
          pointerTarget.y,
          uniforms.time.value,
        );
      };
      const leave = () => {
        hovering = false;
        if (lastPointerType !== "touch") clearSong();
      };
      const chooseSong = () => {
        if (lastPointerType === "mouse" && hoveredSong) {
          state.current.onSelect(hoveredSong.id);
          clearSong();
        }
      };
      const wheel = (event: WheelEvent) => {
        event.preventDefault();
        clearSong();
        targetZoom = THREE.MathUtils.clamp(
          targetZoom * Math.exp(-event.deltaY * 0.001),
          0.65,
          1.6,
        );
      };
      renderer.domElement.addEventListener("click", chooseSong);
      container.addEventListener("pointerdown", tap);
      container.addEventListener("pointermove", move);
      container.addEventListener("pointerleave", leave);
      container.addEventListener("wheel", wheel, { passive: false });
      removeEvents = () => {
        renderer!.domElement.removeEventListener("click", chooseSong);
        container.removeEventListener("pointerdown", tap);
        container.removeEventListener("pointermove", move);
        container.removeEventListener("pointerleave", leave);
        container.removeEventListener("wheel", wheel);
      };
      let previous = performance.now();
      const accentTarget = new THREE.Color();
      let accentKey = "",
        lastTongue = options.current.tongueRequest,
        tongueStart = -Infinity,
        lastSignature = options.current.signature,
        bareVelocity = 0,
        signatureStart = -Infinity,
        signatureActive = false,
        tongueActive = false;
      const profileTarget = new THREE.Vector3();
      const render = (now: number) => {
        if (!alive) return;
        const elapsed = now - previous;
        const dt = Math.min(elapsed / 1000, 0.05);
        previous = now;
        const current = state.current;
        if (nonce !== current.command.nonce) {
          nonce = current.command.nonce;
          targetZoom =
            current.command.type === "in"
              ? Math.min(1.6, targetZoom * 1.13)
              : current.command.type === "out"
                ? Math.max(0.65, targetZoom / 1.13)
                : 1;
        }
        zoom +=
          (targetZoom - zoom) * (reduced.matches ? 1 : 1 - Math.exp(-dt * 12));
        points.scale.setScalar(fit * zoom);
        tonguePoints.scale.copy(points.scale);
        tonguePoints.position.copy(points.position);
        headsetPoints.scale.copy(points.scale);
        headsetPoints.position.copy(points.position);
        container.style.setProperty(
          "--discovery-left",
          Math.max(58, Math.min(width - 58, width / 2 - fit * 0.46)) + "px",
        );
        container.style.setProperty(
          "--discovery-top",
          height / 2 - points.position.y + fit * 0.41 + "px",
        );
        for (const trail of trails) {
          trail.scale.copy(points.scale);
          trail.position.copy(points.position);
          trail.visible = signatureActive && !reduced.matches;
        }
        container.style.setProperty(
          "--mouth-left",
          width / 2 - fit * zoom * 0.13 + "px",
        );
        container.style.setProperty(
          "--mouth-top",
          height / 2 - points.position.y + fit * zoom * 0.18 + "px",
        );
        container.style.setProperty("--mouth-width", fit * zoom * 0.26 + "px");
        container.style.setProperty("--mouth-height", fit * zoom * 0.13 + "px");
        container.style.setProperty(
          "--ear-left",
          width / 2 - fit * zoom * 0.47 + "px",
        );
        container.style.setProperty(
          "--ear-right",
          width / 2 + fit * zoom * 0.24 + "px",
        );
        container.style.setProperty(
          "--ear-top",
          height / 2 - points.position.y - fit * zoom * 0.22 + "px",
        );
        container.style.setProperty("--ear-width", fit * zoom * 0.23 + "px");
        container.style.setProperty("--ear-height", fit * zoom * 0.39 + "px");
        stars.scale.setScalar(fit);
        stars.position.y = points.position.y;
        uniforms.wordScale.value = Math.min(width * 0.88, 760) / (fit * zoom);
        if (lastSignature !== options.current.signature) {
          lastSignature = options.current.signature;
          signatureStart = now;
          signatureActive = true;
          setSignatureVisible(true);
          clearSong();
        }
        const signatureAge = (now - signatureStart) / 1000;
        const smooth = (t: number) => {
          t = THREE.MathUtils.clamp(t, 0, 1);
          return t * t * (3 - 2 * t);
        };
        const duration = reduced.matches ? 4.4 : 6.2;
        uniforms.revealTime.value = Number.isFinite(signatureAge)
          ? signatureAge
          : 0;
        uniforms.wordPointer.value.lerp(pointerTarget, 1 - Math.exp(-dt * 9));
        uniforms.signature.value = reduced.matches
          ? signatureActive && signatureAge < 3.8
            ? 1
            : 0
          : signatureAge < 2.25
            ? Math.max(0, signatureAge / 2.25)
            : signatureAge < 4.1
              ? 1
              : 1 - smooth((signatureAge - 4.1) / 2.1);
        if (signatureActive) {
          // Pause the exact expression/equipment pose until its dots return.
          tongueStart += elapsed;
          if (signatureAge >= duration) {
            signatureActive = false;
            setSignatureVisible(false);
          }
        }
        const active = genres.find((g) => g.name === current.genre);
        const smoothing = reduced.matches ? 1 : 1 - Math.exp(-dt * 7);
        const choreography = portraitEffects[current.genre];
        profileTarget.set(
          choreography?.mode ?? 0,
          choreography?.speed ?? 0,
          choreography?.strength ?? 0,
        );
        if (!signatureActive) {
          uniforms.profile.value.lerp(profileTarget, smoothing);
          const bareTarget = options.current.headphonesOff ? 1 : 0;
          if (reduced.matches) {
            uniforms.bare.value = bareTarget;
            bareVelocity = 0;
          } else {
            // Exact critically damped spring: smooth reversal, no overshoot or long tail.
            const offset = uniforms.bare.value - bareTarget;
            const decay = Math.exp(-9 * dt);
            const step = (bareVelocity + 9 * offset) * dt;
            uniforms.bare.value = bareTarget + (offset + step) * decay;
            bareVelocity = (bareVelocity - 9 * step) * decay;
            if (
              Math.abs(uniforms.bare.value - bareTarget) < 0.0001 &&
              Math.abs(bareVelocity) < 0.001
            ) {
              uniforms.bare.value = bareTarget;
              bareVelocity = 0;
            }
          }
          if (lastTongue !== options.current.tongueRequest) {
            lastTongue = options.current.tongueRequest;
            tongueStart = now;
            setTongueVisible(true);
            tongueActive = true;
          }
          const tongueAge = (now - tongueStart) / 1000;
          uniforms.tongue.value = reduced.matches
            ? tongueAge >= 0 && tongueAge < 1.2
              ? 1
              : 0
            : tongueAge < 0.42
              ? smooth(tongueAge / 0.42)
              : tongueAge < 1.2
                ? 1
                : 1 - smooth((tongueAge - 1.2) / 0.55);
          if (tongueActive && tongueAge >= 1.75) {
            tongueActive = false;
            setTongueVisible(false);
          }
          uniforms.amount.value +=
            ((active ? 1 : 0) - uniforms.amount.value) * smoothing;
          if (active) {
            const key = current.theme === "dark" ? active.color : active.light;
            if (accentKey !== key) {
              accentTarget.set(key);
              accentKey = key;
            }
            uniforms.accent.value.lerp(accentTarget, smoothing);
          }
          uniforms.pointer.value.lerp(pointerTarget, smoothing);
          uniforms.hover.value +=
            ((hovering ? 1 : 0) - uniforms.hover.value) * smoothing;
          uniforms.motion.value = reduced.matches ? 0 : 1;
          if (!reduced.matches) uniforms.time.value += dt;
        }
        uniforms.light.value = 0;
        renderer!.render(scene, camera);
        frame = requestAnimationFrame(render);
      };
      frame = requestAnimationFrame(render);
      onReady(true);
    }
    start().catch(() => {
      if (alive) {
        setError(true);
        onReady(true);
      }
    });
    return () => {
      alive = false;
      cancelAnimationFrame(frame);
      observer?.disconnect();
      removeEvents();
      geometry?.dispose();
      material?.dispose();
      tongueGeometry?.dispose();
      tongueMaterial?.dispose();
      tooltip?.remove();
      headsetGeometry?.dispose();
      headsetMaterial?.dispose();
      trailGeometry?.dispose();
      trailMaterials.forEach((paint) => paint.dispose());
      starsGeometry?.dispose();
      starsMaterial?.dispose();
      renderer?.dispose();
      renderer?.domElement.remove();
    };
  }, [attempt, onReady]);
  return (
    <div
      ref={host}
      className="portrait-2d"
      data-portrait-genre={genre}
      data-density={density}
      data-headphones={headphonesOff ? "off" : "on"}
      data-tongue={tongueVisible}
      data-signature={signatureVisible}
    >
      <span className="sr-only" aria-live="polite">
        {signatureVisible ? "wrestle, formed from the portrait’s own dots" : ""}
      </span>
      {!error && (
        <>
          {portraitEffects[genre] && (
            <div className="portrait-caption">
              <span className="portrait-mode-dot" />
              <span>{portraitEffects[genre].label}</span>
            </div>
          )}
          <button
            disabled={signatureVisible}
            className="portrait-hotspot portrait-mouth-hotspot"
            aria-label="Make a cheeky face"
            onClick={() => {
              if (!tongueVisible) setTongueRequest((value) => value + 1);
            }}
          />
          <button
            disabled={signatureVisible}
            className="portrait-hotspot portrait-left-ear"
            aria-label={
              headphonesOff ? "Put headphones back on" : "Take headphones off"
            }
            onClick={() => setHeadphonesOff((value) => !value)}
          />
          <button
            disabled={signatureVisible}
            className="portrait-hotspot portrait-right-ear"
            aria-label={
              headphonesOff ? "Put headphones back on" : "Take headphones off"
            }
            onClick={() => setHeadphonesOff((value) => !value)}
          />
          <button
            disabled={signatureVisible}
            className="portrait-aries"
            aria-label="Reveal wrestle with the Aries constellation"
            title="Aries"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setSignature((value) => value + 1)}
          >
            <svg viewBox="0 0 100 56" aria-hidden="true" focusable="false">
              {/* Four-star Aries asterism, adapted from the IAU Aries chart. */}
              <path d="M12 41 L16 32 L35 16 L88 9" />
              <circle cx="12" cy="41" r="1.2" />
              <circle cx="16" cy="32" r="1.55" />
              <circle cx="35" cy="16" r="2" />
              <circle cx="88" cy="9" r="1.25" />
            </svg>
            <span className="portrait-aries-label">Aries</span>
          </button>
        </>
      )}
      {error && (
        <div className="portrait-error" role="alert">
          <p>The portrait couldn’t load.</p>
          <button onClick={() => setAttempt((a) => a + 1)}>Try again</button>
        </div>
      )}
    </div>
  );
}
