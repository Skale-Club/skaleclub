import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { MeshPart } from '@shared/vectorizer/types';

interface ModelViewerProps {
  parts: MeshPart[];
  hidden: Set<string>;
  explode: number;
}

/** Interactive 3D preview of the printed parts (Z up, millimetres). */
export default function ModelViewer({ parts, hidden, explode }: ModelViewerProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<{ group: THREE.Group; render: () => void } | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, mount.clientWidth / mount.clientHeight, 0.1, 10000);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8a8a, 1.6));
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(1, 2, 1.5);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.5);
    fill.position.set(-1.5, 1, -1);
    scene.add(fill);

    // Slicer convention is Z up; three.js is Y up.
    const group = new THREE.Group();
    group.rotation.x = -Math.PI / 2;
    scene.add(group);

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = 0;
    for (const p of parts) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(p.positions, 3));
      geo.setIndex(new THREE.BufferAttribute(p.indices, 1));
      geo.computeVertexNormals();
      geo.computeBoundingBox();
      const b = geo.boundingBox!;
      minX = Math.min(minX, b.min.x);
      minY = Math.min(minY, b.min.y);
      maxX = Math.max(maxX, b.max.x);
      maxY = Math.max(maxY, b.max.y);
      maxZ = Math.max(maxZ, b.max.z);
      const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(p.color), roughness: 0.55, metalness: 0.05, flatShading: true });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.name = p.key;
      group.add(mesh);
    }
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    group.position.set(-cx, 0, cy);
    const size = Math.max(maxX - minX, maxY - minY, 10);

    const grid = new THREE.GridHelper(Math.ceil(size * 1.6 / 10) * 10, Math.ceil(size * 1.6 / 10), 0x9ca3af, 0xd1d5db);
    grid.position.y = -0.01;
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.5;
    scene.add(grid);

    camera.position.set(size * 0.2, size * 1.1, size * 1.25);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, maxZ / 2, 0);
    controls.enableDamping = true;
    controls.update();

    let frame = 0;
    const render = () => renderer.render(scene, camera);
    const loop = () => {
      frame = requestAnimationFrame(loop);
      controls.update();
      render();
    };
    loop();
    sceneRef.current = { group, render };

    const onResize = () => {
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(mount);

    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      controls.dispose();
      group.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          (o.material as THREE.Material).dispose();
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
      sceneRef.current = null;
    };
  }, [parts]);

  useEffect(() => {
    const s = sceneRef.current;
    if (!s) return;
    s.group.children.forEach((child, i) => {
      child.visible = !hidden.has(child.name);
      // "Explode" lifts each part so stacked colours can be inspected.
      child.position.z = explode * i * 3;
    });
  }, [hidden, explode, parts]);

  return <div ref={mountRef} className="h-full w-full" data-testid="vectorizer-3d" />;
}
