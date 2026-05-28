import { cn } from '@/lib/utils';
import { useTheme } from '@/context/ThemeContext';
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

type DottedSurfaceProps = Omit<React.ComponentProps<'div'>, 'ref'> & {
  /**
   * Vertical pan of the camera's look-at target (Three.js scene units).
   * POSITIVE values tilt the camera UPWARD without scaling the particles.
   * Default: 0.
   */
  lookAtY?: number;
  /**
   * Height of the surface band as a percentage of the viewport (0–100).
   * Default 100 = full viewport. Pass 30 to render only the bottom 30%
   * (top 70% stays empty / silent — good for cover headlines).
   * The mesh isn't squished: the renderer + camera aspect adapt to the
   * container's actual dimensions.
   */
  heightVh?: number;
};

/**
 * Animated 3D dotted surface — full-bleed background for hero / cover surfaces.
 * Adapted from the shadcn-style snippet to use this project's ThemeContext
 * (instead of next-themes) and pointer-events-none full-screen positioning.
 *
 * Three.js renders ~2400 particles in a sine-wave grid. CPU/GPU heavy on
 * mobile — only use sparingly (e.g. on cover slides).
 */
export function DottedSurface({ className, lookAtY = 0, heightVh = 100, ...props }: DottedSurfaceProps) {
  const { resolvedTheme } = useTheme();

  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    particles: THREE.Points[];
    animationId: number;
    count: number;
  } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const SEPARATION = 150;
    const AMOUNTX = 40;
    const AMOUNTY = 60;

    // Scene setup
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xffffff, 2000, 10000);

    const containerEl = containerRef.current;
    // Use container dimensions so the consumer controls the visible area via
    // CSS (full viewport, bottom band, sidebar, etc.) without squishing.
    const initialWidth = containerEl.clientWidth || window.innerWidth;
    const initialHeight = containerEl.clientHeight || window.innerHeight;

    const camera = new THREE.PerspectiveCamera(
      60,
      initialWidth / initialHeight,
      1,
      10000,
    );
    camera.position.set(0, 355, 1220);
    camera.lookAt(0, lookAtY, 0);

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(initialWidth, initialHeight);
    renderer.setClearColor(scene.fog.color, 0);

    containerEl.appendChild(renderer.domElement);

    // Create geometry
    const positions: number[] = [];
    const colors: number[] = [];
    const geometry = new THREE.BufferGeometry();

    for (let ix = 0; ix < AMOUNTX; ix++) {
      for (let iy = 0; iy < AMOUNTY; iy++) {
        const x = ix * SEPARATION - (AMOUNTX * SEPARATION) / 2;
        const y = 0;
        const z = iy * SEPARATION - (AMOUNTY * SEPARATION) / 2;
        positions.push(x, y, z);
        if (resolvedTheme === 'dark') colors.push(200, 200, 200);
        else colors.push(0, 0, 0);
      }
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 8,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      sizeAttenuation: true,
    });

    const points = new THREE.Points(geometry, material);
    scene.add(points);

    let count = 0;
    let animationId = 0;

    const animate = () => {
      animationId = requestAnimationFrame(animate);
      const positionAttribute = geometry.attributes.position;
      const arr = positionAttribute.array as Float32Array;
      let i = 0;
      for (let ix = 0; ix < AMOUNTX; ix++) {
        for (let iy = 0; iy < AMOUNTY; iy++) {
          const index = i * 3;
          arr[index + 1] =
            Math.sin((ix + count) * 0.3) * 50 +
            Math.sin((iy + count) * 0.5) * 50;
          i++;
        }
      }
      positionAttribute.needsUpdate = true;
      renderer.render(scene, camera);
      count += 0.1;
    };

    const resize = () => {
      const w = containerEl.clientWidth || window.innerWidth;
      const h = containerEl.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      camera.lookAt(0, lookAtY, 0);
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', resize);
    // ResizeObserver catches container size changes (e.g. heightVh prop change,
    // sidebar collapse) that don't fire a window resize event.
    const ro = new ResizeObserver(resize);
    ro.observe(containerEl);
    animate();

    sceneRef.current = {
      scene,
      camera,
      renderer,
      particles: [points],
      animationId,
      count,
    };

    return () => {
      window.removeEventListener('resize', resize);
      ro.disconnect();
      if (sceneRef.current) {
        cancelAnimationFrame(sceneRef.current.animationId);
        sceneRef.current.scene.traverse((object) => {
          if (object instanceof THREE.Points) {
            object.geometry.dispose();
            if (Array.isArray(object.material)) {
              object.material.forEach((m) => m.dispose());
            } else {
              object.material.dispose();
            }
          }
        });
        sceneRef.current.renderer.dispose();
        if (containerEl && sceneRef.current.renderer.domElement.parentNode === containerEl) {
          containerEl.removeChild(sceneRef.current.renderer.domElement);
        }
      }
    };
  }, [resolvedTheme, lookAtY]);

  const isFullHeight = heightVh >= 100;
  return (
    <div
      ref={containerRef}
      className={cn(
        // z-0 (default flow) keeps the canvas ABOVE the page's bg color but
        // BELOW positioned slide content (motion.div uses z-10). If a parent
        // has bg-zinc-950 etc., a NEGATIVE z would hide the canvas.
        'pointer-events-none fixed left-0 right-0 z-0 overflow-hidden',
        isFullHeight ? 'top-0 bottom-0' : 'bottom-0',
        className,
      )}
      style={isFullHeight ? undefined : { height: `${heightVh}vh` }}
      {...props}
    />
  );
}
