"use client";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { MapData } from "../lib/constellation";
export type SceneCommand = { type: "reset" | "in" | "out"; nonce: number };
type Props = {
  data: MapData;
  selected: string;
  visible: string[];
  theme: "light" | "dark";
  mode: "3D" | "2D";
  onSelect: (id: string) => void;
  command: SceneCommand;
  rotating: boolean;
};
type Engine = {
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  reset: () => void;
  render: () => void;
};
export default function Constellation({
  data,
  selected,
  visible,
  theme,
  mode,
  onSelect,
  command,
  rotating,
}: Props) {
  const host = useRef<HTMLDivElement>(null),
    engine = useRef<Engine | null>(null),
    props = useRef({ selected, visible: new Set(visible), theme, onSelect });
  const [failed, setFailed] = useState(false);
  const rotation = useRef(false);
  useEffect(() => {
    props.current = { selected, visible: new Set(visible), theme, onSelect };
    engine.current?.render();
  }, [selected, visible, theme, onSelect]);
  useEffect(() => {
    rotation.current = rotating;
  }, [rotating]);
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
      });
    } catch {
      setFailed(true);
      return;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.setAttribute(
      "aria-label",
      "Interactive artist constellation. Hover for names, drag to orbit. Artist list in More options provides keyboard access.",
    );
    renderer.domElement.setAttribute("role", "img");
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 3000);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.09;
    controls.enableRotate = mode === "3D";
    controls.enablePan = true;
    controls.minDistance = 65;
    controls.maxDistance = 1600;
    controls.autoRotateSpeed = 0.28;
    controls.mouseButtons.LEFT =
      mode === "3D" ? THREE.MOUSE.ROTATE : THREE.MOUSE.PAN;
    const positions = new Float32Array(data.nodes.length * 3),
      colors = new Float32Array(data.nodes.length * 3),
      sizes = new Float32Array(data.nodes.length),
      visibility = new Float32Array(data.nodes.length);
    data.nodes.forEach((n, i) => {
      positions.set([n.x, n.y, mode === "3D" ? n.z : 0], i * 3);
      sizes[i] = n.size;
      visibility[i] = 1;
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute("aVisible", new THREE.BufferAttribute(visibility, 1));
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        pixelRatio: { value: renderer.getPixelRatio() },
        dark: { value: 1 },
      },
      vertexShader: `attribute vec3 aColor; attribute float aSize; attribute float aVisible; varying vec3 vColor; varying float vVisible; uniform float pixelRatio; void main(){ vColor=aColor; vVisible=aVisible; vec4 mv=modelViewMatrix*vec4(position,1.0);gl_PointSize=clamp(aSize*560.0/-mv.z,3.0,42.0)*pixelRatio;gl_Position=projectionMatrix*mv;}`,
      fragmentShader: `varying vec3 vColor; varying float vVisible;uniform float dark; void main(){float d=length(gl_PointCoord-0.5)*2.0;if(d>1.0)discard;float core=1.0-smoothstep(.22,.48,d);float halo=pow(1.0-d,2.0)*.55;float alpha=(core+halo)*vVisible;vec3 color=mix(vColor,mix(vColor,vec3(1.0),.4),core*dark);gl_FragColor=vec4(color,alpha);}`,
    });
    const points = new THREE.Points(geometry, material);
    scene.add(points);
    const linePositions = new Float32Array(data.edges.length * 6),
      lineColors = new Float32Array(data.edges.length * 6);
    data.edges.forEach(([a, b], i) => {
      linePositions.set(
        [
          positions[a * 3],
          positions[a * 3 + 1],
          positions[a * 3 + 2],
          positions[b * 3],
          positions[b * 3 + 1],
          positions[b * 3 + 2],
        ],
        i * 6,
      );
    });
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute(
      "position",
      new THREE.BufferAttribute(linePositions, 3),
    );
    lineGeo.setAttribute("color", new THREE.BufferAttribute(lineColors, 3));
    const lineMaterial = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.15,
      depthWrite: false,
    });
    const lines = new THREE.LineSegments(lineGeo, lineMaterial);
    scene.add(lines);
    const ringGeo = new THREE.RingGeometry(7, 7.5, 48),
      ringMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide,
        depthTest: false,
      });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    scene.add(ring);
    const tooltip = document.createElement("div");
    tooltip.className = "graph-tooltip";
    tooltip.hidden = true;
    el.appendChild(tooltip);
    let hoveredIndex = -1,
      lastHovered = -1;
    let selectedIndex = -1,
      lastTheme = "",
      lastVisible: Set<string> | null = null,
      lastSelected = "",
      width = 1,
      height = 1,
      frame = 0,
      active = true;
    const color = new THREE.Color();
    function styleData() {
      const p = props.current;
      if (
        lastTheme === p.theme &&
        lastVisible === p.visible &&
        lastSelected === p.selected &&
        lastHovered === hoveredIndex
      )
        return;
      lastHovered = hoveredIndex;
      lastTheme = p.theme;
      lastVisible = p.visible;
      lastSelected = p.selected;
      material.uniforms.dark.value = p.theme === "dark" ? 1 : 0;
      selectedIndex = data.nodes.findIndex((n) => n.artist.id === p.selected);
      const focus = hoveredIndex >= 0 ? hoveredIndex : selectedIndex;
      const neighbors = new Set<number>();
      if (focus >= 0 && p.visible.has(data.nodes[focus].artist.id)) {
        neighbors.add(focus);
        for (const [a, b] of data.edges) {
          if (a === focus) neighbors.add(b);
          if (b === focus) neighbors.add(a);
        }
      }
      data.nodes.forEach((n, i) => {
        const show = p.visible.has(n.artist.id);
        color.set(p.theme === "dark" ? n.color : n.lightColor);
        colors.set([color.r, color.g, color.b], i * 3);
        visibility[i] = show
          ? neighbors.size
            ? neighbors.has(i)
              ? 1
              : 0.32
            : 0.9
          : 0.035;
      });
      geometry.attributes.aColor.needsUpdate = true;
      geometry.attributes.aVisible.needsUpdate = true;
      let drawnEdges = 0;
      data.edges.forEach(([a, b], i) => {
        const n = data.nodes[a];
        color.set(p.theme === "dark" ? n.color : n.lightColor);
        const show =
          p.visible.has(n.artist.id) && p.visible.has(data.nodes[b].artist.id);
        const connected = a === focus || b === focus;
        const strength = !show
          ? 0
          : neighbors.size
            ? connected
              ? 3.5
              : data.overview[i]
                ? 0.12
                : 0
            : data.overview[i]
              ? 0.7
              : 0;
        if (strength === 0) return;
        linePositions.set(
          [
            positions[a * 3],
            positions[a * 3 + 1],
            positions[a * 3 + 2],
            positions[b * 3],
            positions[b * 3 + 1],
            positions[b * 3 + 2],
          ],
          drawnEdges * 6,
        );
        lineColors.set(
          [
            color.r * strength,
            color.g * strength,
            color.b * strength,
            color.r * strength,
            color.g * strength,
            color.b * strength,
          ],
          drawnEdges++ * 6,
        );
      });
      lineGeo.setDrawRange(0, drawnEdges * 2);
      lineGeo.attributes.position.needsUpdate = true;
      lineGeo.attributes.color.needsUpdate = true;
      lineMaterial.opacity = p.theme === "dark" ? 0.18 : 0.19;
      ring.visible = selectedIndex >= 0 && p.visible.has(p.selected);
      if (selectedIndex >= 0) {
        const n = data.nodes[selectedIndex];
        ring.position.set(n.x, n.y, mode === "3D" ? n.z : 0);
        ringMat.color.set(p.theme === "dark" ? n.color : n.lightColor);
      }
    }
    function render() {
      styleData();
      ring.quaternion.copy(camera.quaternion);
      renderer.render(scene, camera);
    }
    function reset() {
      const box = new THREE.Box3().setFromBufferAttribute(
        geometry.attributes.position as THREE.BufferAttribute,
      );
      const center = box.isEmpty()
        ? new THREE.Vector3()
        : box.getCenter(new THREE.Vector3());
      const size = box.isEmpty()
        ? new THREE.Vector3(300, 250, 0)
        : box.getSize(new THREE.Vector3());
      const distance =
        (Math.max(size.y / 2, size.x / 2 / camera.aspect) /
          Math.tan(THREE.MathUtils.degToRad(24))) *
          1.18 +
        60;
      controls.target.copy(center);
      camera.up.set(0.12, 1, 0);
      const direction =
        mode === "3D"
          ? new THREE.Vector3(0.32, 0.72, 1).normalize()
          : new THREE.Vector3(0, 0, 1);
      camera.position.copy(center).addScaledVector(direction, distance);
      controls.update();
      render();
    }
    function resize() {
      width = el.clientWidth;
      height = el.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
      render();
    }
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    resize();
    reset();
    engine.current = { camera, controls, reset, render };
    const raycaster = new THREE.Raycaster();
    raycaster.params.Points.threshold = 4;
    const mouse = new THREE.Vector2();
    let pointerStart = { x: 0, y: 0 };
    function pick(event: PointerEvent) {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        (-(event.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster
        .intersectObject(points)
        .filter(
          (h) =>
            h.index !== undefined &&
            props.current.visible.has(data.nodes[h.index].artist.id),
        );
      return hits.sort(
        (a, b) => (a.distanceToRay || 0) - (b.distanceToRay || 0),
      )[0];
    }
    const down = (e: PointerEvent) => {
      pointerStart = { x: e.clientX, y: e.clientY };
    };
    const up = (e: PointerEvent) => {
      if (
        Math.hypot(e.clientX - pointerStart.x, e.clientY - pointerStart.y) > 5
      )
        return;
      const hit = pick(e);
      if (hit?.index !== undefined) {
        props.current.onSelect(data.nodes[hit.index].artist.id);
        if (e.pointerType === "touch") hover(e);
      } else {
        props.current.onSelect("");
        tooltip.hidden = true;
      }
    };
    const hover = (e: PointerEvent) => {
      if (e.buttons) {
        hoveredIndex = -1;
        tooltip.hidden = true;
        return;
      }
      const hit = pick(e);
      hoveredIndex = hit?.index ?? -1;
      renderer.domElement.style.cursor = hit
        ? "pointer"
        : mode === "3D"
          ? "grab"
          : "move";
      if (hit?.index !== undefined) {
        const n = data.nodes[hit.index],
          rect = el.getBoundingClientRect();
        tooltip.textContent = n.artist.name + " · " + n.genre;
        tooltip.style.left =
          Math.max(10, Math.min(width - 210, e.clientX - rect.left + 15)) +
          "px";
        tooltip.style.top = Math.max(10, e.clientY - rect.top - 38) + "px";
        tooltip.hidden = false;
      } else tooltip.hidden = true;
    };
    const leave = () => {
      hoveredIndex = -1;
      tooltip.hidden = true;
    };
    renderer.domElement.addEventListener("pointerdown", down);
    renderer.domElement.addEventListener("pointerup", up);
    renderer.domElement.addEventListener("pointermove", hover);
    renderer.domElement.addEventListener("pointerleave", leave);
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    controls.enableDamping = !reduced.matches;
    const visibilityChange = () => {
      active = !document.hidden;
    };
    document.addEventListener("visibilitychange", visibilityChange);
    const tick = () => {
      frame = requestAnimationFrame(tick);
      if (!active) return;
      controls.autoRotate =
        rotation.current && !reduced.matches && mode === "3D";
      controls.update();
      render();
    };
    tick();
    const contextLost = (e: Event) => {
      e.preventDefault();
      setFailed(true);
    };
    renderer.domElement.addEventListener("webglcontextlost", contextLost);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener("visibilitychange", visibilityChange);
      controls.dispose();
      geometry.dispose();
      material.dispose();
      lineGeo.dispose();
      lineMaterial.dispose();
      ringGeo.dispose();
      ringMat.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      tooltip.remove();
      engine.current = null;
    };
  }, [data, mode]);
  useEffect(() => {
    if (command.type === "reset") engine.current?.reset();
    else zoom(command.type === "in" ? 0.8 : 1.2);
  }, [command]);
  function zoom(factor: number) {
    const e = engine.current;
    if (!e) return;
    const offset = e.camera.position.clone().sub(e.controls.target);
    offset.multiplyScalar(factor);
    if (offset.length() < 65 || offset.length() > 1600) return;
    e.camera.position.copy(e.controls.target).add(offset);
    e.controls.update();
    e.render();
  }
  return (
    <div className="constellation-shell">
      <div className="three-host" ref={host} />
      {failed && (
        <div className="webgl-fallback">
          3D is unavailable in this browser. Open Artist list from the top menu
          to explore your music.
        </div>
      )}
    </div>
  );
}
