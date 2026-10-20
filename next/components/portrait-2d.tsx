"use client";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { portraitEffects } from "../lib/portrait-effects";
import { genres } from "../lib/music";
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
  theme: "dark" | "light";
  command: SceneCommand;
  onReady: (ready: boolean) => void;
};
export default function Portrait2D({ genre, theme, command, onReady }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const state = useRef({ genre, theme, command });
  state.current = { genre, theme, command };
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
        headphoneMask = new Float32Array(count);
      for (let i = 0; i < count; i++) {
        for (let c = 0; c < 4; c++) {
          tongueColors[i * 4 + c] = expression[8 + i * 9 + c] / 255;
          bareColors[i * 4 + c] = expression[8 + i * 9 + 4 + c] / 255;
        }
        headphoneMask[i] = expression[8 + i * 9 + 8] / 255;
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
      const reduced = matchMedia("(prefers-reduced-motion: reduce)");
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
        signature: { value: 0 },
        wordScale: { value: 1 },
        wordPointSize: { value: renderer.getPixelRatio() * 1.6 },
      };
      material = new THREE.ShaderMaterial({
        transparent: true,
        depthTest: false,
        depthWrite: false,
        uniforms,
        vertexShader: `attribute vec3 aColor, wordPosition; attribute float seed; attribute vec4 tongueColor, bareColor; attribute float headphoneMask;
          uniform float time, amount, motion, pointSize, hover, density, tongue, bare, signature, wordScale, wordPointSize;
          uniform vec2 pointer; uniform vec3 profile, ripple;
          varying vec3 color; varying float glow, keep, opacity;
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
            // Only equipment particles leave the head. Revealed ear pixels stay seated.
            float leaving = headphoneMask * (1.-bareColor.a);
            p.x += motion * sign(position.x) * leaving * sin(bare*3.14159) * .10;
            p.y += motion * leaving * sin(bare*3.14159) * .025;
            float pink = step(tongueColor.g*.96,tongueColor.b)*step(tongueColor.g*1.12,tongueColor.r)*step(.3,tongueColor.a)*step(.207,-position.y)*step(-position.y,.29)*step(seed,.85);
            float opening = exp(-pow(position.x/.075,2.)-pow((position.y+.216)/.005,2.));
            opacity = (1.-leaving*bare)*(1.-pink*tongue*.95);
            float arrival=smoothstep(seed*.12,.85+seed*.15,signature);
            p.xy=mix(p.xy,wordPosition.xy*wordScale,arrival);
            p.y+=sin(arrival*3.14159)*sin(seed*31.)*.035;
            float shade=dot(aColor,vec3(.2126,.7152,.0722));
            // Keep finer light edges, while opening space through broad flat areas.
            keep=step(seed,mix(density+max(0.,shade-.45)*.18,.14,signature));
            glow=amount*(.35+.35*sin(p.y*12.-time*1.8+seed*2.)) + ring*.25;
            color=mix(aColor,bareColor.rgb,headset);
            color=mix(color,vec3(.10,.035,.03),opening*tongue*.35);
            color=mix(color,mix(vec3(.40,.84,.65),vec3(.85,.72,.51),seed),arrival*.85);

            gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
            gl_PointSize=mix(pointSize*(.85+seed*.25+near*.12),wordPointSize,signature)*keep;
          }`,
        fragmentShader: `uniform vec3 accent; uniform float light;
          varying vec3 color; varying float glow, keep, opacity;
          void main(){if(keep<.5)discard;float r=length(gl_PointCoord-.5)*2.;if(r>1.)discard;
            float alpha=1.-smoothstep(.3,.92,r);
            vec3 c=mix(pow(color,vec3(.9))*1.3,accent*(.5+length(color)*.45),clamp(glow*.6,0.,.65));
            gl_FragColor=vec4(c*(1.-light*.32),alpha*opacity);}`,
      });
      const points = new THREE.Points(geometry, material);
      scene.add(points);
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
        },
        vertexShader: `attribute vec3 aColor,wordPosition; attribute float seed; uniform float tongue,pointSize,signature,wordScale,wordPointSize; varying vec3 color; varying float keep;
          void main(){vec3 p=position;p.x*=mix(.75,1.,tongue);p.y=-.216+(position.y+.216)*tongue;
          float arrival=smoothstep(seed*.12,.85+seed*.15,signature);
          p.xy=mix(p.xy,wordPosition.xy*wordScale,arrival);
          p.y+=sin(arrival*3.14159)*sin(seed*31.)*.035;
          color=mix(aColor,vec3(.40,.84,.65),arrival*.85);keep=step(seed,mix(.85,.14,signature));gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);gl_PointSize=mix(pointSize*(.85+seed*.25),wordPointSize,signature)*keep;}`,
        fragmentShader: `uniform float tongue,light,signature;varying vec3 color;varying float keep;
          void main(){if(keep<.5||tongue<.01)discard;float r=length(gl_PointCoord-.5)*2.;if(r>1.)discard;
          gl_FragColor=vec4(pow(color,vec3(.9))*1.15*(1.-light*.32),(1.-smoothstep(.3,.92,r))*smoothstep(0.,.15,tongue));}`,
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
      const pointerTarget = new THREE.Vector2(10, 10);
      let hovering = false;
      const move = (event: PointerEvent) => {
        if ((event.target as HTMLElement).closest("button")) {
          hovering = false;
          return;
        }
        hovering = true;
        const box = container.getBoundingClientRect();
        pointerTarget.set(
          (event.clientX - box.left - width / 2) / (fit * zoom),
          (height / 2 - (event.clientY - box.top) - points.position.y) /
            (fit * zoom),
        );
      };
      const tap = (event: PointerEvent) => {
        if ((event.target as HTMLElement).closest("button,input,label")) return;
        move(event);
        uniforms.ripple.value.set(
          pointerTarget.x,
          pointerTarget.y,
          uniforms.time.value,
        );
      };
      const leave = () => {
        hovering = false;
      };
      const wheel = (event: WheelEvent) => {
        event.preventDefault();
        targetZoom = THREE.MathUtils.clamp(
          targetZoom * Math.exp(-event.deltaY * 0.001),
          0.65,
          1.6,
        );
      };
      container.addEventListener("pointerdown", tap);
      container.addEventListener("pointermove", move);
      container.addEventListener("pointerleave", leave);
      container.addEventListener("wheel", wheel, { passive: false });
      removeEvents = () => {
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
        }
        const signatureAge = (now - signatureStart) / 1000;
        const smooth = (t: number) => {
          t = THREE.MathUtils.clamp(t, 0, 1);
          return t * t * (3 - 2 * t);
        };
        uniforms.signature.value =
          signatureAge < 1.1
            ? smooth(signatureAge / 1.1)
            : signatureAge < 3.3
              ? 1
              : 1 - smooth((signatureAge - 3.3) / 1.1);
        if (signatureActive) {
          // Pause the exact expression/equipment pose until its dots return.
          tongueStart += elapsed;
          if (signatureAge >= 4.4) {
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
          uniforms.bare.value +=
            ((options.current.headphonesOff ? 1 : 0) - uniforms.bare.value) *
            (reduced.matches ? 1 : 1 - Math.exp(-dt * 4));
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
          uniforms.light.value = current.theme === "light" ? 1 : 0;
          if (!reduced.matches) uniforms.time.value += dt;
        }
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
            className="portrait-wandering-star"
            aria-label="Follow the wandering star"
            title="Wonder where this little star goes?"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setSignature((value) => value + 1)}
          >
            <span className="portrait-star-core" />
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
