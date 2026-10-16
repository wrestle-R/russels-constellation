"use client";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { playShade, type MapData } from "../lib/constellation";
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
  playCounts: Record<string, number>;
  countScope: string;
};
type Engine = {
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  reset: () => void;
  render: () => void;
  dismiss: () => void;
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
  playCounts,
  countScope,
}: Props) {
  const host = useRef<HTMLDivElement>(null),
    engine = useRef<Engine | null>(null),
    props = useRef({
      selected,
      visible: new Set(visible),
      theme,
      onSelect,
      playCounts,
      countScope,
    });
  const [failed, setFailed] = useState(false);
  const rotation = useRef(false);
  useEffect(() => {
    props.current = {
      selected,
      visible: new Set(visible),
      theme,
      onSelect,
      playCounts,
      countScope,
    };
    if (!selected) engine.current?.dismiss();
    engine.current?.render();
  }, [selected, visible, theme, onSelect, playCounts, countScope]);
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
    renderer.setPixelRatio(
      Math.min(
        devicePixelRatio,
        matchMedia("(pointer: coarse)").matches ? 1.5 : 1.7,
      ),
    );
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.setAttribute(
      "aria-label",
      "Russel’s song constellation. Tap or hover for songs, drag to orbit, pinch or use the zoom buttons to zoom.",
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
      fragmentShader: `varying vec3 vColor; varying float vVisible;uniform float dark; void main(){float d=length(gl_PointCoord-0.5)*2.0;if(d>1.0)discard;float core=1.0-smoothstep(.22,.48,d);float halo=pow(1.0-d,2.0)*.55;float alpha=(core+halo)*vVisible;vec3 color=vColor;gl_FragColor=vec4(color,alpha);}`,
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
    let lastCounts: Record<string, number> | null = null;
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
        lastHovered === hoveredIndex &&
        lastCounts === p.playCounts
      )
        return;
      lastHovered = hoveredIndex;
      lastCounts = p.playCounts;
      lastTheme = p.theme;
      lastVisible = p.visible;
      lastSelected = p.selected;
      material.uniforms.dark.value = p.theme === "dark" ? 1 : 0;
      selectedIndex = data.nodes.findIndex((n) => n.id === p.selected);
      const focus = hoveredIndex >= 0 ? hoveredIndex : selectedIndex;
      const neighbors = new Set<number>();
      if (focus >= 0 && p.visible.has(data.nodes[focus].id)) {
        neighbors.add(focus);
        for (const [a, b] of data.edges) {
          if (a === focus) neighbors.add(b);
          if (b === focus) neighbors.add(a);
        }
      }
      const maxPlays = Object.values(p.playCounts).reduce(
        (max, n) => Math.max(max, n),
        1,
      );
      data.nodes.forEach((n, i) => {
        const show = p.visible.has(n.id);
        color.set(p.theme === "dark" ? n.color : n.lightColor);
        color.multiplyScalar(playShade(p.playCounts[n.id], maxPlays));
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
        const show = p.visible.has(n.id) && p.visible.has(data.nodes[b].id);
        const connected = a === focus || b === focus;
        const strength = !show
          ? 0
          : neighbors.size
            ? connected
              ? 3
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
      const fitDistance =
        (Math.max(size.y / 2, size.x / 2 / camera.aspect) /
          Math.tan(THREE.MathUtils.degToRad(24))) *
          1.18 +
        60;
      const distance = THREE.MathUtils.clamp(
        fitDistance * (camera.aspect < 1 ? 0.66 : 0.82),
        controls.minDistance,
        controls.maxDistance,
      );
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
      const widthChanged = width > 1 && Math.abs(width - el.clientWidth) > 1;
      width = Math.max(1, el.clientWidth);
      height = Math.max(1, el.clientHeight);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
      tooltip.hidden = true;
      if (widthChanged) reset();
      else render();
    }
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    resize();
    reset();
    engine.current = {
      camera,
      controls,
      reset,
      render,
      dismiss: () => {
        hoveredIndex = -1;
        tooltip.hidden = true;
      },
    };
    controls.addEventListener("start", () => {
      hoveredIndex = -1;
      tooltip.hidden = true;
    });
    const projected = new THREE.Vector3();
    const pointers = new Set<number>();
    let gesture = false;
    let pointerStart = { x: 0, y: 0 };
    function pick(event: PointerEvent) {
      const rect = renderer.domElement.getBoundingClientRect();
      const x = event.clientX - rect.left,
        y = event.clientY - rect.top;
      const radius = event.pointerType === "touch" ? 16 : 8;
      let nearest = radius * radius,
        index: number | undefined;
      // Pick in screen pixels so touch targets stay usable at every zoom level.
      data.nodes.forEach((node, i) => {
        if (!props.current.visible.has(node.id)) return;
        projected
          .set(node.x, node.y, mode === "3D" ? node.z : 0)
          .project(camera);
        if (projected.z < -1 || projected.z > 1) return;
        const dx = ((projected.x + 1) * rect.width) / 2 - x;
        const dy = ((1 - projected.y) * rect.height) / 2 - y;
        const distance = dx * dx + dy * dy;
        if (distance < nearest) {
          nearest = distance;
          index = i;
        }
      });
      return index === undefined ? undefined : { index };
    }
    const down = (e: PointerEvent) => {
      pointers.add(e.pointerId);
      if (pointers.size === 1) {
        gesture = false;
        pointerStart = { x: e.clientX, y: e.clientY };
      } else gesture = true;
    };
    const up = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (
        gesture ||
        Math.hypot(e.clientX - pointerStart.x, e.clientY - pointerStart.y) > 8
      )
        return;
      const hit = pick(e);
      if (hit?.index !== undefined) {
        props.current.onSelect(data.nodes[hit.index].id);
        if (e.pointerType === "touch") hover(e);
      } else {
        props.current.onSelect("");
        hoveredIndex = -1;
        tooltip.hidden = true;
        render();
      }
    };
    const hover = (e: PointerEvent) => {
      if (e.buttons) {
        if (
          Math.hypot(e.clientX - pointerStart.x, e.clientY - pointerStart.y) > 8
        )
          gesture = true;
        hoveredIndex = -1;
        tooltip.hidden = true;
        render();
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
        const count = props.current.playCounts[n.id];
        tooltip.replaceChildren();
        const title = document.createElement("strong");
        title.textContent = n.track.name;
        const artist = document.createElement("span");
        artist.textContent = n.artist.name + " · " + n.genre;
        tooltip.append(title, artist);
        if (count !== undefined) {
          const detail = document.createElement("small");
          detail.textContent =
            count +
            " recorded " +
            (count === 1 ? "play" : "plays") +
            " · " +
            props.current.countScope;
          tooltip.append(detail);
        }
        tooltip.hidden = false;
        const tooltipWidth = tooltip.offsetWidth,
          tooltipHeight = tooltip.offsetHeight;
        tooltip.style.left =
          Math.max(
            10,
            Math.min(width - tooltipWidth - 10, e.clientX - rect.left + 15),
          ) + "px";
        tooltip.style.top =
          Math.max(
            10,
            Math.min(
              height - tooltipHeight - 10,
              e.clientY - rect.top - tooltipHeight - 18,
            ),
          ) + "px";
      } else tooltip.hidden = true;
      render();
    };
    const leave = (event?: PointerEvent) => {
      // Touch emits pointerleave as soon as a finger lifts; keep the tapped song open.
      if (event?.pointerType === "touch") return;
      hoveredIndex = -1;
      tooltip.hidden = true;
      render();
    };
    const cancel = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      gesture = true;
      leave();
    };
    renderer.domElement.addEventListener("pointerdown", down);
    renderer.domElement.addEventListener("pointerup", up);
    renderer.domElement.addEventListener("pointermove", hover);
    renderer.domElement.addEventListener("pointerleave", leave);
    renderer.domElement.addEventListener("pointercancel", cancel);
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
      if (controls.update()) render();
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
    else zoom(command.type === "in" ? 0.8 : 1.25);
  }, [command]);
  function zoom(factor: number) {
    const e = engine.current;
    if (!e) return;
    const offset = e.camera.position.clone().sub(e.controls.target);
    offset.setLength(THREE.MathUtils.clamp(offset.length() * factor, 65, 1600));
    e.camera.position.copy(e.controls.target).add(offset);
    e.dismiss();
    e.controls.update();
    e.render();
  }
  return (
    <div className="constellation-shell">
      <div className="three-host" ref={host} />
      {failed && (
        <div className="webgl-fallback">
          The constellation needs 3D graphics support. Try enabling graphics
          acceleration or opening it in another browser.
        </div>
      )}
    </div>
  );
}
