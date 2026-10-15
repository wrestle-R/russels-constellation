"use client";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { MapData } from "../lib/constellation";
import {
  Plus,
  Minus,
  Scan,
  Rotate3D,
  Pause,
  Move,
  MousePointer2,
} from "lucide-react";
type Props = {
  data: MapData;
  selected: string;
  visible: string[];
  theme: "light" | "dark";
  mode: "3D" | "2D";
  onSelect: (id: string) => void;
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
}: Props) {
  const host = useRef<HTMLDivElement>(null),
    engine = useRef<Engine | null>(null),
    props = useRef({ selected, visible: new Set(visible), theme, onSelect });
  const [failed, setFailed] = useState(false),
    [rotating, setRotating] = useState(false);
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
      "Interactive 3D artist constellation. Use Artist list for keyboard access.",
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
    const labels = document.createElement("div");
    labels.className = "graph-labels";
    el.appendChild(labels);
    const groupLabels = data.groups.map((g) => {
      const label = document.createElement("button");
      label.className = "genre-map-label";
      label.tabIndex = -1;
      label.textContent = g.name;
      labels.appendChild(label);
      return {
        el: label,
        position: new THREE.Vector3(g.x, g.y, mode === "3D" ? g.z : 0),
        genre: g,
      };
    });
    const labelCandidates = [...data.nodes].sort(
      (a, b) => b.importance - a.importance,
    );
    const seen = new Map<string, number>();
    const labelsForNodes = labelCandidates.filter((n) => {
      const count = seen.get(n.genre) || 0;
      if (count >= 3) return false;
      seen.set(n.genre, count + 1);
      return true;
    });
    const artistLabels = labelsForNodes.map((n) => {
      const label = document.createElement("button");
      label.className = "artist-map-label";
      label.textContent = n.artist.name;
      label.tabIndex = -1;
      label.onclick = () => props.current.onSelect(n.artist.id);
      labels.appendChild(label);
      return {
        el: label,
        node: n,
        position: new THREE.Vector3(n.x, n.y, mode === "3D" ? n.z : 0),
      };
    });
    const selectionLabel = document.createElement("button");
    selectionLabel.className = "artist-map-label selected";
    selectionLabel.tabIndex = -1;
    labels.appendChild(selectionLabel);
    const tooltip = document.createElement("div");
    tooltip.className = "graph-tooltip";
    tooltip.hidden = true;
    el.appendChild(tooltip);
    let selectedIndex = -1,
      lastTheme = "",
      lastVisible: Set<string> | null = null,
      lastSelected = "",
      width = 1,
      height = 1,
      frame = 0,
      active = true;
    const color = new THREE.Color();
    const projected = new THREE.Vector3();
    function project(pos: THREE.Vector3) {
      projected.copy(pos).project(camera);
      return {
        x: (projected.x * 0.5 + 0.5) * width,
        y: (-projected.y * 0.5 + 0.5) * height,
        show:
          projected.z < 1 &&
          projected.z > -1 &&
          Math.abs(projected.x) < 0.96 &&
          Math.abs(projected.y) < 0.94,
      };
    }
    function styleData() {
      const p = props.current;
      if (
        lastTheme === p.theme &&
        lastVisible === p.visible &&
        lastSelected === p.selected
      )
        return;
      lastTheme = p.theme;
      lastVisible = p.visible;
      lastSelected = p.selected;
      material.uniforms.dark.value = p.theme === "dark" ? 1 : 0;
      selectedIndex = data.nodes.findIndex((n) => n.artist.id === p.selected);
      data.nodes.forEach((n, i) => {
        const show = p.visible.has(n.artist.id);
        color.set(p.theme === "dark" ? n.color : n.lightColor);
        colors.set([color.r, color.g, color.b], i * 3);
        visibility[i] = show ? (n.genre === "Unclassified" ? 0.55 : 1) : 0.035;
      });
      geometry.attributes.aColor.needsUpdate = true;
      geometry.attributes.aVisible.needsUpdate = true;
      data.edges.forEach(([a, b], i) => {
        const n = data.nodes[a];
        color.set(p.theme === "dark" ? n.color : n.lightColor);
        const show =
          p.visible.has(n.artist.id) && p.visible.has(data.nodes[b].artist.id);
        const strength = show
          ? a === selectedIndex || b === selectedIndex
            ? 3
            : 1
          : 0.05;
        lineColors.set(
          [
            color.r * strength,
            color.g * strength,
            color.b * strength,
            color.r * strength,
            color.g * strength,
            color.b * strength,
          ],
          i * 6,
        );
      });
      lineGeo.attributes.color.needsUpdate = true;
      lineMaterial.opacity = p.theme === "dark" ? 0.19 : 0.17;
      ring.visible = selectedIndex >= 0 && p.visible.has(p.selected);
      if (selectedIndex >= 0) {
        const n = data.nodes[selectedIndex];
        ring.position.set(n.x, n.y, mode === "3D" ? n.z : 0);
        ringMat.color.set(p.theme === "dark" ? n.color : n.lightColor);
        selectionLabel.textContent = n.artist.name;
        selectionLabel.onclick = () => p.onSelect(n.artist.id);
      }
    }
    function render() {
      styleData();
      ring.quaternion.copy(camera.quaternion);
      const occupied: { x: number; y: number; w: number }[] = [];
      const place = (
        label: HTMLElement,
        pos: THREE.Vector3,
        w: number,
        offset: number,
        priority = false,
      ) => {
        const p = project(pos);
        const x = p.x,
          y = p.y + offset;
        const conflict =
          !priority &&
          occupied.some(
            (o) =>
              Math.abs(o.x - x) < (o.w + w) / 2 + 8 && Math.abs(o.y - y) < 24,
          );
        const show = p.show && !conflict;
        label.style.visibility = show ? "visible" : "hidden";
        if (show) {
          label.style.transform = `translate(${x}px,${y}px) translate(-50%,-50%)`;
          occupied.push({ x, y, w });
        }
        return show;
      };
      selectionLabel.style.visibility = "hidden";
      if (ring.visible)
        place(
          selectionLabel,
          ring.position,
          Math.min(180, selectionLabel.textContent!.length * 6.5 + 20),
          20,
          true,
        );
      groupLabels.forEach(({ el, position, genre }) => {
        el.style.color =
          props.current.theme === "dark" ? genre.color : genre.lightColor;
        const relevant = data.nodes.some(
          (n) =>
            n.genre === genre.name && props.current.visible.has(n.artist.id),
        );
        if (!relevant) {
          el.style.visibility = "hidden";
          return;
        }
        place(el, position, 150, 0);
      });
      artistLabels.forEach(({ el, node, position }) => {
        if (
          node.artist.id === props.current.selected ||
          !props.current.visible.has(node.artist.id)
        ) {
          el.style.visibility = "hidden";
          return;
        }
        place(
          el,
          position,
          Math.min(150, node.artist.name.length * 6 + 15),
          17,
        );
      });
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
      camera.position.set(
        center.x,
        center.y + (mode === "3D" ? 20 : 0),
        center.z + distance,
      );
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
      if (hit?.index !== undefined)
        props.current.onSelect(data.nodes[hit.index].artist.id);
    };
    const hover = (e: PointerEvent) => {
      if (e.buttons) {
        tooltip.hidden = true;
        return;
      }
      const hit = pick(e);
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
      tooltip.hidden = true;
    };
    renderer.domElement.addEventListener("pointerdown", down);
    renderer.domElement.addEventListener("pointerup", up);
    renderer.domElement.addEventListener("pointermove", hover);
    renderer.domElement.addEventListener("pointerleave", leave);
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
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
      labels.remove();
      tooltip.remove();
      engine.current = null;
    };
  }, [data, mode]);
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
          3D is unavailable in this browser. Choose Artist list above to explore
          the complete collection.
        </div>
      )}
      <div className="graph-instructions">
        <MousePointer2 size={13} />
        <span>
          {mode === "3D" ? "Drag to orbit" : "Drag to pan"}
          <b>·</b>Scroll to zoom<b>·</b>Click an artist
        </span>
      </div>
      <div className="graph-controls">
        <button
          aria-label={rotating ? "Pause rotation" : "Rotate constellation"}
          aria-pressed={rotating}
          onClick={() => setRotating(!rotating)}
        >
          {rotating ? <Pause size={15} /> : <Rotate3D size={16} />}
        </button>
        <i />
        <button aria-label="Zoom out" onClick={() => zoom(1.2)}>
          <Minus size={16} />
        </button>
        <button aria-label="Zoom in" onClick={() => zoom(0.8)}>
          <Plus size={16} />
        </button>
        <button
          aria-label="Reset constellation"
          onClick={() => engine.current?.reset()}
        >
          <Scan size={16} />
        </button>
      </div>
    </div>
  );
}
