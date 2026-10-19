"use client";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
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
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const container = host.current!;
    let alive = true,
      frame = 0;
    let renderer: THREE.WebGLRenderer | undefined;
    let geometry: THREE.BufferGeometry | undefined;
    let material: THREE.ShaderMaterial | undefined;
    let observer: ResizeObserver | undefined;
    let removeEvents = () => {};
    setError(false);
    onReady(false);
    async function start() {
      const buffer = await loadPortraitBytes();
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
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: false,
        powerPreference: "low-power",
      });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
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
      geometry.setAttribute("seed", new THREE.Float32BufferAttribute(seeds, 1));
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
      };
      material = new THREE.ShaderMaterial({
        transparent: true,
        depthTest: false,
        depthWrite: false,
        uniforms,
        vertexShader: `attribute vec3 aColor; attribute float seed;
          uniform float time, amount, motion, pointSize, hover; uniform vec2 pointer;
          varying vec3 color; varying float glow;
          void main(){vec3 p=position; vec2 delta=p.xy-pointer; float d=length(delta);
            float near=exp(-d*d*70.)*hover;
            p.xy+=motion*(delta*near*.13+vec2(sin(p.y*16.+time),cos(p.x*18.-time))*.003*amount);
            glow=amount*(.45+.55*sin(p.y*12.-time*1.8+seed*2.));
            color=aColor;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
            gl_PointSize=pointSize*(.85+seed*.3+near*.2+amount*.12);}`,
        fragmentShader: `uniform vec3 accent; uniform float light; varying vec3 color; varying float glow;
          void main(){float r=length(gl_PointCoord-.5)*2.;if(r>1.)discard;
            float alpha=1.-smoothstep(.35,1.,r);
            vec3 c=mix(color*.98,accent*(.5+length(color)*.45),glow*.65);
            gl_FragColor=vec4(c*(1.-light*.32),alpha);}`,
      });
      const points = new THREE.Points(geometry, material);
      scene.add(points);
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
        points.position.y = legend / 2 - 36;
        uniforms.pointSize.value =
          Math.max(0.85, (fit / source.height) * 2.6) *
          renderer!.getPixelRatio();
      };
      observer = new ResizeObserver(resize);
      observer.observe(container);
      resize();
      const pointerTarget = new THREE.Vector2(10, 10);
      let hovering = false;
      const move = (event: PointerEvent) => {
        hovering = true;
        const box = container.getBoundingClientRect();
        pointerTarget.set(
          (event.clientX - box.left - width / 2) / (fit * zoom),
          (height / 2 - (event.clientY - box.top) - points.position.y) /
            (fit * zoom),
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
      container.addEventListener("pointermove", move);
      container.addEventListener("pointerleave", leave);
      container.addEventListener("wheel", wheel, { passive: false });
      removeEvents = () => {
        container.removeEventListener("pointermove", move);
        container.removeEventListener("pointerleave", leave);
        container.removeEventListener("wheel", wheel);
      };
      let previous = performance.now();
      const accentTarget = new THREE.Color();
      let accentKey = "";
      const render = (now: number) => {
        if (!alive) return;
        const dt = Math.min((now - previous) / 1000, 0.05);
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
        const active = genres.find((g) => g.name === current.genre);
        const smoothing = reduced.matches ? 1 : 1 - Math.exp(-dt * 7);
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
      renderer?.dispose();
      renderer?.domElement.remove();
    };
  }, [attempt, onReady]);
  return (
    <div ref={host} className="portrait-2d" data-portrait-genre={genre}>
      {error && (
        <div className="portrait-error" role="alert">
          <p>The portrait couldn’t load.</p>
          <button onClick={() => setAttempt((a) => a + 1)}>Try again</button>
        </div>
      )}
    </div>
  );
}
